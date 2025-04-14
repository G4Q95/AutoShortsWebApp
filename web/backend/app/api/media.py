"""
Media API for handling media uploads, downloads, and transformations.
"""

import logging
import asyncio  # Add asyncio import
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Query, BackgroundTasks
from pydantic import BaseModel, HttpUrl, Field

from app.core.errors import create_error_response, ErrorCodes
from app.models.api import ApiResponse
from app.services.media_service import store_media_content, MediaType
from app.services.audio_service import AudioService # Import AudioService
from app.dependencies import get_audio_service # Import dependency getter
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/media",
    tags=["media"],
)

# Media store request model
class MediaStoreRequest(BaseModel):
    """Request model for storing media from a URL."""
    url: HttpUrl = Field(..., description="URL of the media to download and store")
    project_id: str = Field(..., description="Project ID the media belongs to")
    scene_id: str = Field(..., description="Scene ID the media belongs to")
    user_id: str = Field(..., description="User ID owning the project")
    media_type: Optional[str] = Field(None, description="Type of media (image, video, audio)")
    create_thumbnail: Optional[bool] = Field(False, description="Whether to create a thumbnail")

# Media store queued response model
class MediaStoreQueuedResponse(BaseModel):
     """Response model indicating media storage task was queued."""
     task_id: str = Field(..., description="The ID of the queued Celery background task.")

@router.post("/store", response_model=MediaStoreQueuedResponse)
async def store_media_from_url(
    request: MediaStoreRequest, 
):
    """
    Queues a background task to store media from a URL.
    
    Args:
        request: The request body containing URL, project_id, scene_id, etc.
        
    Returns:
        Response containing the ID of the queued background task.
    """
    logger.info(f"Media store request received for URL: {request.url}")
    logger.info(f"Project ID: {request.project_id}, Scene ID: {request.scene_id}")
    # media_type and create_thumbnail are passed but handled by the Celery task
    
    try:
        # Call the updated service function which now returns a task_id dict
        result = await store_media_content(
            url=str(request.url),
            project_id=request.project_id,
            scene_id=request.scene_id,
            user_id=request.user_id,
            media_type=request.media_type, # Pass along for potential future use in task
            create_thumbnail=request.create_thumbnail # Pass along for potential future use in task
        )
        
        # store_media_content now returns {"task_id": task_result.id}
        task_id = result.get("task_id")

        if not task_id:
             # This shouldn't happen if store_media_content works correctly
             logger.error("store_media_content did not return a task_id")
             raise HTTPException(status_code=500, detail="Failed to queue download task: No task ID returned.")
        
        logger.info(f"Media download/store task queued with ID: {task_id}")

        # Return the new response model with the task ID
        return MediaStoreQueuedResponse(task_id=task_id)

    except HTTPException as e:
        # Log and re-raise HTTP exceptions from the service layer or validation
        logger.error(f"HTTP error queuing media store task: {e.detail}")
        raise
    except Exception as e:
        # Catch other unexpected errors (e.g., Celery connection issues during .delay())
        logger.error(f"Unexpected error queuing media store task: {str(e)}", exc_info=True)
        # Return a standardized error response
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue media storage task: {str(e)}"
        ) # Use standard HTTPException, middleware will format it

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_media_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: str = Form(...),
    scene_id: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None)
):
    """
    Upload a media file directly
    
    Args:
        file: The file to upload
        project_id: Project ID
        scene_id: Scene ID
        title: Optional title for the media
        description: Optional description for the media
        
    Returns:
        Upload result with file URL
    """
    # This is a placeholder for direct file upload
    # Will be implemented in a future update
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"message": "Direct file upload not yet implemented", "code": "not_implemented"}
    ) 