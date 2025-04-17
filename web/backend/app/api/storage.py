from fastapi import APIRouter, Depends, HTTPException, Response, Path
from fastapi.responses import StreamingResponse
from typing import Optional
import logging
from starlette.status import HTTP_404_NOT_FOUND, HTTP_500_INTERNAL_SERVER_ERROR
import traceback
import asyncio

from app.services.storage import R2Storage

router = APIRouter(
    prefix="/api/v1/storage",
    tags=["storage"]
)

logger = logging.getLogger(__name__)

@router.get("/{path:path}")
async def get_storage_object(path: str):
    """
    Get a file from storage based on the path
    
    This endpoint handles retrieving files from the new hierarchical storage structure:
    users/{user_id}/projects/{project_id}/scenes/{scene_id}/{file_type}/{filename}
    """
    logger.info(f"[STORAGE-DEBUG] Retrieving file from storage: {path}")
    
    if not path:
        raise HTTPException(status_code=400, detail="Path parameter is required")
    
    # Get storage instance by creating an instance of the class
    storage = R2Storage()
    
    try:
        # Check if file exists
        logger.info(f"[STORAGE-DEBUG] Checking if file exists at path: {path}")
        
        # Print all files in the bucket with path prefix to help debug
        files_in_path = await storage.check_files_exist(path.split('/')[0])
        if files_in_path and 'Contents' in files_in_path and files_in_path['Contents']:
            logger.info(f"[STORAGE-DEBUG] Found {len(files_in_path['Contents'])} objects with similar prefix")
            for file_obj in files_in_path['Contents'][:5]:  # Show first 5 files
                logger.info(f"[STORAGE-DEBUG] Found similar file: {file_obj.get('Key')}")
        
        # Attempt to get the file
        try:
            # --- START FIX: Add logic to retrieve file from R2 --- 
            logger.info(f"[STORAGE-DEBUG] Attempting s3.get_object with Bucket='{storage.bucket_name}' and Key='{path}'")
            response = await asyncio.to_thread(
                storage.s3.get_object,
                Bucket=storage.bucket_name, 
                Key=path
            )
            content = response['Body'].read()
            content_type = response.get('ContentType', 'application/octet-stream')
            # --- END FIX ---
            
            logger.info(f"[STORAGE-DEBUG] Successfully retrieved file: {path} with content_type: {content_type}")
            
            return StreamingResponse(
                iter([content]),
                media_type=content_type
            )
            
        except Exception as file_err:
            logger.error(f"[STORAGE-DEBUG] Error retrieving file: {str(file_err)}")
            logger.error(f"[STORAGE-DEBUG] Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=404, detail=f"File {path} not found")
        
    except Exception as e:
        logger.error(f"[STORAGE-DEBUG] Unexpected error retrieving storage object: {str(e)}")
        logger.error(f"[STORAGE-DEBUG] Path requested: {path}")
        logger.error(f"[STORAGE-DEBUG] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error retrieving file: {str(e)}") 