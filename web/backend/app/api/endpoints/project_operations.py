import logging
import re
import uuid
from datetime import datetime
from typing import List, Dict, Any

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Response, status

from app.core.config import settings
from app.core.database import db
from app.models.project import ProjectCreate, ProjectResponse
from app.core.errors import create_error_response, ErrorCodes
from app.models.api import ApiResponse
from app.services.storage import storage as storage_service
from app.services.r2_file_tracking import r2_file_tracking

logger = logging.getLogger(__name__)

project_router = APIRouter()

# --- Helper Functions --- 

async def cleanup_project_storage(project_id: str, dry_run: bool = False):
    """
    Remove all files for a project from storage using multiple matching strategies.
    
    This function uses aggressive pattern matching to find all files related to a project:
    1. Exact prefix matching
    2. Project ID matching (with and without prefix)
    3. Case-insensitive matching
    4. Pattern variants (common known formats)
    
    Args:
        project_id: The project ID to clean up
        dry_run: If True, will log what would be deleted without actually deleting
    
    Returns:
        Dict containing deletion results and stats
    """
    logger.info(f"[CLEANUP-PROJECT] Beginning storage cleanup for project_id={project_id}")
    logger.info(f"[CLEANUP-PROJECT] Project ID type: {type(project_id)}, value: '{project_id}'")
    logger.info(f"[CLEANUP-PROJECT] Dry run mode: {dry_run}")
    
    # Track deletion results
    results = {
        "deleted_files": [],
        "failed_files": [],
        "total_files_deleted": 0,
        "total_bytes_freed": 0,
        "dry_run": dry_run,
        "matching_strategies": {},  # Track files found via each strategy
    }
    
    # Normalize project ID and create variants for matching
    project_id_variations = {}
    
    # Original project ID (as provided)
    project_id_variations["original"] = project_id
    
    # With proj_ prefix if not already there
    if not project_id.startswith("proj_"):
        project_id_variations["with_prefix"] = f"proj_{project_id}"
    else:
        project_id_variations["with_prefix"] = project_id
        # Without proj_ prefix if it's already there
        project_id_variations["without_prefix"] = project_id.replace("proj_", "")
    
    # Clean version (alphanumeric only, lowercase)
    clean_id = re.sub(r'[^a-zA-Z0-9]', '', project_id.replace("proj_", "")).lower()
    project_id_variations["clean"] = clean_id
    
    # Log all variations
    for key, value in project_id_variations.items():
        logger.info(f"[CLEANUP-PROJECT] Project ID variation ({key}): '{value}'")
    
    try:
        # Get S3 client - remove await
        s3_client = storage_service.get_s3_client()
        bucket_name = storage_service.bucket_name
        
        # We'll collect all files to delete in this set (to avoid duplicates)
        files_to_delete = {}  # Using dict: Key -> {Size, MatchedBy}
        
        # STRATEGY 1: Direct prefix match with the standard format: proj_ID_
        logger.info(f"[CLEANUP-PROJECT] STRATEGY 1: Direct prefix matching")
        prefix = f"{project_id_variations['with_prefix']}_"
        logger.info(f"[CLEANUP-PROJECT] Using prefix pattern: '{prefix}'")
        
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        strategy1_count = 0
        # Change to regular for loop since paginator is not async
        for page in page_iterator:
            if "Contents" not in page:
                logger.info(f"[CLEANUP-PROJECT] No objects found with prefix: '{prefix}'")
                continue
                
            for obj in page["Contents"]:
                obj_key = obj["Key"]
                obj_size = obj.get("Size", 0)
                
                if obj_key not in files_to_delete:
                    files_to_delete[obj_key] = {
                        "Size": obj_size, 
                        "MatchedBy": ["prefix_match"]
                    }
                    strategy1_count += 1
                    logger.info(f"[CLEANUP-PROJECT] Found matching file via direct prefix: {obj_key}")
                else:
                    files_to_delete[obj_key]["MatchedBy"].append("prefix_match")
        
        logger.info(f"[CLEANUP-PROJECT] STRATEGY 1 found {strategy1_count} files")
        results["matching_strategies"]["prefix_match"] = strategy1_count
        
        # STRATEGY 2: Pattern variations - try with common formats
        logger.info(f"[CLEANUP-PROJECT] STRATEGY 2: Pattern variation matching")
        
        patterns = [
            # Standard pattern with proj_
            f"proj_{project_id_variations['without_prefix'] if 'without_prefix' in project_id_variations else project_id_variations['original']}",
            # Double prefix pattern
            f"proj_proj_{project_id_variations['without_prefix'] if 'without_prefix' in project_id_variations else project_id_variations['original']}",
            # Project ID directly - more specific patterns
            f"{project_id_variations['without_prefix'] if 'without_prefix' in project_id_variations else project_id_variations['original']}_",
            # Hierarchical patterns
            f"projects/{project_id_variations['with_prefix']}/",
            f"audio/{project_id_variations['with_prefix']}/",
            f"media/{project_id_variations['with_prefix']}/"
        ]
        
        # Log all patterns we're checking
        logger.info(f"[CLEANUP-PROJECT] Checking {len(patterns)} pattern variations:")
        for i, pattern in enumerate(patterns):
            logger.info(f"[CLEANUP-PROJECT] Pattern {i+1}: '{pattern}'")
        
        # Helper function for searching patterns
        async def search_pattern(pattern, label):
            nonlocal files_to_delete
            
            count = 0
            try:
                # Use the paginator to scan all objects
                pattern_iterator = paginator.paginate(
                    Bucket=bucket_name,
                    Prefix=pattern
                )
                
                # Change to regular for loop since paginator is not async
                for page in pattern_iterator:
                    if "Contents" not in page:
                        continue
                        
                    for obj in page["Contents"]:
                        obj_key = obj["Key"]
                        obj_size = obj.get("Size", 0)
                        
                        if obj_key not in files_to_delete:
                            files_to_delete[obj_key] = {
                                "Size": obj_size, 
                                "MatchedBy": [label]
                            }
                            count += 1
                            logger.info(f"[CLEANUP-PROJECT] Found matching file via {label}: {obj_key}")
                        else:
                            files_to_delete[obj_key]["MatchedBy"].append(label)
                            
                return count
            except Exception as e:
                logger.error(f"[CLEANUP-PROJECT] Error searching pattern '{pattern}': {str(e)}")
                return 0
        
        # Check all patterns
        for i, pattern in enumerate(patterns):
            pattern_label = f"pattern_{i+1}"
            pattern_count = await search_pattern(pattern, pattern_label)
            logger.info(f"[CLEANUP-PROJECT] Pattern {i+1} ('{pattern}') found {pattern_count} files")
            results["matching_strategies"][pattern_label] = pattern_count
        
        # STRATEGY 3: Scan all objects for any that contain the project ID variants
        logger.info(f"[CLEANUP-PROJECT] STRATEGY 3: Complete scan for project ID in filenames")
        
        # NOTE: This is potentially expensive for large buckets!
        all_objects_iterator = paginator.paginate(Bucket=bucket_name)
        
        # Keep track of which objects match which patterns
        strategy3_counts = {key: 0 for key in project_id_variations.keys()}
        
        # Change to regular for loop since paginator is not async
        for page in all_objects_iterator:
            if "Contents" not in page:
                continue
                
            for obj in page["Contents"]:
                obj_key = obj["Key"]
                obj_size = obj.get("Size", 0)
                
                # Try each project ID variant
                for variant_name, variant_value in project_id_variations.items():
                    # Skip empty or too short variants (avoid false positives)
                    if not variant_value or len(variant_value) < 5:
                        continue
                        
                    # Check if variant is contained in the object key (case sensitive)
                    if variant_value in obj_key:
                        match_label = f"contains_{variant_name}"
                        
                        if obj_key not in files_to_delete:
                            files_to_delete[obj_key] = {
                                "Size": obj_size, 
                                "MatchedBy": [match_label]
                            }
                            strategy3_counts[variant_name] += 1
                            logger.info(f"[CLEANUP-PROJECT] Found matching file contains_{variant_name}: {obj_key}")
                        else:
                            files_to_delete[obj_key]["MatchedBy"].append(match_label)
                            
                    # Also try case-insensitive matching
                    elif variant_value.lower() in obj_key.lower():
                        match_label = f"case_insensitive_{variant_name}"
                        
                        if obj_key not in files_to_delete:
                            files_to_delete[obj_key] = {
                                "Size": obj_size, 
                                "MatchedBy": [match_label]
                            }
                            strategy3_counts[variant_name] += 1
                            logger.info(f"[CLEANUP-PROJECT] Found matching file case_insensitive_{variant_name}: {obj_key}")
                        else:
                            files_to_delete[obj_key]["MatchedBy"].append(match_label)
        
        # Log results for strategy 3
        for variant_name, count in strategy3_counts.items():
            logger.info(f"[CLEANUP-PROJECT] Variant '{variant_name}' found {count} files")
            results["matching_strategies"][f"contains_{variant_name}"] = count
        
        # Summarize all matching results
        total_files = len(files_to_delete)
        logger.info(f"[CLEANUP-PROJECT] SUMMARY: Found {total_files} unique files to delete across all strategies")
        
        # Skip deletion if in dry run mode
        if dry_run:
            logger.info(f"[CLEANUP-PROJECT] DRY RUN - would delete {total_files} files:")
            for key, info in list(files_to_delete.items())[:10]:  # Show first 10
                logger.info(f"[CLEANUP-PROJECT] - Would delete: {key} ({info['Size']/1024:.2f} KB), matched by: {', '.join(info['MatchedBy'])}")
            
            if total_files > 10:
                logger.info(f"[CLEANUP-PROJECT] - ... and {total_files - 10} more files")
                
            results["dry_run_matches"] = list(files_to_delete.keys())
            results["dry_run_total_bytes"] = sum(info["Size"] for info in files_to_delete.values())
            
            return results
        
        # Convert to format needed for deletion
        files_to_delete_list = [{"Key": key, "Size": info["Size"]} for key, info in files_to_delete.items()]
        
        # Process files in batches (S3 delete_objects has a limit of 1000 objects per request)
        batch_size = 500
        for i in range(0, len(files_to_delete_list), batch_size):
            batch = files_to_delete_list[i:i + batch_size]
            
            # Skip empty batches
            if not batch:
                continue
                
            logger.info(f"[CLEANUP-PROJECT] Deleting batch of {len(batch)} files (batch {i//batch_size + 1})")
            
            # Log the first few files in this batch
            for j, file in enumerate(batch[:5]):
                logger.info(f"[CLEANUP-PROJECT] Batch {i//batch_size + 1}, file {j+1}: {file['Key']}")
            
            if len(batch) > 5:
                logger.info(f"[CLEANUP-PROJECT] ... and {len(batch) - 5} more files")
            
            # Prepare objects for deletion
            objects_to_delete = [{"Key": file["Key"]} for file in batch]
            
            # Add to bytes total
            batch_bytes = sum(file["Size"] for file in batch)
            results["total_bytes_freed"] += batch_bytes
            
            try:
                # Perform the deletion - remove await
                delete_response = s3_client.delete_objects(
                    Bucket=bucket_name,
                    Delete={"Objects": objects_to_delete}
                )
                
                # Record successful deletions
                if "Deleted" in delete_response:
                    for deleted in delete_response["Deleted"]:
                        results["deleted_files"].append(deleted["Key"])
                    
                    results["total_files_deleted"] += len(delete_response["Deleted"])
                    logger.info(f"[CLEANUP-PROJECT] Successfully deleted {len(delete_response['Deleted'])} files in batch")
                
                # Record failed deletions
                if "Errors" in delete_response:
                    for error in delete_response["Errors"]:
                        results["failed_files"].append({
                            "key": error.get("Key", "unknown"),
                            "code": error.get("Code", "unknown"),
                            "message": error.get("Message", "unknown")
                        })
                        logger.error(f"[CLEANUP-PROJECT] Failed to delete {error.get('Key')}: {error.get('Message')}")
            
            except Exception as e:
                logger.error(f"[CLEANUP-PROJECT] Error during batch deletion: {str(e)}")
                # Mark all files in this batch as failed
                for file in batch:
                    results["failed_files"].append({
                        "key": file["Key"],
                        "code": "BatchError",
                        "message": str(e)
                    })
        
        # Log summary of cleanup
        logger.info(f"[CLEANUP-PROJECT] Project cleanup summary for {project_id}:")
        logger.info(f"[CLEANUP-PROJECT] - Total files found: {total_files}")
        logger.info(f"[CLEANUP-PROJECT] - Total files deleted: {results['total_files_deleted']}")
        logger.info(f"[CLEANUP-PROJECT] - Total storage freed: {results['total_bytes_freed']/1024/1024:.2f} MB")
        
        # Log strategy results
        logger.info(f"[CLEANUP-PROJECT] - Files found by strategy:")
        for strategy, count in results["matching_strategies"].items():
            logger.info(f"[CLEANUP-PROJECT]   - {strategy}: {count}")
        
        if results["deleted_files"]:
            logger.info(f"[CLEANUP-PROJECT] - First few deleted files:")
            for file in results["deleted_files"][:5]:
                logger.info(f"[CLEANUP-PROJECT]   - {file}")
            
            if len(results["deleted_files"]) > 5:
                logger.info(f"[CLEANUP-PROJECT]   - ... and {len(results['deleted_files']) - 5} more files")
        else:
            logger.info("[CLEANUP-PROJECT] - No files were deleted")
        
        if results["failed_files"]:
            logger.warning(f"[CLEANUP-PROJECT] - Failed to delete {len(results['failed_files'])} files")
            for failure in results["failed_files"][:5]:
                logger.warning(f"[CLEANUP-PROJECT]   - {failure['key']}: {failure['message']}")
            
            if len(results["failed_files"]) > 5:
                logger.warning(f"[CLEANUP-PROJECT]   - ... and {len(results['failed_files']) - 5} more failures")
        
        return results
            
    except Exception as e:
        logger.error(f"[CLEANUP-PROJECT] Unexpected error during cleanup: {str(e)}")
        logger.exception("[CLEANUP-PROJECT] Exception details:")
        results["error"] = str(e)
        return results

# --- Moved Endpoint --- 

@project_router.get("/{project_id}", response_model=ApiResponse[ProjectResponse])
async def get_project(project_id: str):
    """
    Retrieve a specific project by ID.
    Returns a standardized response with the project data.
    """
    try:
        if not db.is_mock:
            mongo_db = db.get_db()
            project = await mongo_db.projects.find_one({"_id": project_id})
            
            if not project:
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} not found",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            # Format project for response
            formatted_project = {
                "id": str(project.get("_id")),
                "title": project.get("title", ""),
                "description": project.get("description"),
                "user_id": project.get("user_id"),
                "scenes": project.get("scenes", []),
                "created_at": project.get("created_at") or project.get("createdAt"),
                "updated_at": project.get("updated_at") or project.get("created_at"),
            }
            
            return ApiResponse(
                success=True,
                message="Project retrieved successfully",
                data=formatted_project
            )
        else:
            # Mock response
            return ApiResponse(
                success=True,
                message="Using mock database",
                data={
                    "id": project_id,
                    "title": "Mock Project",
                    "scenes": []
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to retrieve project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

# --- Moved Endpoint --- 

@project_router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, project_update: ProjectCreate = Body(...)):
    """
    Update a project by ID.
    """
    try:
        obj_id = ObjectId(project_id)
    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid project ID format")

    update_data = project_update.model_dump(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()

    if not db.is_mock:
        result = await db.client[db.db_name].projects.update_one(
            {"_id": obj_id}, {"$set": update_data}
        )

        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

        # Retrieve updated project
        updated_project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
        if updated_project:
            updated_project["id"] = str(updated_project["_id"])

            # Handle different field names for timestamps
            if "createdAt" in updated_project and "created_at" not in updated_project:
                updated_project["created_at"] = updated_project["createdAt"]

            # Ensure all required fields exist
            if "description" not in updated_project:
                updated_project["description"] = None
            if "user_id" not in updated_project:
                updated_project["user_id"] = None
            if "scenes" not in updated_project:
                updated_project["scenes"] = []

            return updated_project
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found after update")
    else:
        # Return mock data
        return {
            "id": project_id,
            **update_data,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

# --- Moved Endpoint --- 

@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_project(project_id: str, background_tasks: BackgroundTasks):
    """
    Delete a project by ID and clean up associated R2 storage.
    Returns no content on success.
    """
    deletion_request_id = str(uuid.uuid4())[:8]
    logger.info(f"[DELETION-{deletion_request_id}] Starting project deletion for {project_id}")
    
    is_object_id = False
    try:
        obj_id = ObjectId(project_id)
        is_object_id = True
    except InvalidId:
        logger.info(f"[DELETION-{deletion_request_id}] Project ID {project_id} is not a valid ObjectId, will try to find by proj_id field")
        is_object_id = False

    if not db.is_mock:
        try:
            project = None
            if is_object_id:
                project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
            else:
                if project_id.startswith("proj_"):
                    project = await db.client[db.db_name].projects.find_one({
                        "$or": [
                            {"proj_id": project_id},
                            {"name": project_id}
                        ]
                    })
                if not project and not project_id.startswith("proj_"):
                    prefixed_id = f"proj_{project_id}"
                    project = await db.client[db.db_name].projects.find_one({
                        "$or": [
                            {"proj_id": prefixed_id},
                            {"name": prefixed_id}
                        ]
                    })
            
            if not project:
                logger.warning(f"[DELETION-{deletion_request_id}] Project {project_id} not found in database")
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} not found",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            project_mongodb_id = project["_id"]
            logger.info(f"[DELETION-{deletion_request_id}] Found project, MongoDB ID: {project_mongodb_id}")
            
            result = await db.client[db.db_name].projects.delete_one({"_id": project_mongodb_id})
            if result.deleted_count == 0:
                logger.warning(f"[DELETION-{deletion_request_id}] Project {project_id} could not be deleted from database")
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} not found or could not be deleted",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            logger.info(f"[DELETION-{deletion_request_id}] Successfully deleted project from database")
            
            storage_project_id = project.get('proj_id')
            if not storage_project_id:
                if 'name' in project and project['name'].startswith('proj_'):
                    storage_project_id = project['name']
                else:
                    if project_id.startswith('proj_'):
                        storage_project_id = project_id
                    else:
                        storage_project_id = f"proj_{project_id}"
                    
            logger.info(f"[DELETION-{deletion_request_id}] Deleting project with storage ID: {storage_project_id}")
            
            # R2 cleanup call
            logger.info(f"[DELETION-{deletion_request_id}] Starting SYNCHRONOUS R2 cleanup")
            cleanup_result = await cleanup_project_storage(storage_project_id, dry_run=False)
            logger.info(f"[DELETION-{deletion_request_id}] Synchronous R2 cleanup completed with result: {cleanup_result}")
            
            # Schedule redundant background task for compatibility
            background_tasks.add_task(cleanup_project_storage, storage_project_id, dry_run=False)
            logger.info(f"[DELETION-{deletion_request_id}] Also scheduled background task for R2 cleanup (redundant)")
            
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"[DELETION-{deletion_request_id}] Failed to delete project: {str(e)}")
            logger.exception("Full traceback:")
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Failed to delete project: {str(e)}",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
    else:
        # Mock deletion
        storage_project_id = project_id
        if not storage_project_id.startswith("proj_"):
            storage_project_id = f"proj_{project_id}"
            
        logger.info(f"[DELETION-{deletion_request_id}] Mock database: Running cleanup for {storage_project_id}")
        
        logger.info(f"[DELETION-{deletion_request_id}] Starting SYNCHRONOUS R2 cleanup (mock database)")
        cleanup_result = await cleanup_project_storage(storage_project_id, dry_run=False)
        logger.info(f"[DELETION-{deletion_request_id}] Synchronous R2 cleanup completed with result: {cleanup_result}")
        
        background_tasks.add_task(cleanup_project_storage, storage_project_id, dry_run=False)
        logger.info(f"[DELETION-{deletion_request_id}] Also scheduled background task for R2 cleanup (redundant, mock database)")
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)

# --- Endpoint 2.4: GET /projects ---
@project_router.get("/projects", response_model=ApiResponse[List[ProjectResponse]])
async def get_projects():
    """
    Retrieve all projects.
    Returns a standardized response with the list of projects.
    """
    try:
        logger.debug("Retrieving all projects...")
        if not db.is_mock:
            try:
                # Get database reference
                mongo_db = db.get_db()
                logger.debug(f"Using database: {db.db_name}")

                # Get projects
                cursor = mongo_db.projects.find()
                projects_list = await cursor.to_list(length=100)

                logger.debug(f"Found {len(projects_list)} projects")

                # Process the projects for the response
                formatted_projects = []
                for project in projects_list:
                    # Create a clean project dictionary
                    processed_project = {
                        "id": str(project.get("_id")),
                        "title": project.get("title", ""),
                        "description": project.get("description"),
                        "user_id": project.get("user_id"),
                        "scenes": project.get("scenes", []),
                        "created_at": project.get("created_at") or project.get("createdAt"),
                        "updated_at": project.get("updated_at") or project.get("created_at"),
                    }
                    formatted_projects.append(processed_project)

                logger.debug("Returning projects list")
                return ApiResponse(
                    success=True,
                    message="Projects retrieved successfully",
                    data=formatted_projects
                )
            except Exception as e:
                logger.error(f"Database error: {str(e)}")
                logger.exception("Full traceback:")
                error_response = create_error_response(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message=f"Database error: {str(e)}",
                    error_code=ErrorCodes.DATABASE_ERROR
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_response
                )
        else:
            # Mock database response
            return ApiResponse(
                success=True,
                message="Using mock database",
                data=[]
            )
    except HTTPException:
        raise
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Unexpected error: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

# --- Endpoint 2.5: POST /projects ---
@project_router.post(
    "/projects", # Maintain the correct full path 
    response_model=ApiResponse[ProjectResponse],
    status_code=status.HTTP_201_CREATED,
    # Note: Original used MongoJSONResponse, keep standard for now unless issues arise
)
async def create_project(project: ProjectCreate = Body(...)):
    """
    Create a new project.
    Returns a standardized response with the created project.
    """
    try:
        if not db.is_mock:
            # Get database reference
            mongo_db = db.get_db()

            # Create project document
            project_dict = project.model_dump() # Use model_dump() instead of dict()
            project_dict["created_at"] = datetime.utcnow()
            project_dict["updated_at"] = project_dict["created_at"]

            # Insert into database
            result = await mongo_db.projects.insert_one(project_dict)
            project_id = result.inserted_id

            # Get the created project
            created_project = await mongo_db.projects.find_one({"_id": project_id})
            if not created_project:
                error_response = create_error_response(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    message="Project was created but could not be retrieved",
                    error_code=ErrorCodes.DATABASE_ERROR
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_response
                )

            # Format project for response
            formatted_project = {
                "id": str(created_project["_id"]),
                "title": created_project["title"],
                "description": created_project.get("description"),
                "user_id": created_project.get("user_id"),
                "scenes": created_project.get("scenes", []),
                "created_at": created_project["created_at"],
                "updated_at": created_project["updated_at"],
            }

            return ApiResponse(
                success=True,
                message="Project created successfully",
                data=formatted_project
            )
        else:
            # Mock database response
            mock_id = str(ObjectId())
            mock_project = {
                "id": mock_id,
                "title": project.title,
                "description": project.description,
                "user_id": project.user_id,
                "scenes": project.scenes,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            return ApiResponse(
                success=True,
                message="Project created successfully (mock)",
                data=mock_project
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to create project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

# --- Placeholder for next endpoint --- 
# Other project endpoints will be added here 


# --- End of File --- 