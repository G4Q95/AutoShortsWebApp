"""
Debug router for R2 storage testing.
"""

import os
import subprocess
import uuid
import logging
import time
import shutil
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, BackgroundTasks, Depends, HTTPException, status, Body
from pydantic import BaseModel
from bson import ObjectId # Import ObjectId for MongoDB ID conversion

from app.core.config import settings
from app.services.storage import get_storage
from app.services.r2_file_tracking import r2_file_tracking
from app.services.project import cleanup_project_storage
from app.models.storage import R2FilePathCreate
from app.core.database import db  # Changed to use the database instance directly
from app.models.project import Project
from botocore.exceptions import ClientError
import asyncio # Added for sleep in background task

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])

# Define Pydantic model for the request body
class CleanupTestDataRequest(BaseModel):
    project_ids: List[str] # Changed from prefix to project_ids

class CleanupRequest(BaseModel):
    project_ids: Optional[List[str]] = None
    name_patterns: Optional[List[str]] = None

# --- Store for background job statuses (simple in-memory dict for debug) --- 
# In a real production scenario, use Redis or a database for persistence
purge_jobs: Dict[str, Dict[str, Any]] = {}


@router.get("/list-project-files/{project_id}", response_model=Dict[str, Any])
async def list_project_files(project_id: str):
    """List all files associated with a project."""
    storage = get_storage()
    
    try:
        # Get files using the application's discovery logic
        files = await storage.list_project_files(project_id)
        
        # For now, we don't have the script's logic directly available,
        # so we'll just return the files found by the app
        return {
            "project_id": project_id,
            "files_found_by_app": files,
            "files_found_by_script": [],  # To be implemented
            "differences": {
                "only_in_app": [],
                "only_in_script": []
            }
        }
    except Exception as e:
        logger.error(f"Error listing project files: {str(e)}")
        return {
            "project_id": project_id,
            "error": str(e),
            "files_found_by_app": [],
            "files_found_by_script": []
        }


@router.post("/cleanup/{project_id}", response_model=Dict[str, Any])
async def debug_cleanup(
    project_id: str, 
    mode: str = Query("wrangler", enum=["wrangler", "s3", "sequential"]),
    dry_run: bool = Query(False)
):
    """Debug endpoint for testing different cleanup strategies."""
    storage = get_storage()
    deletion_id = str(uuid.uuid4())
    
    logger.info(f"[{deletion_id}] Debug cleanup for project {project_id} using {mode} mode")
    
    try:
        if mode == "wrangler":
            # Use Wrangler for cleanup
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=True,
                sequential=False
            )
        elif mode == "s3":
            # Use S3 API for cleanup
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=False,
                sequential=False
            )
        elif mode == "sequential":
            # Use sequential deletion
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=True,
                sequential=True
            )
        
        return {
            "deletion_id": deletion_id,
            "project_id": project_id,
            "mode": mode,
            "dry_run": dry_run,
            "result": result
        }
    except Exception as e:
        logger.error(f"[{deletion_id}] Error in debug cleanup: {str(e)}")
        return {
            "deletion_id": deletion_id,
            "project_id": project_id,
            "mode": mode,
            "dry_run": dry_run,
            "error": str(e)
        }


@router.get("/verify-cleanup/{project_id}", response_model=Dict[str, Any])
async def verify_cleanup(project_id: str):
    """Check if any files remain for a project after cleanup."""
    storage = get_storage()
    
    try:
        # First check with the actual pattern being used for uploaded files
        # by directly using list_directory
        list_result = await storage.list_directory(project_id)
        direct_files = []
        if isinstance(list_result, tuple) and list_result[0]:
            direct_files = list_result[1]
            
        # Also check using list_project_files which has more comprehensive pattern checking
        project_files = await storage.list_project_files(project_id)
        
        # Combine the results
        all_files = direct_files.copy()
        
        # Add the project files if they have different keys
        if project_files:
            for pf in project_files:
                if not any(df.get('Key') == pf.get('key') for df in direct_files):
                    # Convert to match the format of direct_files
                    all_files.append({
                        'Key': pf.get('key'),
                        'Size': pf.get('size', 0),
                        'LastModified': pf.get('last_modified', ''),
                        'Pattern': pf.get('pattern', '')
                    })
        
        logger.info(f"Verify cleanup found {len(all_files)} total files for project {project_id}")
        
        return {
            "project_id": project_id,
            "files_remaining": all_files,
            "direct_files_count": len(direct_files),
            "project_files_count": len(project_files),
            "total_files_count": len(all_files),
            "is_clean": len(all_files) == 0
        }
    except Exception as e:
        logger.error(f"Error verifying cleanup: {str(e)}")
        return {
            "project_id": project_id,
            "error": str(e),
            "files_remaining": [],
            "is_clean": False
        }


@router.get("/r2-file-paths/{project_id}", response_model=Dict[str, Any])
async def get_project_file_paths(project_id: str):
    """
    Debug endpoint to get all tracked R2 file paths for a project.
    
    Args:
        project_id: The project ID to get file paths for
        
    Returns:
        List of tracked file paths
    """
    # Ensure project ID has correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Get tracked file paths
    files = await r2_file_tracking.get_project_files(project_id)
    
    return {
        "project_id": project_id,
        "files_count": len(files),
        "files": files
    }


@router.post("/cleanup-project/{project_id}", response_model=Dict[str, Any])
async def debug_cleanup_project(
    project_id: str,
    dry_run: bool = Query(True, description="Only list files without deleting"),
    mode: str = Query("auto", description="Deletion mode: auto, worker, tracked, pattern"),
):
    """
    Debug endpoint for cleaning up project storage.
    
    This endpoint allows testing different cleanup strategies:
    - 'auto': Use the default strategy order (worker > tracked > pattern)
    - 'worker': Use only the Cloudflare Worker approach
    - 'tracked': Use only tracked file paths
    - 'pattern': Use only pattern-based discovery
    
    By default, dry_run is True to prevent accidental deletion.
    """
    logger.info(f"Debug cleanup for project {project_id} (mode: {mode}, dry_run: {dry_run})")
    
    # For Worker-only mode
    if mode == "worker":
        logger.info("Using Worker-only mode")
        # Get tracked files
        files = await r2_file_tracking.get_project_files(project_id)
        if not files:
            return {"error": "No tracked files found for this project"}
        
        object_keys = [file.get("object_key") for file in files if file.get("object_key")]
        
        if dry_run:
            return {
                "dry_run": True,
                "mode": "worker",
                "keys": object_keys,
                "count": len(object_keys)
            }
        
        # Use Worker client directly
        result = await worker_client.delete_r2_objects(object_keys)
        
        # Delete tracking records
        if not dry_run:
            deleted_records = await r2_file_tracking.delete_project_files(project_id)
            result["tracking_records_deleted"] = deleted_records
            
        return result
    
    # For tracked-only mode
    elif mode == "tracked":
        # Modify the temp results to only use tracked files
        temp_settings_value = settings.use_worker_for_deletion
        settings.use_worker_for_deletion = False
        result = await cleanup_project_storage(project_id, dry_run)
        settings.use_worker_for_deletion = temp_settings_value
        return result
    
    # For pattern-only mode
    elif mode == "pattern":
        # Temporarily clear the tracked files
        files = await r2_file_tracking.get_project_files(project_id)
        temp_settings_value = settings.use_worker_for_deletion
        settings.use_worker_for_deletion = False
        
        # Backup the files
        backup_files = files.copy() if files else []
        
        # Clear the tracked files table for this project
        if files:
            await r2_file_tracking.delete_project_files(project_id)
        
        # Run the cleanup with pattern matching only
        result = await cleanup_project_storage(project_id, dry_run)
        
        # Restore the settings
        settings.use_worker_for_deletion = temp_settings_value
        
        # If we were just testing, restore the files
        if dry_run and backup_files:
            # We'd need to implement a restore function
            pass
            
        return result
    
    # For auto/default mode, use the normal cleanup process
    else:
        # Set worker mode based on settings
        return await cleanup_project_storage(project_id, dry_run)


@router.post("/test-delete-sync")
async def test_delete_sync():
    """Test endpoint to test synchronous file deletion."""
    import tempfile
    import os
    import uuid
    from app.core.config import settings
    from app.services.storage import get_storage

    # Create a test project ID with timestamp to ensure uniqueness
    import time
    project_id = f"test_proj_{int(time.time())}"

    # Create a temporary directory to store test files
    temp_dir = tempfile.mkdtemp()
    try:
        # Get storage instance
        storage = get_storage()
        
        # Create test files (5 small text files)
        files_created = []
        for i in range(5):
            file_path = os.path.join(temp_dir, f"test_file_{i}.txt")
            with open(file_path, "w") as f:
                f.write(f"This is test file {i} for project {project_id}")
            
            # Upload the file to R2
            object_key = f"{project_id}/test_file_{i}.txt"
            upload_result = await storage.upload_file(file_path, object_key)
            
            # Handle upload result based on its type
            upload_success = False
            if isinstance(upload_result, tuple):
                upload_success = upload_result[0]  # First element is success boolean
            elif isinstance(upload_result, dict):
                upload_success = upload_result.get("success", False)
            
            if upload_success:
                files_created.append(object_key)
                logger.info(f"Successfully uploaded test file: {object_key}")
            else:
                logger.error(f"Failed to upload test file: {object_key}")
                if isinstance(upload_result, tuple) and len(upload_result) > 1:
                    logger.error(f"Upload error: {upload_result[1]}")
                elif isinstance(upload_result, dict) and "error" in upload_result:
                    logger.error(f"Upload error: {upload_result.get('error')}")
        
        # List files in the project directory before deletion
        list_result = await storage.list_directory(project_id)
        files_before = []
        if isinstance(list_result, tuple) and list_result[0]:  # Check if success is True
            files_before = list_result[1]
        
        # Delete the files
        errors = []
        files_deleted = 0
        for file_key in files_created:
            try:
                result = await storage.delete_file(file_key)
                # Check result properly based on the return type from delete_file
                if isinstance(result, tuple):
                    # Handle tuple return (success, message)
                    if result[0]:
                        files_deleted += 1
                    else:
                        errors.append(f"Failed to delete {file_key}: {result[1]}")
                elif isinstance(result, dict):
                    # Handle dict return
                    if result.get("success", False):
                        files_deleted += 1
                    else:
                        errors.append(f"Failed to delete {file_key}: {result.get('error', 'Unknown error')}")
                elif result is True:
                    # Handle boolean success
                    files_deleted += 1
                else:
                    errors.append(f"Failed to delete {file_key}: Unexpected result type {type(result)}")
            except Exception as e:
                errors.append(f"Failed to delete {file_key}: {str(e)}")
        
        # List files after deletion
        list_result_after = await storage.list_directory(project_id)
        files_after = []
        if isinstance(list_result_after, tuple) and list_result_after[0]:  # Check if success is True
            files_after = list_result_after[1]
        
        return {
            "project_id": project_id,
            "files_created": len(files_created),
            "files_deleted": files_deleted,
            "files_remaining": len(files_after),
            "files_before": files_before,
            "files_after": files_after,
            "errors": errors,
            "success": len(errors) == 0
        }
    finally:
        # Clean up the temporary directory
        import shutil
        shutil.rmtree(temp_dir)
        logger.info(f"TEST-SYNC: Cleaned up temporary directory: {temp_dir}")


@router.post("/test-upload")
async def test_upload(project_id: str, num_files: int = 3):
    """Test endpoint to upload test files to a project."""
    import tempfile
    import os
    import time
    from app.core.config import settings
    from app.services.storage import get_storage

    # Create a temporary directory to store test files
    temp_dir = tempfile.mkdtemp()
    try:
        # Get storage instance
        storage = get_storage()
        
        # Create test files
        files_created = []
        for i in range(num_files):
            file_path = os.path.join(temp_dir, f"test_file_{i}_{int(time.time())}.txt")
            with open(file_path, "w") as f:
                f.write(f"This is test file {i} for project {project_id}")
            
            # Upload the file to R2
            object_key = f"{project_id}/test_file_{i}_{int(time.time())}.txt"
            
            # Handle the upload result based on its type
            upload_result = await storage.upload_file(file_path, object_key)
            upload_success = False
            
            if isinstance(upload_result, tuple):
                upload_success = upload_result[0]  # First element is success boolean
            elif isinstance(upload_result, dict):
                upload_success = upload_result.get("success", False)
                
            if upload_success:
                files_created.append(object_key)
                logger.info(f"Successfully uploaded test file: {object_key}")
            else:
                logger.error(f"Failed to upload test file: {object_key}")
        
        # List files in the project directory
        list_result = await storage.list_directory(project_id)
        files_in_project = []
        if isinstance(list_result, tuple) and list_result[0]:  # Check if success is True
            files_in_project = list_result[1]
        
        return {
            "project_id": project_id,
            "files_created": len(files_created),
            "files_in_project": files_in_project,
            "total_files": len(files_in_project),
            "success": len(files_created) == num_files
        }
    finally:
        # Clean up the temporary directory
        import shutil
        shutil.rmtree(temp_dir)
        logger.info(f"TEST-UPLOAD: Cleaned up temporary directory: {temp_dir}")


# --- Helper function for the background task with MORE logging ---
async def _cleanup_project_task(project_id: str):
    task_start_time = time.time() # Start timer
    logger.info(f"[BG Task - {project_id}] STARTING cleanup.")
    try:
        # Get a fresh storage instance within the task
        # This ensures it uses the correct event loop if needed
        storage = get_storage() 
        logger.debug(f"[BG Task - {project_id}] Obtained storage service instance.")
        
        # --- Call the actual cleanup function --- 
        logger.info(f"[BG Task - {project_id}] Calling cleanup_project_storage...")
        result = await cleanup_project_storage(project_id=project_id, storage_service=storage) 
        task_duration = time.time() - task_start_time # Calculate duration
        logger.info(f"[BG Task - {project_id}] FINISHED cleanup_project_storage. Duration: {task_duration:.2f}s. Result: {result}")
        # -----------------------------------------

    except ClientError as ce:
        # Catch specific botocore errors for more detail
        task_duration = time.time() - task_start_time
        logger.error(f"[BG Task - {project_id}] FAILED (ClientError). Duration: {task_duration:.2f}s. Error Code: {ce.response.get('Error', {}).get('Code')}, Message: {ce.response.get('Error', {}).get('Message')}", exc_info=True)
    except Exception as e:
        # Catch any other exceptions
        task_duration = time.time() - task_start_time
        logger.error(f"[BG Task - {project_id}] FAILED (General Exception). Duration: {task_duration:.2f}s. Error: {str(e)}", exc_info=True)

# --- Endpoint definition with detailed logging --- 
@router.post("/cleanup-test-data")
async def cleanup_test_data(
    request: CleanupRequest = Body(...),
    background_tasks: BackgroundTasks = None,
):
    """
    Cleanup test data based on project IDs or name patterns.
    This endpoint can be called with either:
    - A list of specific project IDs to delete
    - A list of name patterns to match against project names
    
    At least one of project_ids or name_patterns must be provided.
    """
    projects_to_delete = []
    errors = []
    
    # Check if database is in mock mode
    if db.is_mock:
        print("Database is in mock mode, performing simulated cleanup.")
        
        # Simulate cleanup with mock database
        if request.project_ids:
            print(f"Would clean up projects with IDs: {request.project_ids}")
            
        if request.name_patterns:
            print(f"Would clean up projects matching patterns: {request.name_patterns}")
        
        # Return simulated response
        return {
            "message": "Test data cleanup simulated (mock database is active)",
            "mock_mode": True,
            "ids_processed": len(request.project_ids) if request.project_ids else 0,
            "name_patterns_processed": len(request.name_patterns) if request.name_patterns else 0,
            "projects_deleted_db": 0,
            "r2_cleanup_scheduled": 0,
            "errors": []
        }
    
    # Regular database cleanup logic
    try:
        # Handle project_ids if provided
        if request.project_ids:
            for id_str in request.project_ids:
                try:
                    # Validate the ID format
                    if not ObjectId.is_valid(id_str):
                        errors.append(f"Invalid ID format for DB: {id_str}")
                        continue
                    
                    project_id = ObjectId(id_str)
                    project = db.projects.find_one({"_id": project_id})
                    
                    if project:
                        projects_to_delete.append(project)
                    else:
                        errors.append(f"Project not found for ID: {id_str}")
                except Exception as e:
                    errors.append(f"Error processing ID {id_str}: {str(e)}")
        
        # Handle name_patterns if provided
        if request.name_patterns:
            try:
                # Build a regex query to match any of the patterns
                name_query = {"name": {"$regex": f"({'|'.join(request.name_patterns)})", "$options": "i"}}
                matching_projects = list(db.projects.find(name_query))
                
                if matching_projects:
                    projects_to_delete.extend(matching_projects)
                    print(f"Found {len(matching_projects)} projects matching name patterns")
                else:
                    print("No projects found matching the provided name patterns")
            except Exception as e:
                errors.append(f"Error finding projects by name patterns: {str(e)}")
        
        # Check if we found any projects to delete
        if not projects_to_delete and not errors:
            return {
                "message": "No projects found to delete",
                "projects_deleted_db": 0,
                "r2_cleanup_scheduled": 0
            }
        
        # Delete projects from database and schedule R2 cleanup
        projects_deleted = 0
        r2_cleanup_scheduled = 0
        
        for project in projects_to_delete:
            try:
                project_id = project["_id"]
                # Delete from database
                db.projects.delete_one({"_id": project_id})
                projects_deleted += 1
                
                # Schedule R2 cleanup in background
                if background_tasks:
                    background_tasks.add_task(cleanup_project_storage, project_id)
                    r2_cleanup_scheduled += 1
                
                print(f"Deleted project {project.get('name', 'unnamed')} (ID: {project_id})")
            except Exception as e:
                errors.append(f"Error deleting project {project.get('_id')}: {str(e)}")
    except Exception as e:
        errors.append(f"Unexpected error during cleanup: {str(e)}")
    
    return {
        "message": "Test data cleanup request processed.",
        "ids_processed": len(projects_to_delete),
        "projects_deleted_db": projects_deleted,
        "r2_cleanup_scheduled": r2_cleanup_scheduled,
        "errors": errors
    }


# --- MODIFIED: Endpoint to START R2 bucket purge (Asynchronous with Job ID) --- 
@router.post("/purge-r2-bucket", response_model=Dict[str, str], status_code=status.HTTP_202_ACCEPTED)
async def start_purge_r2_bucket(background_tasks: BackgroundTasks, storage: Any = Depends(get_storage)):
    """
    *** DANGEROUS: Initiates background task to delete ALL objects in the configured R2 bucket. ***
    Use with extreme caution.
    Returns a job ID to track progress via /purge-r2-status/{job_id}.
    """
    job_id = str(uuid.uuid4())
    
    # Initialize job status
    purge_jobs[job_id] = {
        "status": "pending",
        "start_time": time.time(),
        "end_time": None,
        "total_targeted": 0,
        "total_deleted": 0,
        "errors": [],
        "last_error_batch": None
    }
    
    logger.info(f"Starting R2 purge job with ID: {job_id}")
    background_tasks.add_task(run_purge_task, job_id, storage)
    
    return {"message": "R2 bucket purge job initiated.", "job_id": job_id}

async def run_purge_task(job_id: str, storage: Any):
    """The actual background task performing the R2 purge."""
    purge_jobs[job_id]["status"] = "running"
    logger.warning(f"--- R2 Bucket Purge Task [{job_id}] Started --- ")
    
    bucket_name = storage.bucket_name
    
    # Get S3 client instance
    s3_client = None
    if hasattr(storage, 'get_s3_client'):
        s3_client = storage.get_s3_client()
    elif hasattr(storage, 's3'):
        s3_client = storage.s3
    else:
        err_msg = "Could not get S3 client from storage service."
        logger.error(f"[{job_id}] {err_msg}")
        purge_jobs[job_id]["status"] = "failed"
        purge_jobs[job_id]["errors"].append(err_msg)
        purge_jobs[job_id]["end_time"] = time.time()
        return
         
    objects_to_delete = []
    total_deleted_count = 0
    errors = []
    
    try:
        logger.info(f"[{job_id}] Listing all objects in bucket: {bucket_name}")
        paginator = s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=bucket_name)

        object_count = 0
        for page in pages:
            if 'Contents' in page:
                page_objects = [{'Key': obj['Key']} for obj in page['Contents']]
                objects_to_delete.extend(page_objects)
                object_count += len(page_objects)
                logger.debug(f"[{job_id}] Found {len(page_objects)} objects in page. Total found: {object_count}")
                # Update total count for status reporting
                purge_jobs[job_id]["total_targeted"] = object_count
            else:
                logger.info(f"[{job_id}] No objects found in this page.")

        if not objects_to_delete:
            logger.info(f"[{job_id}] Bucket is already empty. No objects to delete.")
            purge_jobs[job_id]["status"] = "completed"
            purge_jobs[job_id]["end_time"] = time.time()
            return

        logger.info(f"[{job_id}] Preparing to delete {len(objects_to_delete)} objects...")
        purge_jobs[job_id]["total_targeted"] = len(objects_to_delete) # Final target count

        # Delete objects in batches
        batch_size = 1000 # S3 limit
        for i in range(0, len(objects_to_delete), batch_size):
            batch = objects_to_delete[i:i + batch_size]
            logger.info(f"[{job_id}] Deleting batch {i // batch_size + 1}/{ (len(objects_to_delete) + batch_size - 1)//batch_size } ({len(batch)} objects)..." )
            try:
                response = s3_client.delete_objects(
                    Bucket=bucket_name,
                    Delete={'Objects': batch, 'Quiet': False} # Get detailed results
                )
                    
                if 'Deleted' in response:
                    deleted_count_batch = len(response['Deleted'])
                    total_deleted_count += deleted_count_batch
                    logger.info(f"[{job_id}] Successfully deleted {deleted_count_batch} objects in this batch.")
                    purge_jobs[job_id]["total_deleted"] = total_deleted_count # Update progress

                if 'Errors' in response and response['Errors']:
                    logger.error(f"[{job_id}] Errors occurred during deletion batch:")
                    purge_jobs[job_id]["last_error_batch"] = i // batch_size + 1
                    for error in response['Errors']:
                        err_msg = f"Error deleting {error['Key']}: {error['Code']} - {error['Message']}"
                        logger.error(f"[{job_id}]   - {err_msg}")
                        errors.append(err_msg)
                        purge_jobs[job_id]["errors"].append(err_msg)
                        
            except ClientError as e:
                err_msg = f"ClientError during batch deletion: {e}"
                logger.error(f"[{job_id}] {err_msg}")
                errors.append(err_msg)
                purge_jobs[job_id]["errors"].append(err_msg)
                purge_jobs[job_id]["status"] = "failed"
                purge_jobs[job_id]["end_time"] = time.time()
                return # Stop processing on batch error
            except Exception as e:
                err_msg = f"Unexpected error during batch deletion: {e}"
                logger.error(f"[{job_id}] {err_msg}")
                errors.append(err_msg)
                purge_jobs[job_id]["errors"].append(err_msg)
                purge_jobs[job_id]["status"] = "failed"
                purge_jobs[job_id]["end_time"] = time.time()
                return # Stop processing on batch error
            
            # Optional: add a small sleep between batches if rate limiting is suspected
            # await asyncio.sleep(0.1)

        # If loop completes without returning early due to error
        purge_jobs[job_id]["status"] = "completed"
        purge_jobs[job_id]["end_time"] = time.time()
        duration = purge_jobs[job_id]["end_time"] - purge_jobs[job_id]["start_time"]
        logger.warning(f"--- R2 Bucket Purge Task [{job_id}] Complete --- ")
        logger.info(f"Duration: {duration:.2f} seconds")
        logger.info(f"Targeted: {len(objects_to_delete)}, Successfully Deleted: {total_deleted_count}, Errors: {len(errors)}")
        
        return

    except ClientError as e:
        logger.error(f"[{job_id}] {err_msg}")
        purge_jobs[job_id]["errors"].append(err_msg)
        purge_jobs[job_id]["status"] = "failed"
        purge_jobs[job_id]["end_time"] = time.time()
    except Exception as e:
        err_msg = f"Unexpected error during purge operation: {e}"
        logger.error(f"[{job_id}] {err_msg}")
        purge_jobs[job_id]["errors"].append(err_msg)
        purge_jobs[job_id]["status"] = "failed"
        purge_jobs[job_id]["end_time"] = time.time()

# --- ADDED: Endpoint to check status of R2 bucket purge job --- 
@router.get("/purge-r2-status/{job_id}", response_model=Dict[str, Any])
async def get_purge_r2_status(job_id: str):
    """
    Check the status of an R2 bucket purge job initiated via POST /purge-r2-bucket.
    """
    job_status = purge_jobs.get(job_id)
    if not job_status:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Purge job with ID '{job_id}' not found.")
    
    # Calculate duration dynamically for the response
    current_status = job_status.copy() # Avoid modifying the original dict directly
    start_time = current_status.get("start_time")
    end_time = current_status.get("end_time")
    status_val = current_status.get("status")
    
    if end_time and start_time:
        current_status["duration_seconds"] = end_time - start_time
    elif status_val == "running" and start_time:
         current_status["duration_seconds"] = time.time() - start_time
    else:
         current_status["duration_seconds"] = None
         
    return current_status