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

from fastapi import APIRouter, Query, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.services.storage import get_storage
from app.services.r2_file_tracking import r2_file_tracking
from app.services.project import cleanup_project_storage
from app.models.storage import R2FilePathCreate
from app.db.database import get_db_client
from app.models.project import Project

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])

# Define Pydantic model for the request body
class CleanupTestDataRequest(BaseModel):
    prefix: Optional[str] = "Test Project"


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


# New endpoint for cleaning up test data
@router.post("/cleanup-test-data", response_model=Dict[str, Any])
async def cleanup_test_data(
    request: CleanupTestDataRequest,
    background_tasks: BackgroundTasks,
    # Assuming get_db_client dependency injection or similar mechanism
    db = Depends(get_db_client) 
):
    """
    Finds projects by name prefix, deletes their DB entries, 
    and schedules R2 cleanup via background task.
    """
    prefix = request.prefix
    logger.info(f"Starting test data cleanup for projects with prefix: '{prefix}'")
    
    projects_found = 0
    projects_deleted_db = 0
    r2_cleanup_scheduled = 0
    errors = []

    try:
        # --- Database Interaction Logic ---
        # This part is conceptual and depends on your DB interaction setup.
        # You'll need to replace this with your actual DB query logic.
        
        # Example using MongoDB (adjust collection name and field as needed)
        project_collection = db["projects"] 
        # Find projects where 'name' starts with the prefix (case-insensitive)
        project_cursor = project_collection.find(
            {"name": {"$regex": f"^{prefix}", "$options": "i"}}
        )
        
        projects_to_delete = await project_cursor.to_list(length=None) # Get all matching projects
        projects_found = len(projects_to_delete)
        logger.info(f"Found {projects_found} projects matching prefix '{prefix}'.")

        if not projects_to_delete:
            logger.info("No projects found to delete.")
            return {
                "message": "No projects found matching the prefix.",
                "prefix": prefix,
                "projects_found": 0,
                "projects_deleted_db": 0,
                "r2_cleanup_scheduled": 0,
            }

        for project_data in projects_to_delete:
            project_id = str(project_data.get("_id")) # Assuming '_id' is the primary key
            project_name = project_data.get("name", "Unknown")
            
            if not project_id:
                logger.warning(f"Skipping project with missing ID: {project_data}")
                errors.append(f"Project missing ID: {project_name}")
                continue

            # 1. Delete project document from DB
            try:
                delete_result = await project_collection.delete_one({"_id": project_data["_id"]})
                if delete_result.deleted_count == 1:
                    logger.info(f"Deleted project document '{project_name}' (ID: {project_id}) from database.")
                    projects_deleted_db += 1
                    
                    # 2. Schedule R2 cleanup
                    # Use the correct project_id format if needed (e.g., adding "proj_")
                    storage_project_id = project_id 
                    if not storage_project_id.startswith("proj_"):
                         storage_project_id = f"proj_{project_id}" # Adjust if your cleanup needs this format

                    logger.info(f"Scheduling R2 cleanup for project ID: {storage_project_id}")
                    background_tasks.add_task(cleanup_project_storage, storage_project_id)
                    r2_cleanup_scheduled += 1
                else:
                    logger.warning(f"Failed to delete project document '{project_name}' (ID: {project_id}) from database.")
                    errors.append(f"DB delete failed for: {project_name} ({project_id})")
            except Exception as db_err:
                logger.error(f"Error deleting project document '{project_name}' (ID: {project_id}): {db_err}")
                errors.append(f"DB error for {project_name} ({project_id}): {db_err}")

        logger.info(f"Test data cleanup finished for prefix '{prefix}'.")
        summary = {
            "message": "Test data cleanup process initiated.",
            "prefix": prefix,
            "projects_found": projects_found,
            "projects_deleted_db": projects_deleted_db,
            "r2_cleanup_scheduled": r2_cleanup_scheduled,
            "errors": errors,
        }
        return summary

    except Exception as e:
        logger.exception(f"An unexpected error occurred during test data cleanup for prefix '{prefix}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cleanup failed: {str(e)}"
        ) 