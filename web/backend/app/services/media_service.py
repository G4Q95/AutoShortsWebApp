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
from fastapi import HTTPException, status, BackgroundTasks, Depends

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
    project_id: str,            # Custom ID (proj_...)
    mongo_db_id: Optional[str], # MongoDB ObjectId
    scene_id: str,
    user_id: str = "system",
    media_type: Union[MediaType, str] = MediaType.VIDEO,
    create_thumbnail: bool = True
) -> Dict[str, Any]:
    """
    Download and store media content in R2 storage.
    
    This function creates a Celery task to perform the actual download and storage.
    
    Args:
        url: URL of the media to download
        project_id: Custom Project ID to associate with the media
        mongo_db_id: MongoDB document ID of the project
        scene_id: Scene ID to associate with the media
        user_id: User ID who owns the content
        media_type: Type of media to download (video, image, etc)
        create_thumbnail: Whether to create a thumbnail from video
        
    Returns:
        Dictionary with task ID and status information
    """
    # Log the request to store media
    logger.info(f"Storing media from URL {url} for project {project_id} (DB ID: {mongo_db_id}), scene {scene_id}")
    
    # Validate input
    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is required"
        )
    
    if not project_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project ID is required"
        )
        
    if not scene_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Scene ID is required"
        )
        
    # We now rely on mongo_db_id being passed for the Celery task,
    # but we might still receive calls without it during transition or error states.
    if not mongo_db_id:
        logger.warning(f"mongo_db_id not provided for project {project_id}, scene {scene_id}. The subsequent Celery task might fail.")
        # Allow processing to continue, Celery task might handle missing ID or fail gracefully.
        
    try:
        # Ensure we handle both enum and string for media_type
        media_type_value = media_type.value if hasattr(media_type, 'value') else media_type
        
        # Start a Celery task to download and process the media
        logger.info(f"Queuing Celery task to download media for project {project_id} (DB ID: {mongo_db_id}), scene {scene_id}")
        task = download_media_task.delay(
            url=url,
            project_id=project_id, # Keep custom ID for potential logging/context
            mongo_db_id=mongo_db_id, # Pass the crucial MongoDB ID
            scene_id=scene_id,
            user_id=user_id
            # media_type and create_thumbnail might be handled within the task itself
        )
        
        logger.info(f"Celery task queued with ID: {task.id}")
        
        # Return the task information
        return {
            "task_id": task.id,
            "status": "processing",
            "message": "Media download and processing has started"
        }
    except Exception as e:
        logger.error(f"Error queuing media download task: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue media download task: {str(e)}"
        )

async def download_media_from_reddit_post(
    post_data: Dict[str, Any],
    project_id: str,
    scene_id: str,
    user_id: str = "system_reddit_user"
) -> Dict[str, Any]:
    """
    Extract and download all media from a Reddit post.
    
    Args:
        post_data: Reddit post data
        project_id: Project ID
        scene_id: Scene ID
        user_id: User ID owning the project, defaults to "system_reddit_user"
        
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
            mongo_db_id=None,
            scene_id=scene_id,
            user_id=user_id,
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