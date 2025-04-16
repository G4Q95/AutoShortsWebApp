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
from pydantic import BaseModel, Field

from app.core.database import MongoJSONEncoder, db
from app.core.errors import DatabaseError, NotFoundError, create_error_response, ErrorCodes
from app.models.project import Project, ProjectCreate, ProjectResponse
from app.services.video_processing import video_processor, process_project_video
from app.core.config import settings
from app.models.api import ApiResponse
from app.services.project import cleanup_project_storage

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

        project = None
        if not db.is_mock:
            logger.debug(f"Background task {task_id}: Looking up project {project_id} (ObjectId: {obj_id if isinstance(obj_id, ObjectId) else 'N/A'})")
            if isinstance(obj_id, ObjectId):
                project = await db.client[db.db_name].projects.find_one({"_id": obj_id})
            else:
                project = await db.client[db.db_name].projects.find_one(
                    {"$or": [{"_id": obj_id}, {"id": project_id}]}
                )

            if not project:
                logger.warning(f"Project {project_id} not found in DB for background processing, task {task_id}. Using mock project data.")
                project = {
                    "_id": project_id,
                    "title": f"Mock Project {project_id}",
                    "scenes": [
                        {
                            "text": "This is a mock scene for a non-existent project.",
                            "url": "https://example.com/mock",
                        }
                    ],
                    "user_id": "mock_user"
                }
        else:
            logger.debug(f"Background task {task_id}: Using mock database for project {project_id}")
            project = {
                "_id": project_id,
                "title": f"Mock Project {project_id}",
                "scenes": [
                    {
                        "text": "This is a mock scene.",
                        "url": "https://example.com/mock",
                    }
                ],
                 "user_id": "mock_user"
            }

        scenes = project.get("scenes", [])
        if not scenes:
            logger.error(f"Background task {task_id} failed: Project {project_id} has no scenes.")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "Project has no scenes to process"
            return

        combined_text = ""
        for scene in scenes:
            text = scene.get("text", "")
            if text:
                combined_text += text.strip() + "\n\n"

        if not combined_text.strip():
            logger.error(f"Background task {task_id} failed: No text content found in project {project_id} scenes.")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "No text content found in project scenes"
            return

        logger.info(f"Background task {task_id}: Simulating video creation for project {project_id} with combined text length: {len(combined_text)}")
        await asyncio.sleep(2)

        mock_user_id = project.get("user_id", "user123")
        success = False
        video_info = {}
        try:
            logger.debug(f"Task {task_id}: Calling video_processor.create_video")
            success, video_info = await video_processor.create_video(
                text=combined_text,
                voice_path="mock_voice_path.mp3",
                title=project.get("title", "Untitled Project"),
                user_id=mock_user_id,
            )
            logger.debug(f"Task {task_id}: video_processor.create_video returned: success={success}, info={video_info}")
        except Exception as video_err:
            logger.exception(f"Error calling video_processor.create_video for task {task_id}")
            success = False
            video_info = {"error": f"Video processing service error: {str(video_err)}"}

        if success:
            logger.info(f"Background task {task_id}: Video processing simulation completed successfully for project {project_id}")
            project_processing_tasks[task_id]["status"] = "completed"
            project_processing_tasks[task_id]["video_id"] = video_info.get("video_id")
            project_processing_tasks[task_id]["storage_url"] = video_info.get("storage_url")

            if not db.is_mock:
                logger.info(f"Task {task_id}: Updating project {project_id} status to completed in DB.")
                update_result = await db.client[db.db_name].projects.update_one(
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
                logger.info(f"Task {task_id}: DB update result for completed status: matched={update_result.matched_count}, modified={update_result.modified_count}")
        else:
            error_message = video_info.get("error", "Unknown error during video processing")
            logger.error(f"Background task {task_id} failed for project {project_id}. Error: {error_message}")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = error_message

            if not db.is_mock:
                logger.info(f"Task {task_id}: Updating project {project_id} status to error in DB.")
                update_result = await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {
                        "$set": {
                            "status": "error",
                            "error": error_message,
                            "updated_at": datetime.utcnow(),
                        }
                    },
                )
                logger.info(f"Task {task_id}: DB update result for error status: matched={update_result.matched_count}, modified={update_result.modified_count}")

    except Exception as e:
        logger.exception(f"Unexpected fatal error in background task {task_id} for project {project_id}")
        project_processing_tasks[task_id]["status"] = "failed"
        project_processing_tasks[task_id]["error"] = f"Fatal task error: {str(e)}"

        try:
            if not db.is_mock:
                if 'obj_id' not in locals():
                    try:
                        if len(project_id) == 24 and all(c in "0123456789abcdef" for c in project_id.lower()):
                            obj_id = ObjectId(project_id)
                        else:
                            obj_id = project_id
                    except Exception:
                        obj_id = project_id

                logger.info(f"Task {task_id}: Attempting to update project {project_id} status to error in DB due to fatal task exception.")
                update_result = await db.client[db.db_name].projects.update_one(
                    {"_id": obj_id},
                    {"$set": {"status": "error", "error": f"Fatal task error: {str(e)}", "updated_at": datetime.utcnow()}},
                )
                logger.info(f"Task {task_id}: DB update result for fatal error status: matched={update_result.matched_count}, modified={update_result.modified_count}")
        except Exception as db_error:
            logger.error(f"Task {task_id}: Failed to update project {project_id} error status in DB after fatal task exception: {db_error}")
            pass


@router.get("/{project_id}/debug-cleanup", response_model=ApiResponse[Dict[str, Any]])
async def debug_cleanup_storage(project_id: str):
    """
    Debug endpoint to preview what files would be deleted during project cleanup.
    Performs a dry run of the storage cleanup functionality.
    """
    try:
        logger.info(f"Initiating debug cleanup dry run for project: {project_id}")

        cleanup_results = await cleanup_project_storage(project_id, dry_run=True)
        logger.info(f"Debug cleanup dry run results for {project_id}: {cleanup_results}")

        files_found = cleanup_results.get("dry_run_matches", [])
        total_bytes = cleanup_results.get("dry_run_total_bytes", 0)
        api_result = {
            "project_id": project_id,
            "files_found_count": len(files_found),
            "potential_storage_freed_bytes": total_bytes,
            "potential_storage_freed_mb": total_bytes / (1024 * 1024) if total_bytes > 0 else 0,
            "is_dry_run": True,
            "first_few_files": files_found[:10]
        }

        if len(files_found) > 10:
            api_result["additional_files_count"] = len(files_found) - 10

        return ApiResponse(
            success=True,
            message=f"Found {api_result['files_found_count']} files that would be deleted for project {project_id}",
            data=api_result
        )
    except ImportError:
         logger.error("Failed to import cleanup_project_storage for debug endpoint. Ensure app.services.project.cleanup_project_storage exists.")
         error_response = create_error_response(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             message="Cleanup function dependency not found.",
             error_code=ErrorCodes.INTERNAL_SERVER_ERROR
         )
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail=error_response
         )
    except Exception as e:
        logger.exception(f"Error in debug cleanup endpoint for {project_id}")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to perform cleanup dry run: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )


# --- Scene Trim Update Models ---
class SceneTrimUpdateRequest(BaseModel):
    """Request model for updating scene trim data."""
    trim_start: float = Field(..., description="Start time for trim in seconds", ge=0.0)
    trim_end: Optional[float] = Field(None, description="End time for trim in seconds, null means to end of clip")


class SceneTrimUpdateResponse(BaseModel):
    """Response model for scene trim update."""
    scene_id: str
    trim_start: float
    trim_end: Optional[float]
    project_id: str
    success: bool


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project and its associated data",
    description="Deletes a project from the database and attempts to clean up associated files from R2 storage.",
)
async def delete_project_endpoint(project_id: str):
    """
    Deletes a project by its ID.

    - Fetches the project to identify associated files.
    - Calls the cleanup service to remove files from R2 storage.
    - Deletes the project document from the MongoDB database.
    """
    logger.info(f"Received request to delete project: {project_id}")

    # Convert project_id to ObjectId if applicable, handle potential errors
    try:
        if len(project_id) == 24 and all(c in "0123456789abcdef" for c in project_id.lower()):
            obj_id = ObjectId(project_id)
            query = {"_id": obj_id}
            logger.debug(f"Using ObjectId for query: {obj_id}")
        else:
            # Fallback to using the string ID if it's not a valid ObjectId format
            query = {"$or": [{"_id": project_id}, {"id": project_id}]}
            logger.debug(f"Using string ID for query: {project_id}")
    except InvalidId:
        logger.warning(f"Invalid format for project_id: {project_id}. Using as string ID.")
        query = {"$or": [{"_id": project_id}, {"id": project_id}]}
    except Exception as e:
        logger.error(f"Error processing project_id '{project_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project ID format: {project_id}"
        )

    # 1. Attempt to clean up R2 storage first (fail-safe, continue even if this fails)
    try:
        logger.info(f"Attempting R2 cleanup for project: {project_id}")
        cleanup_results = await cleanup_project_storage(project_id, dry_run=False)
        deleted_count = cleanup_results.get("deleted_count", 0)
        failed_count = cleanup_results.get("failed_count", 0)
        total_bytes = cleanup_results.get("total_bytes_deleted", 0)
        logger.info(
            f"R2 cleanup for project {project_id} finished: "
            f"Deleted {deleted_count} files, Failed {failed_count} files, Freed {total_bytes} bytes."
        )
        if failed_count > 0:
             logger.warning(f"Encountered {failed_count} failures during R2 cleanup for project {project_id}.")
        # We don't raise an error here, deletion from DB is more critical

    except Exception as cleanup_error:
        logger.error(f"Error during R2 cleanup for project {project_id}: {cleanup_error}", exc_info=True)
        # Log the error but proceed to database deletion attempt

    # 2. Delete the project from the database
    try:
        logger.info(f"[DELETE {project_id}] Attempting MongoDB deletion.") # Log start
        logger.debug(f"[DELETE {project_id}] Using query: {query}") # Log the exact query
        
        delete_result = await db.client[db.db_name].projects.delete_one(query)
        
        # Log the raw result from MongoDB
        logger.debug(f"[DELETE {project_id}] MongoDB delete_one result: acknowledged={delete_result.acknowledged}, deleted_count={delete_result.deleted_count}")

        if delete_result.deleted_count == 0:
            logger.warning(f"[DELETE {project_id}] Project not found in database for deletion (query: {query}). Raising 404.")
            # Return 404 even if R2 cleanup happened, as the primary resource wasn\'t found
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Project {project_id} not found")

        logger.info(f"[DELETE {project_id}] Successfully deleted project from database (deleted count: {delete_result.deleted_count}). Returning 204.")

        # Return HTTP 204 No Content on successful deletion
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except HTTPException as http_exc:
         # Re-raise HTTP exceptions (like the 404 above)
         raise http_exc
    except Exception as db_error:
        logger.error(f"Database error deleting project {project_id}: {db_error}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project {project_id} from database.",
        )
