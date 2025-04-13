"""
Media download and storage service.

This module handles downloading media content from various sources and storing it in R2 storage.
It supports different media types (images, videos, galleries) and implements proper error handling.
"""

import asyncio
import logging
import os
import tempfile
import time
import traceback
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Union
from urllib.parse import urlparse

import aiofiles
import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.storage import get_storage
from app.tasks.media_tasks import download_media_task

logger = logging.getLogger(__name__)

# Media types
class MediaType:
    IMAGE = "image"
    VIDEO = "video"
    GALLERY = "gallery"
    UNKNOWN = "unknown"

# Content types
class ContentType:
    JPEG = "image/jpeg"
    PNG = "image/png"
    GIF = "image/gif"
    MP4 = "video/mp4"
    WEBM = "video/webm"
    MOV = "video/quicktime"

# File extensions
class FileExt:
    JPEG = ".jpg"
    PNG = ".png"
    GIF = ".gif"
    MP4 = ".mp4"
    WEBM = ".webm"
    MOV = ".mov"

# Mapping from content types to file extensions
CONTENT_TYPE_TO_EXT = {
    ContentType.JPEG: FileExt.JPEG,
    ContentType.PNG: FileExt.PNG,
    ContentType.GIF: FileExt.GIF,
    ContentType.MP4: FileExt.MP4,
    ContentType.WEBM: FileExt.WEBM,
    ContentType.MOV: FileExt.MOV,
}

# Default extension fallbacks by media type
DEFAULT_EXT = {
    MediaType.IMAGE: FileExt.JPEG,
    MediaType.VIDEO: FileExt.MP4,
    MediaType.GALLERY: FileExt.JPEG,
    MediaType.UNKNOWN: FileExt.JPEG,
}

class MediaDownloadError(Exception):
    """Exception raised for media download errors."""
    def __init__(self, message: str, status_code: Optional[int] = None, url: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.url = url
        super().__init__(self.message)

async def download_media(
    url: str, 
    media_type: str = MediaType.UNKNOWN,
    timeout: int = 30
) -> Tuple[bytes, str, Dict[str, Any]]:
    """
    Download media content from a URL.
    
    Args:
        url: The URL to download from
        media_type: The expected media type
        timeout: Timeout in seconds for the download
        
    Returns:
        Tuple of (content bytes, content type, metadata)
        
    Raises:
        MediaDownloadError: If download fails
    """
    logger.info(f"Downloading media from URL: {url}")
    logger.info(f"Expected media type: {media_type}")
    
    if not url:
        raise MediaDownloadError("No URL provided")
    
    # Set up metadata
    metadata = {
        "url": url,
        "media_type": media_type,
        "download_time": datetime.now().isoformat(),
    }
    
    try:
        # Set up headers to mimic a browser
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,video/*,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": url,  # Some servers check referer
        }
        
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            # First do a HEAD request to check content type and size
            try:
                head_response = await client.head(url, headers=headers)
                head_response.raise_for_status()
                
                content_type = head_response.headers.get("content-type", "").lower()
                content_length = head_response.headers.get("content-length", "0")
                
                logger.info(f"Content type from HEAD: {content_type}")
                logger.info(f"Content length: {content_length} bytes")
                
                metadata["content_type"] = content_type
                metadata["content_length"] = int(content_length) if content_length.isdigit() else None
                
                # Validate content type
                if media_type == MediaType.IMAGE and not content_type.startswith("image/"):
                    logger.warning(f"Expected image but got {content_type}")
                    # We'll still download it, but log the mismatch
                
                elif media_type == MediaType.VIDEO and not content_type.startswith("video/"):
                    logger.warning(f"Expected video but got {content_type}")
                    # We'll still download it, but log the mismatch
                
            except httpx.HTTPError as e:
                logger.warning(f"HEAD request failed: {str(e)}. Proceeding with direct download.")
                # If HEAD fails, we'll continue with GET and determine content type from there
                content_type = ""
                
            # Download the content
            logger.info(f"Starting download of {url}")
            start_time = time.time()
            
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            # If HEAD didn't work, get content type from GET
            if not content_type:
                content_type = response.headers.get("content-type", "").lower()
                logger.info(f"Content type from GET: {content_type}")
                metadata["content_type"] = content_type
            
            # Get content
            content = response.content
            download_time = time.time() - start_time
            
            logger.info(f"Downloaded {len(content)} bytes in {download_time:.2f} seconds")
            
            # Add to metadata
            metadata["download_size"] = len(content)
            metadata["download_time_seconds"] = download_time
            
            # Determine appropriate extension based on content type
            extension = CONTENT_TYPE_TO_EXT.get(content_type, None)
            if not extension:
                # If we couldn't map the content type, use the default for the media type
                extension = DEFAULT_EXT.get(media_type, FileExt.JPEG)
                logger.warning(f"Using default extension {extension} for content type {content_type}")
            
            # For videos, try to extract duration and dimensions
            if content_type.startswith("video/"):
                # We'll handle this later with proper video metadata extraction
                # This would likely involve using ffprobe or a similar tool
                # For now, we'll just mark it for future extraction
                metadata["needs_video_metadata"] = True
            
            return content, content_type, metadata
            
    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error during media download: {str(e)}")
        raise MediaDownloadError(
            message=f"HTTP error downloading media: {str(e)}",
            status_code=e.response.status_code,
            url=url
        )
    except httpx.TimeoutException:
        logger.error(f"Timeout downloading media from {url} after {timeout} seconds")
        raise MediaDownloadError(
            message=f"Timeout downloading media after {timeout} seconds",
            url=url
        )
    except httpx.RequestError as e:
        logger.error(f"Request error downloading media: {str(e)}")
        raise MediaDownloadError(
            message=f"Network error downloading media: {str(e)}",
            url=url
        )
    except Exception as e:
        logger.error(f"Unexpected error downloading media: {str(e)}")
        logger.error(traceback.format_exc())
        raise MediaDownloadError(
            message=f"Unexpected error downloading media: {str(e)}",
            url=url
        )

async def store_media_content(
    url: str,
    project_id: str,
    scene_id: str,
    media_type: str = MediaType.UNKNOWN,
    create_thumbnail: bool = True,
    timeout: int = 30
) -> Dict[str, Any]:
    """
    Download and store media content in R2 storage.
    This version queues a Celery task to perform the actual download and storage.
    
    Args:
        url: Media URL to download
        project_id: Project ID
        scene_id: Scene ID
        media_type: Type of media (Currently informational, task handles detection)
        create_thumbnail: Whether to create a thumbnail (Handled by task if needed)
        timeout: Download timeout in seconds (Handled by task)
        
    Returns:
        Dictionary containing the Celery task ID that was queued.
        
    Raises:
        HTTPException: If input validation fails or task queuing fails.
    """
    logger.info(f"Received request to store media for {project_id}/{scene_id} from {url}")
    # overall_start_time = time.time()
    
    try:
        # Validate input
        if not url:
            raise ValueError("URL is required")
        if not project_id:
            raise ValueError("Project ID is required")
        if not scene_id:
            raise ValueError("Scene ID is required")

        # --- Queue Celery Task --- 
        logger.info(f"Queuing download_media_task for URL: {url}")
        
        task_result = download_media_task.delay(
            url=url,
            project_id=project_id,
            scene_id=scene_id
        )
        
        logger.info(f"Task {task_result.id} queued successfully for {project_id}/{scene_id}")
        
        return {"task_id": task_result.id}

        # --- Remove old synchronous download and storage logic --- START
        # # Download media content
        # download_start_time = time.time()
        # content, content_type, metadata = await download_media(url, media_type, timeout)
        # download_duration = time.time() - download_start_time
        # logger.info(f"[TIMING_MEDIA_STORE] Download took {download_duration:.2f}s")

        # # Determine filename and path
        # parsed_url = urlparse(url)
        # filename_base = os.path.basename(parsed_url.path)
        # if not filename_base:
        #     filename_base = f"{scene_id}_media"
        # filename_ext = CONTENT_TYPE_TO_EXT.get(content_type, DEFAULT_EXT.get(media_type, FileExt.JPEG))
        # filename = f"{filename_base}{filename_ext}"
        
        # storage_service = get_storage()
        # logger.info(f"Using storage service: {type(storage_service).__name__}")
        
        # # Create a temporary file to upload content
        # upload_start_time = time.time()
        # with tempfile.NamedTemporaryFile(delete=False, suffix=filename_ext) as temp_file:
        #     temp_file_path = temp_file.name
        #     temp_file.write(content)
        #     logger.info(f"Content written to temporary file: {temp_file_path}")
        
        # # Upload the temporary file
        # object_name = storage_service.get_file_path(
        #     user_id="temp_user", # TODO: Pass actual user ID if available
        #     project_id=project_id,
        #     scene_id=scene_id,
        #     file_type="source_media",
        #     filename=filename
        # )
        
        # success, r2_url_or_error = await storage_service.upload_file(
        #     file_path=temp_file_path,
        #     object_name=object_name,
        #     project_id=project_id,
        #     scene_id=scene_id,
        #     file_type="source_media"
        # )
        
        # # Clean up temporary file
        # try:
        #     os.remove(temp_file_path)
        #     logger.info(f"Removed temporary file: {temp_file_path}")
        # except OSError as e:
        #     logger.error(f"Error removing temporary file {temp_file_path}: {e}")
            
        # upload_duration = time.time() - upload_start_time
        # logger.info(f"[TIMING_MEDIA_STORE] Upload took {upload_duration:.2f}s")
        
        # if not success:
        #     raise HTTPException(
        #         status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
        #         detail=f"Failed to upload media to storage: {r2_url_or_error}"
        #     )
            
        # r2_url = r2_url_or_error
        
        # # Prepare result
        # storage_details = {
        #     "r2_url": r2_url,
        #     "object_key": object_name,
        #     "content_type": content_type,
        #     "metadata": metadata,
        # }
        
        # # TODO: Add thumbnail generation logic here if create_thumbnail is True
        # 
        # overall_duration = time.time() - overall_start_time
        # logger.info(f"[TIMING_MEDIA_STORE] Total processing time: {overall_duration:.2f}s")
        # return storage_details
        # --- Remove old synchronous download and storage logic --- END

    except ValueError as e:
        logger.error(f"Validation error processing media for {project_id}/{scene_id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except MediaDownloadError as e:
        logger.error(f"Media download failed for {project_id}/{scene_id} from url {e.url}: {e.message}")
        raise HTTPException(status_code=e.status_code or 500, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error processing media for {project_id}/{scene_id}: {str(e)}")
        logger.error(traceback.format_exc())
        # Handle potential Celery connection errors during .delay()
        if "Broker connection error" in str(e) or "redis.exceptions.ConnectionError" in str(e):
             raise HTTPException(status_code=503, detail=f"Failed to queue download task: Broker connection error.")
        raise HTTPException(status_code=500, detail=f"Unexpected error processing media: {str(e)}")

async def download_media_from_reddit_post(
    post_data: Dict[str, Any],
    project_id: str,
    scene_id: str
) -> Dict[str, Any]:
    """
    Extract and download all media from a Reddit post.
    
    Args:
        post_data: Reddit post data
        project_id: Project ID
        scene_id: Scene ID
        
    Returns:
        Dictionary with media information
    """
    from app.services.content_retrieval import extract_media_from_reddit_post
    
    try:
        # Extract media data from post
        media_data = await extract_media_from_reddit_post(post_data)
        
        if not media_data.get("has_media", False):
            logger.info("No media found in Reddit post")
            return {"success": False, "message": "No media found in post"}
            
        media_type = media_data.get("media_type")
        media_url = media_data.get("media_url")
        
        if not media_url:
            logger.warning("Media type detected but no URL available")
            return {"success": False, "message": "Media URL not found"}
            
        # Handle different media types
        if media_type == "gallery":
            # For galleries, download each item
            gallery_items = media_data.get("gallery_items", [])
            if not gallery_items:
                logger.warning("Gallery detected but no items found")
                return {"success": False, "message": "Gallery items not found"}
                
            # Download first item for now (future: download all and create a gallery)
            logger.info(f"Gallery has {len(gallery_items)} items, downloading first item")
            media_url = gallery_items[0]
            media_type = MediaType.IMAGE
            
        # Download and store the media
        result = await store_media_content(
            url=media_url,
            project_id=project_id,
            scene_id=scene_id,
            media_type=media_type
        )
        
        # Add additional Reddit-specific metadata
        result["reddit_metadata"] = {
            "subreddit": post_data.get("subreddit", ""),
            "author": post_data.get("author", ""),
            "title": post_data.get("title", ""),
            "created_utc": post_data.get("created_utc", 0),
            "permalink": post_data.get("permalink", "")
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error downloading media from Reddit post: {str(e)}")
        logger.error(traceback.format_exc())
        return {"success": False, "message": str(e)} 