from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging
import asyncio
from datetime import datetime

from ...core.errors import DatabaseError, NotFoundError, create_error_response, ErrorCodes
from ...core.database import db
from ...core.auth import get_current_user
from ...models.api import ApiResponse
from ...models.user import User
from ...services.video_processing import video_processor, process_project_video

# Configure logging
logger = logging.getLogger(__name__)

# Create router
generation_router = APIRouter(
    prefix="/generation",
    tags=["generation"],
)

# Define models for project processing
class ProcessProjectRequest(BaseModel):
    mode: str = "custom"  # 'custom' or 'fast'

# Simple in-memory task storage for project processing
project_processing_tasks = {}

@generation_router.post("/{project_id}", response_model=ApiResponse[Dict[str, Any]])
async def process_project(
    project_id: str,
    request: ProcessProjectRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """
    Start processing a project into a video.
    Returns a standardized response with the processing task details.
    """
    try:
        # Create a unique task ID for this processing request
        task_id = f"task_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{project_id}"
        
        # Initialize task tracking
        project_processing_tasks[task_id] = {
            "project_id": project_id,
            "status": "queued",
            "mode": request.mode,
            "created_at": datetime.utcnow()
        }
        
        # Add processing task to background tasks
        background_tasks.add_task(
            process_project_background,
            task_id,
            project_id,
            request.mode
        )
        
        return ApiResponse(
            success=True,
            message="Project processing started",
            data={"task_id": task_id, "project_id": project_id, "status": "queued"}
        )
    except Exception as e:
        logger.error(f"Error starting project processing: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to start project processing: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@generation_router.get("/{project_id}/{task_id}", response_model=ApiResponse[Dict[str, Any]])
async def get_project_processing_status(
    project_id: str, 
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get the status of a project processing task.
    """
    try:
        # Check if task exists
        if task_id not in project_processing_tasks:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Processing task {task_id} not found",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )
        
        # Get task info
        task_info = project_processing_tasks[task_id]
        
        # Return task status
        return ApiResponse(
            success=True,
            message=f"Processing task status: {task_info['status']}",
            data={
                "task_id": task_id,
                "project_id": project_id,
                "status": task_info["status"],
                "video_id": task_info.get("video_id"),
                "storage_url": task_info.get("storage_url"),
                "error": task_info.get("error")
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting processing status: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to get processing status: {str(e)}",
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
        logger.info(f"Starting background processing for project {project_id}, task {task_id}")
        
        # Update task status to processing
        project_processing_tasks[task_id]["status"] = "processing"
        
        # Get database reference
        mongo_db = db.get_db()
        
        # Get project
        project = await mongo_db.projects.find_one({"_id": project_id})
        if not project:
            logger.error(f"Project {project_id} not found")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = f"Project {project_id} not found"
            return
        
        # Check if project has scenes
        scenes = project.get("scenes", [])
        if not scenes:
            # In a real-world scenario, this would return an error
            # For demonstration, we'll create a mock scene
            if mode == "fast":
                # Just add a simple scene for fast mode
                scenes = [{
                    "id": f"mock_scene_{datetime.utcnow().timestamp()}",
                    "text_content": "This is a test scene for project processing.",
                    "media": {
                        "type": "image",
                        "url": "https://via.placeholder.com/1080x1920",
                    }
                }]
            else:
                # For custom mode, add a couple of scenes
                scenes = [
                    {
                        "id": f"mock_scene_1_{datetime.utcnow().timestamp()}",
                        "text_content": "This is a test scene for project processing.",
                        "media": {
                            "type": "image",
                            "url": "https://via.placeholder.com/1080x1920",
                        }
                    },
                    {
                        "id": f"mock_scene_2_{datetime.utcnow().timestamp()}",
                        "media": {
                            "type": "video",
                            "url": "https://example.com/mock_video.mp4",
                        }
                    }
                ]
        
        # Check if any scene has text content
        has_text_content = any(scene.get("text_content") for scene in scenes)
        if not has_text_content:
            logger.error(f"No text content found in project {project_id} scenes")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = "No text content found in project scenes"
            return
        
        # 1. Generate audio for each scene with text
        # 2. Combine scene media with audio
        # 3. Create final video
        
        # For now, simulate the process with a delay
        await asyncio.sleep(2)  # Simulates processing time
        
        # Process the video (using a simplified approach)
        logger.info(f"Processing video for project {project_id}")
        success, video_info = await video_processor.create_video(
            project,
            mode=mode
        )
        
        if success:
            logger.info(f"Video processing completed for project {project_id}")
            # Update task status
            project_processing_tasks[task_id]["status"] = "completed"
            project_processing_tasks[task_id]["video_id"] = video_info.get("video_id")
            project_processing_tasks[task_id]["storage_url"] = video_info.get("storage_url")
            
            # Update project in database with video information
            await mongo_db.projects.update_one(
                {"_id": project_id},
                {"$set": {
                    "latest_video": {
                        "video_id": video_info.get("video_id"),
                        "storage_url": video_info.get("storage_url"),
                        "created_at": datetime.utcnow(),
                        "status": "completed"
                    },
                    "updated_at": datetime.utcnow()
                }}
            )
        else:
            logger.error(f"Video processing failed for project {project_id}: {video_info.get('error')}")
            project_processing_tasks[task_id]["status"] = "failed"
            project_processing_tasks[task_id]["error"] = video_info.get(
                "error", "Unknown error during video processing"
            )
            
            # Update project in database with failure information
            await mongo_db.projects.update_one(
                {"_id": project_id},
                {"$set": {
                    "latest_video": {
                        "status": "failed",
                        "error": video_info.get("error", "Unknown error during video processing"),
                        "created_at": datetime.utcnow()
                    },
                    "updated_at": datetime.utcnow()
                }}
            )
    except Exception as e:
        logger.error(f"Error in background processing for project {project_id}: {str(e)}")
        logger.exception("Full traceback:")
        
        # Update task status to failed
        project_processing_tasks[task_id]["status"] = "failed"
        project_processing_tasks[task_id]["error"] = str(e)
        
        # Try to update project in database with failure information
        try:
            mongo_db = db.get_db()
            await mongo_db.projects.update_one(
                {"_id": project_id},
                {"$set": {
                    "latest_video": {
                        "status": "failed",
                        "error": str(e),
                        "created_at": datetime.utcnow()
                    },
                    "updated_at": datetime.utcnow()
                }}
            )
        except Exception as inner_e:
            logger.error(f"Failed to update project with error information: {str(inner_e)}") 