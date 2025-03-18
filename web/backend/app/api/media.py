"""
Media API for handling media uploads, downloads, and transformations.
"""

import logging
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status, Query
from pydantic import BaseModel, HttpUrl

from app.core.errors import create_error_response, ErrorCodes
from app.models.api import ApiResponse
from app.services.media_service import store_media_content, MediaType

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/media",
    tags=["media"],
)

# Media store request model
class MediaStoreRequest(BaseModel):
    """Request model for storing media from a URL."""
    url: HttpUrl
    project_id: str
    scene_id: str
    media_type: Optional[str] = MediaType.UNKNOWN
    create_thumbnail: Optional[bool] = True

# Media store response model
class MediaStoreResponse(BaseModel):
    """Response model for media store operation."""
    success: bool
    url: Optional[str] = None
    storage_key: Optional[str] = None
    media_type: Optional[str] = None
    content_type: Optional[str] = None
    file_size: Optional[int] = None
    original_url: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

@router.post("/store", response_model=ApiResponse[MediaStoreResponse])
async def store_media(request: MediaStoreRequest):
    """
    Download and store media from a URL to R2 storage.
    
    Args:
        request: Media store request with URL and metadata
        
    Returns:
        Response with storage details
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
        
        return {
            "success": True,
            "message": "Media successfully stored",
            "data": result
        }
        
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

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    scene_id: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
):
    """
    Upload a media file (image, video, audio) to storage
    
    Args:
        file: The media file to upload
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