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
from app.services.media_service import store_media_content, MediaType, download_media
from app.services.audio_service import AudioService # Import AudioService
from app.dependencies import get_audio_service # Import dependency getter
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/media",
    tags=["media"],
)

# Background task helper function
async def log_background_task(message: str, project_id: str):
    """Logs a message asynchronously for a background task."""
    try:
        logger.info(f"Starting background task: {message} for project {project_id}")
        await asyncio.sleep(2)  # Simulate work
        logger.info(f"Completed background task for project {project_id}")
    except Exception as e:
        logger.error(f"Background task failed for project {project_id}: {str(e)}")

# Placeholder function for triggering audio extraction
async def trigger_audio_extraction_placeholder(audio_service: AudioService, video_storage_key: str):
    """Placeholder background task to log audio extraction trigger."""
    logger.info(f"Background task: Placeholder trigger for audio extraction on {video_storage_key}")
    logger.info(f"AudioService instance type in background task: {type(audio_service)}")
    # In the next step, this will call audio_service.trigger_audio_extraction

# Media store request model
class MediaStoreRequest(BaseModel):
    """Request model for storing media from a URL."""
    url: HttpUrl = Field(..., description="URL of the media to download and store")
    project_id: str = Field(..., description="Project ID the media belongs to")
    scene_id: str = Field(..., description="Scene ID the media belongs to")
    media_type: Optional[str] = Field(None, description="Type of media (image, video, audio)")
    create_thumbnail: Optional[bool] = Field(False, description="Whether to create a thumbnail")

# Media store response model
class MediaStoreResponse(BaseModel):
    """Response model for media store operation."""
    success: bool = Field(..., description="Whether the storage was successful")
    url: Optional[str] = Field(None, description="URL to access the stored media")
    storage_key: Optional[str] = Field(None, description="Storage key for the media")
    media_type: Optional[str] = Field(None, description="Type of the stored media")
    content_type: Optional[str] = Field(None, description="Content-Type of the stored media")
    file_size: Optional[int] = Field(None, description="Size of the file in bytes")
    original_url: Optional[str] = Field(None, description="Original URL the media was downloaded from")
    metadata: Optional[dict] = Field(None, description="Additional metadata for the media")

@router.post("/store", response_model=MediaStoreResponse)
async def store_media_from_url(
    request: MediaStoreRequest, 
    background_tasks: BackgroundTasks,
    audio_service: AudioService = Depends(get_audio_service) # Inject AudioService
):
    """
    Store media from a URL to cloud storage
    
    Args:
        url: URL of the media to download and store
        project_id: Project ID the media belongs to
        scene_id: Scene ID the media belongs to
        media_type: Type of media (optional, will be detected if not provided)
        create_thumbnail: Whether to create a thumbnail (default: False)
        
    Returns:
        Storage result with file URL and storage key
    """
    logger.info(f"Media store request for URL: {request.url}")
    logger.info(f"Project ID: {request.project_id}, Scene ID: {request.scene_id}")
    logger.info(f"Media type: {request.media_type}")
    
    try:
        result = await store_media_content(
            url=str(request.url),
            project_id=request.project_id,
            scene_id=request.scene_id,
            media_type=request.media_type,
            create_thumbnail=request.create_thumbnail
        )
        
        logger.info(f"Media successfully stored: {result.get('storage_key')}")
        
        # Get the storage key for the video
        video_storage_key = result.get("storage_key")

        if video_storage_key and result.get("media_type") == MediaType.VIDEO:
            # Add the background task for audio extraction
            logger.info(f"Adding background task to extract audio from {video_storage_key}")
            background_tasks.add_task(
                trigger_audio_extraction_placeholder, 
                audio_service=audio_service, 
                video_storage_key=video_storage_key
            )
        else:
            logger.info("Skipping audio extraction background task: No video storage key or media is not video.")

        return MediaStoreResponse(
            success=True,
            url=result.get("url"),
            storage_key=result.get("storage_key"),
            media_type=result.get("media_type"),
            content_type=result.get("content_type"),
            file_size=result.get("file_size"),
            original_url=str(request.url),
            metadata=result.get("metadata", {})
        )
    except HTTPException as e:
        logger.error(f"Error storing media: {e.detail}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error storing media: {str(e)}")
        return create_error_response(
            message=f"Failed to store media: {str(e)}",
            error_code=ErrorCodes.MEDIA_STORAGE_ERROR,
            http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

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