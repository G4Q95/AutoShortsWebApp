from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
import logging
import os
import shutil
import uuid
from datetime import datetime
from typing import Optional

from app.services.storage import get_storage

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/media",
    tags=["media"],
    responses={
        404: {"description": "Not found"},
        500: {"description": "Internal server error"},
    },
)

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    title: str = Form(None),
    description: str = Form(None)
):
    """
    Upload a media file (image, video, audio) to storage
    
    Args:
        file: The file to upload
        title: Optional title for the media
        description: Optional description for the media
        
    Returns:
        JSON with file URL and metadata
    """
    logger.info(f"Received upload request for file: {file.filename}")
    
    try:
        # Create a temporary file to store the upload
        temp_file_path = f"/tmp/{uuid.uuid4()}_{file.filename}"
        logger.info(f"Saving uploaded file temporarily to: {temp_file_path}")
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(temp_file_path), exist_ok=True)
        
        # Save the upload to the temporary file
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file size for logging
        file_size = os.path.getsize(temp_file_path)
        logger.info(f"File saved successfully. Size: {file_size} bytes")
        
        # Generate a storage key for the file
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename_base = os.path.splitext(file.filename)[0]
        filename_ext = os.path.splitext(file.filename)[1]
        storage_key = f"uploads/{timestamp}_{filename_base}{filename_ext}"
        
        # Get the storage service
        storage = get_storage()
        
        # Upload the file to storage
        logger.info(f"Uploading file to storage with key: {storage_key}")
        success, url = await storage.upload_file(temp_file_path, storage_key)
        
        # Clean up the temporary file
        try:
            os.unlink(temp_file_path)
            logger.info(f"Temporary file removed: {temp_file_path}")
        except Exception as e:
            logger.warning(f"Failed to remove temporary file: {str(e)}")
        
        if not success:
            logger.error(f"Failed to upload file: {url}")
            raise HTTPException(status_code=500, detail=f"Failed to upload file: {url}")
        
        # Prepare response with file URL and metadata
        response = {
            "file_url": url,
            "storage_key": storage_key,
            "filename": file.filename,
            "content_type": file.content_type,
            "title": title,
            "description": description,
            "upload_time": datetime.now().isoformat()
        }
        
        logger.info(f"File uploaded successfully. URL: {url[:50]}...")
        return response
    
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading file: {str(e)}") 