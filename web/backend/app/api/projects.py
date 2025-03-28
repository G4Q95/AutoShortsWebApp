import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import motor.motor_asyncio
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, BackgroundTasks, Body, HTTPException, Response, status, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import MongoJSONEncoder, db
from app.core.errors import DatabaseError, NotFoundError, create_error_response, ErrorCodes
from app.models.project import Project, ProjectCreate, ProjectResponse
from app.services.video_processing import video_processor, process_project_video
from app.core.config import settings
from app.models.api import ApiResponse

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


# Custom JSON response for handling MongoDB ObjectId
class MongoJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return json.dumps(
            content,
            cls=MongoJSONEncoder,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


router = APIRouter(
    prefix="/projects",
    tags=["projects"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)


# Define models for project processing
class ProcessProjectRequest(BaseModel):
    mode: str = "custom"  # 'custom' or 'fast'


class ProcessProjectResponse(BaseModel):
    task_id: str
    message: str


# Simple in-memory task storage for project processing
project_processing_tasks = {}


@router.post(
    "/",
    response_model=ApiResponse[ProjectResponse],
    status_code=status.HTTP_201_CREATED,
    response_class=MongoJSONResponse,
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
            project_dict = project.dict()
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


@router.get("/", response_model=ApiResponse[List[ProjectResponse]])
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


@router.get("/{project_id}", response_model=ApiResponse[ProjectResponse])
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


@router.put("/{project_id}", response_model=ProjectResponse)
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


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_project(project_id: str, background_tasks: BackgroundTasks):
    """
    Delete a project by ID and clean up associated R2 storage.
    Returns no content on success.
    """
    try:
        obj_id = ObjectId(project_id)
    except InvalidId:
        error_response = create_error_response(
            status_code=status.HTTP_400_BAD_REQUEST,
            message="Invalid project ID format",
            error_code=ErrorCodes.VALIDATION_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_response
        )

    if not db.is_mock:
        try:
            # First verify project exists
            project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
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
                
            # Delete from database
            result = await db.client[db.db_name].projects.delete_one({"_id": obj_id})
            if result.deleted_count == 0:
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} not found",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            # Add R2 cleanup to background task - note we're using the enhanced implementation
            # The dry_run parameter is set to False to actually perform the deletion
            background_tasks.add_task(cleanup_project_storage, project_id, dry_run=False)
            
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        except Exception as e:
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
        # Mock deletion always succeeds, but still run cleanup
        background_tasks.add_task(cleanup_project_storage, project_id, dry_run=False)
        return Response(status_code=status.HTTP_204_NO_CONTENT)


async def cleanup_project_storage(project_id: str, dry_run: bool = False):
    """
    Remove all files for a project from storage using direct project ID matching.
    
    This function uses the project ID directly as a prefix to find and delete files.
    
    Args:
        project_id: The project ID to clean up
        dry_run: If True, will log what would be deleted without actually deleting
    
    Returns:
        Dict containing deletion results and stats
    """
    # Import the storage service correctly
    from app.services.storage import storage as storage_service
    
    logger.info(f"[CLEANUP-PROJECT] Beginning storage cleanup for project_id={project_id}")
    logger.info(f"[CLEANUP-PROJECT] Project ID type: {type(project_id)}, value: '{project_id}'")
    logger.info(f"[CLEANUP-PROJECT] Dry run mode: {dry_run}")
    
    # Track deletion results
    results = {
        "deleted_files": [],
        "failed_files": [],
        "total_files_deleted": 0,
        "total_bytes_freed": 0,
        "dry_run": dry_run
    }
    
    # Ensure the project ID has the proj_ prefix (if it doesn't already)
    project_id_with_prefix = project_id
    if not project_id.startswith("proj_"):
        project_id_with_prefix = f"proj_{project_id}"
    
    logger.info(f"[CLEANUP-PROJECT] Using project ID with prefix: {project_id_with_prefix}")
    
    try:
        # Get S3 client
        s3_client = await storage_service.get_s3_client()
        bucket_name = storage_service.bucket_name
        
        # List all objects in the bucket
        logger.info(f"[CLEANUP-PROJECT] Listing objects in bucket with prefix: {project_id_with_prefix}_")
        
        # Use a direct prefix search for files starting with the project ID followed by underscore
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(
            Bucket=bucket_name,
            Prefix=f"{project_id_with_prefix}_"  # This is key - we're searching for exact prefix match
        )
        
        # Collect files that match our prefix exactly
        files_to_delete = []
        
        # Check objects with our prefix
        async for page in page_iterator:
            if "Contents" not in page:
                continue
                
            for obj in page["Contents"]:
                obj_key = obj["Key"]
                obj_size = obj.get("Size", 0)
                
                # These files match our exact prefix, so we'll delete them
                files_to_delete.append({
                    "Key": obj_key,
                    "Size": obj_size
                })
                logger.info(f"[CLEANUP-PROJECT] Found matching file: {obj_key}")
        
        # Log summary of found files
        logger.info(f"[CLEANUP-PROJECT] Found {len(files_to_delete)} files with prefix {project_id_with_prefix}_")
        
        # Skip deletion if in dry run mode
        if dry_run:
            logger.info(f"[CLEANUP-PROJECT] DRY RUN - would delete {len(files_to_delete)} files:")
            for file in files_to_delete:
                logger.info(f"[CLEANUP-PROJECT] - Would delete: {file['Key']} ({file['Size']/1024:.2f} KB)")
            
            results["dry_run_matches"] = [f["Key"] for f in files_to_delete]
            results["dry_run_total_bytes"] = sum(f["Size"] for f in files_to_delete)
            
            return results
        
        # Process files in batches (S3 delete_objects has a limit of 1000 objects per request)
        batch_size = 500
        for i in range(0, len(files_to_delete), batch_size):
            batch = files_to_delete[i:i + batch_size]
            
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
                # Perform the deletion
                delete_response = await s3_client.delete_objects(
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
        logger.info(f"[CLEANUP-PROJECT] - Total files deleted: {results['total_files_deleted']}")
        logger.info(f"[CLEANUP-PROJECT] - Total storage freed: {results['total_bytes_freed']/1024/1024:.2f} MB")
        
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


@router.post("/{project_id}/process", response_model=ApiResponse[Dict[str, Any]])
async def process_project(
    project_id: str,
    request: ProcessProjectRequest,
    background_tasks: BackgroundTasks
):
    """
    Start processing a project into a video.
    Returns a standardized response with the processing task details.
    """
    try:
        # Generate a task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task info
        project_processing_tasks[task_id] = {
            "project_id": project_id,
            "status": "queued",
            "mode": request.mode
        }
        
        # Add processing task to background tasks
        background_tasks.add_task(
            process_project_video,
            project_id,
            task_id,
            project_processing_tasks,
            mode=request.mode
        )
        
        return ApiResponse(
            success=True,
            message="Project processing started",
            data={
                "task_id": task_id,
                "status": "queued",
                "project_id": project_id
            }
        )
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to start project processing: {str(e)}",
            error_code=ErrorCodes.ACTION_FAILED
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )


@router.get("/{project_id}/process/{task_id}", response_model=ApiResponse[Dict[str, Any]])
async def get_project_processing_status(project_id: str, task_id: str):
    """
    Get the status of a project processing task.
    Returns a standardized response with the task status.
    """
    try:
        if task_id not in project_processing_tasks:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message="Task not found",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )

        task_info = project_processing_tasks[task_id]

        # Check if the task is for the requested project
        if task_info["project_id"] != project_id:
            error_response = create_error_response(
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Task ID does not match project ID",
                error_code=ErrorCodes.VALIDATION_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_response
            )

        return ApiResponse(
            success=True,
            message="Task status retrieved successfully",
            data={
                "task_id": task_id,
                "status": task_info["status"],
                "project_id": project_id,
                "video_id": task_info.get("video_id"),
                "storage_url": task_info.get("storage_url"),
                "error": task_info.get("error")
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to retrieve task status: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )


async def process_project_background(task_id: str, project_id: str, mode: str):
    """
    Background task to process a project and create a video.
    """
    try:
        # Update status
        project_processing_tasks[task_id]["status"] = "processing"

        # Get project data - use same ID handling as in the endpoint
        try:
            if len(project_id) == 24 and all(c in "0123456789abcdef" for c in project_id.lower()):
                obj_id = ObjectId(project_id)
            else:
                obj_id = project_id
        except Exception:
            obj_id = project_id

        if not db.is_mock:
            # Use flexible query that works with both ObjectId and string IDs
            if isinstance(obj_id, ObjectId):
                project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
            else:
                # Try to find by string ID
                project = await db.client[db.db_name].projects.find_one(
                    {"$or": [{"_id": obj_id}, {"id": project_id}]}
                )

            if not project:
                # For development, use a mock project
                project = {
                    "_id": project_id,
                    "title": f"Mock Project {project_id}",
                    "scenes": [
                        {
                            "text_content": "This is a test scene for project processing.",
                            "url": "https://example.com/test",
                        }
                    ],
                }
        else:
            # Mock project data
            project = {
                "_id": project_id,
                "title": f"Mock Project {project_id}",
                "scenes": [
                    {
                        "text_content": "This is a test scene for project processing.",
                        "url": "https://example.com/test",
                    }
                ],
            }

        # Check if project has scenes
        if not project.get("scenes"):
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "Project has no scenes to process"
            return

        # Get combined text from scenes
        combined_text = ""
        for scene in project.get("scenes", []):
            text = scene.get("text_content", "")
            if text:
                combined_text += text + "\n\n"

        if not combined_text.strip():
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "No text content found in project scenes"
            return

        # In a real implementation, we would:
        # 1. Generate voice audio from the text
        # 2. Combine scene media with audio
        # 3. Create the final video

        # For now, simulate the process with a delay
        await asyncio.sleep(2)

        # Process the video (using a simplified approach)
        mock_user_id = "user123"
        success, video_info = await video_processor.create_video(
            text=combined_text,
            voice_path="mock_voice_path.mp3",  # Would be a real path in production
            title=project.get("title", "Untitled Project"),
            user_id=project.get("user_id", mock_user_id),
        )

        if success:
            # Update the task status
            project_processing_tasks[task_id]["status"] = "completed"
            project_processing_tasks[task_id]["video_id"] = video_info.get("video_id")
            project_processing_tasks[task_id]["storage_url"] = video_info.get("storage_url")

            # Update the project status in the database
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {
                        "$set": {
                            "status": "completed",
                            "video_id": video_info.get("video_id"),
                            "video_url": video_info.get("storage_url"),
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
        else:
            # Handle failure
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = video_info.get(
                "error", "Unknown error during video processing"
            )

            # Update project status
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {
                        "$set": {
                            "status": "error",
                            "error": video_info.get("error", "Unknown error"),
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )

    except Exception as e:
        # Handle any unexpected errors
        project_processing_tasks[task_id]["status"] = "failed"
        project_processing_tasks[task_id]["error"] = str(e)

        # Try to update project status
        try:
            if not db.is_mock:
                await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {"$set": {"status": "error", "error": str(e), "updated_at": datetime.utcnow()}},
                )
        except Exception as db_error:
            print(f"Failed to update project error status: {db_error}")
            pass


@router.get("/{project_id}/debug-cleanup", response_model=ApiResponse[Dict[str, Any]])
async def debug_cleanup_storage(project_id: str):
    """
    Debug endpoint to preview what files would be deleted during project cleanup.
    Performs a dry run of the storage cleanup functionality.
    """
    try:
        # Validate project ID format if needed
        try:
            obj_id = ObjectId(project_id)
        except InvalidId:
            # If it's not a valid ObjectId, proceed with the string version
            logger.warning(f"Project ID {project_id} is not a valid ObjectId, proceeding with string value")
            pass
        
        # Run cleanup with dry run enabled (no actual deletions)
        cleanup_results = await cleanup_project_storage(project_id, dry_run=True)
        
        # We need a simplified summary for the API response
        api_result = {
            "project_id": project_id,
            "files_found": len(cleanup_results.get("dry_run_matches", [])),
            "potential_storage_freed_bytes": cleanup_results.get("dry_run_total_bytes", 0),
            "potential_storage_freed_mb": cleanup_results.get("dry_run_total_bytes", 0) / (1024 * 1024),
            "is_dry_run": True,
            "first_few_files": cleanup_results.get("dry_run_matches", [])[:5]
        }
        
        # Add indication if there are more files
        if len(cleanup_results.get("dry_run_matches", [])) > 5:
            api_result["additional_files_count"] = len(cleanup_results.get("dry_run_matches", [])) - 5
        
        return ApiResponse(
            success=True,
            message=f"Found {api_result['files_found']} files that would be deleted for project {project_id}",
            data=api_result
        )
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to perform cleanup dry run: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )
