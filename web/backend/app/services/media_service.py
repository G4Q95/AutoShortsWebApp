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
    
    Args:
        url: Media URL to download
        project_id: Project ID
        scene_id: Scene ID
        media_type: Type of media
        create_thumbnail: Whether to create a thumbnail
        timeout: Download timeout in seconds
        
    Returns:
        Dictionary with storage details
        
    Raises:
        HTTPException: If processing fails
    """
    try:
        # Validate input
        if not url:
            raise ValueError("URL is required")
        if not project_id:
            raise ValueError("Project ID is required")
        if not scene_id:
            raise ValueError("Scene ID is required")
            
        logger.info(f"Processing media from {url} for project {project_id}, scene {scene_id}")
        
        # Download the media
        try:
            content, content_type, metadata = await download_media(url, media_type, timeout)
        except MediaDownloadError as e:
            logger.error(f"Failed to download media: {str(e)}")
            raise HTTPException(
                status_code=e.status_code or 500,
                detail={"message": str(e), "code": "media_download_failed"}
            )
        
        # Determine file extension
        extension = CONTENT_TYPE_TO_EXT.get(
            content_type, 
            DEFAULT_EXT.get(media_type, FileExt.JPEG)
        )
        
        # Adjust media type based on content type if not specified
        if media_type == MediaType.UNKNOWN:
            if content_type.startswith("image/"):
                media_type = MediaType.IMAGE
            elif content_type.startswith("video/"):
                media_type = MediaType.VIDEO
        
        # Create temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            temp_path = temp_file.name
        
        # Write content to temp file
        try:
            async with aiofiles.open(temp_path, "wb") as f:
                await f.write(content)
                
            # Verify file was written correctly
            file_size = os.path.getsize(temp_path)
            logger.info(f"Written {file_size} bytes to temporary file")
            
            if file_size == 0:
                raise ValueError("Written file is empty")
                
        except Exception as e:
            logger.error(f"Error writing media data to file: {str(e)}")
            try:
                os.unlink(temp_path)
            except:
                pass
            raise HTTPException(
                status_code=500,
                detail={"message": f"Failed to write media data to file: {str(e)}", "code": "file_write_error"}
            )
        
        # Generate a filename with timestamp for uniqueness
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{timestamp}{extension}"
        
        # Get storage service
        from app.services.storage import get_storage
        storage = get_storage()
        
        # User ID is set to "default" for now - all users share the same content
        user_id = "default"
        file_type = "media"
        
        # Let the storage service handle the path structure
        # The upload_file method will call get_file_path internally
        logger.info(f"Uploading media to storage with simplified structure")
        success, url = await storage.upload_file(
            file_path=temp_path, 
            object_name=filename,
            user_id=user_id, 
            project_id=project_id, 
            scene_id=scene_id, 
            file_type=file_type
        )
        
        # Get the actual storage key used
        # Split the URL to extract the key from the end
        try:
            storage_key = url.split('/')[-1].split('?')[0]
            logger.info(f"Extracted storage key: {storage_key}")
        except Exception as e:
            logger.warning(f"Could not extract storage key from URL: {str(e)}")
            storage_key = filename  # Fallback to just using the filename
        
        # Clean up temporary file
        try:
            os.unlink(temp_path)
            logger.info(f"Removed temporary file: {temp_path}")
        except Exception as e:
            logger.warning(f"Error removing temporary file {temp_path}: {str(e)}")
        
        if not success:
            logger.error(f"Failed to upload media to storage: {url}")
            raise HTTPException(
                status_code=500,
                detail={"message": f"Failed to upload media to storage: {url}", "code": "storage_upload_failed"}
            )
            
        # Prepare result
        result = {
            "success": True,
            "url": url,
            "storage_key": storage_key,
            "media_type": media_type,
            "content_type": content_type,
            "file_size": file_size,
            "original_url": metadata["url"],
            "metadata": metadata
        }
        
        # Add thumbnail generation here if needed
        # This would be implemented in a future update
        
        logger.info(f"Successfully stored media for project {project_id}, scene {scene_id}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error storing media: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=500,
            detail={"message": f"Unexpected error storing media: {str(e)}", "code": "internal_server_error"}
        )

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