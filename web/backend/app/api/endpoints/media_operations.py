from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from typing import Dict, Any, List, Optional
import logging
from datetime import datetime

from ...core.errors import DatabaseError, NotFoundError, create_error_response, ErrorCodes
from ...core.database import db
from ...core.auth import get_current_user
from ...models.api import ApiResponse
from ...models.user import User
from ...services import storage

# Configure logging
logger = logging.getLogger(__name__)

# Create router
media_router = APIRouter(
    prefix="/media",
    tags=["media"],
)

@media_router.post("/upload", response_model=ApiResponse[Dict[str, Any]])
async def upload_media(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    scene_id: Optional[str] = Form(None),
    media_type: str = Form(...),  # 'image', 'video', 'audio'
    current_user: User = Depends(get_current_user)
):
    """
    Upload media file (image, video, or audio) for a project or scene.
    
    Returns the storage information including URL for the uploaded file.
    """
    try:
        logger.info(f"Uploading {media_type} for project {project_id}, scene {scene_id}")
        
        # Read file content
        file_content = await file.read()
        
        # Determine content type
        content_type = file.content_type
        
        # Generate storage key
        if scene_id:
            storage_key = f"projects/{project_id}/scenes/{scene_id}/{media_type}/{file.filename}"
        else:
            storage_key = f"projects/{project_id}/{media_type}/{file.filename}"
        
        # Upload to storage
        upload_result = await storage.upload_file(
            file_content, 
            storage_key,
            content_type
        )
        
        if not upload_result["success"]:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Failed to upload media: {upload_result.get('error')}",
                error_code=ErrorCodes.STORAGE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Update project/scene with media information if needed
        if scene_id:
            mongo_db = db.get_db()
            
            # Find the scene in the project
            project = await mongo_db.projects.find_one({
                "_id": project_id, 
                "scenes.id": scene_id
            })
            
            if not project:
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} with scene {scene_id} not found",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            # Update scene with media information
            await mongo_db.projects.update_one(
                {"_id": project_id, "scenes.id": scene_id},
                {"$set": {
                    "scenes.$.media.url": upload_result.get("url"),
                    "scenes.$.media.type": media_type,
                    "scenes.$.media.storage_key": storage_key,
                    "scenes.$.media.uploaded_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }}
            )
        
        return ApiResponse(
            success=True,
            message=f"{media_type.capitalize()} uploaded successfully",
            data={
                "url": upload_result.get("url"),
                "storage_key": storage_key,
                "media_type": media_type,
                "project_id": project_id,
                "scene_id": scene_id
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading media: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to upload media: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@media_router.get("/{storage_key:path}", response_model=ApiResponse[Dict[str, Any]])
async def get_media_info(
    storage_key: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get information about a stored media file.
    
    Returns metadata for the media including URL and content type.
    """
    try:
        logger.info(f"Getting media info for {storage_key}")
        
        # Get media information from storage
        media_info = await storage.get_file_info(storage_key)
        
        if not media_info["exists"]:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Media with key {storage_key} not found",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )
        
        return ApiResponse(
            success=True,
            message="Media information retrieved successfully",
            data={
                "url": media_info.get("url"),
                "storage_key": storage_key,
                "content_type": media_info.get("content_type"),
                "size": media_info.get("size"),
                "last_modified": media_info.get("last_modified")
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting media info: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to get media info: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@media_router.delete("/{storage_key:path}", response_model=ApiResponse[Dict[str, Any]])
async def delete_media(
    storage_key: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a stored media file.
    
    Returns confirmation of deletion.
    """
    try:
        logger.info(f"Deleting media {storage_key}")
        
        # Delete from storage
        delete_result = await storage.delete_file(storage_key)
        
        if not delete_result["success"]:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=f"Failed to delete media: {delete_result.get('error')}",
                error_code=ErrorCodes.STORAGE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        return ApiResponse(
            success=True,
            message="Media deleted successfully",
            data={
                "storage_key": storage_key,
                "deleted": True
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting media: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to delete media: {str(e)}",
            error_code=ErrorCodes.INTERNAL_SERVER_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        ) 