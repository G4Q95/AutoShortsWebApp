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
from app.services.audio_service import AudioService

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
    logger.info(f"[TIMING_MEDIA_STORE] Starting media processing for {project_id}/{scene_id} from {url}")
    overall_start_time = time.time()
    
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
        download_start_time = time.time()
        logger.info(f"[TIMING_MEDIA_STORE] Starting download for {project_id}/{scene_id}")
        content, content_type, metadata = await download_media(
            url=url,
            media_type=media_type,
            timeout=timeout
        )
        download_end_time = time.time()
        download_duration = download_end_time - download_start_time
        logger.info(f"[TIMING_MEDIA_STORE] Download finished for {project_id}/{scene_id}. Duration: {download_duration:.2f}s. Size: {len(content)} bytes.")
        
        # Save to temporary file
        write_start_time = time.time()
        logger.info(f"[TIMING_MEDIA_STORE] Writing to temp file for {project_id}/{scene_id}")
        with tempfile.NamedTemporaryFile(delete=False, suffix=metadata.get("extension", ".tmp")) as temp_file:
            async with aiofiles.open(temp_file.name, mode='wb') as afp:
                await afp.write(content)
            temp_file_path = temp_file.name
        write_end_time = time.time()
        write_duration = write_end_time - write_start_time
        logger.info(f"[TIMING_MEDIA_STORE] Temp file write finished for {project_id}/{scene_id}. Duration: {write_duration:.2f}s. Path: {temp_file_path}")

        # Get storage instance
        storage = get_storage()
        # Remove Audio Service instantiation
        # audio_service = AudioService()
        # original_audio_url: Optional[str] = None # Variable to store extracted audio URL

        # Generate filename
        now = datetime.now().strftime("%Y%m%d%H%M%S")
        filename = f"{now}{metadata.get('extension', '.tmp')}"
        
        # Upload to R2
        logger.info(f"[TIMING_MEDIA_STORE] Starting R2 upload for {project_id}/{scene_id}. Filename: {filename}")
        upload_start_time = time.time()
        storage_result = await storage.upload_file(
            file_path=temp_file_path,
            project_id=project_id,
            scene_id=scene_id,
            file_type=media_type,
            user_id="default_user",  # Using a default user ID
            # Pass the generated filename as the object_name for R2
            object_name=filename  
        )
        upload_duration = time.time() - upload_start_time
        logger.info(f"[TIMING_MEDIA_STORE] R2 upload finished for {project_id}/{scene_id}. Duration: {upload_duration:.2f}s")

        # Check the result tuple: (success, url_or_error)
        upload_success, url_or_error = storage_result

        if not upload_success:
            # Handle upload failure
            logger.error(f"R2 upload failed for {filename}. Reason: {url_or_error}")
            # Attempt to clean up temp file even on failure
            try:
                os.remove(temp_file_path)
                logger.info(f"[TIMING_MEDIA_STORE] Cleaned up temp file after failed upload: {temp_file_path}")
            except OSError as e:
                logger.error(f"Error removing temporary file {temp_file_path} after failed upload: {e}")
            # Return an error structure
            return {
                "success": False,
                "error": f"Failed to upload to R2: {url_or_error}"
            }

        # If upload was successful, url_or_error contains the URL
        media_url = url_or_error
        # The object_name used for the upload is the storage_key
        storage_key = filename

        # Construct the public URL
        public_media_url = None
        logger.info(f"Attempting to construct URL. R2_PUBLIC_DOMAIN from settings: '{settings.R2_PUBLIC_DOMAIN}'")
        logger.info(f"Storage key: '{storage_key}'")
        if settings.R2_PUBLIC_DOMAIN and storage_key:
            # Ensure no double slashes
            domain = settings.R2_PUBLIC_DOMAIN.rstrip('/')
            key = storage_key.lstrip('/')
            public_media_url = f"{domain}/{key}"
            logger.info(f"Constructed public R2 URL: {public_media_url}")
        else:
            logger.warning("Could not construct public R2 URL. R2_PUBLIC_DOMAIN or storage_key missing.")

        # Clean up temporary file
        cleanup_start_time = time.time()
        try:
            os.remove(temp_file_path)
            logger.info(f"[TIMING_MEDIA_STORE] Removed temporary file: {temp_file_path}")
        except OSError as e:
            logger.error(f"Error removing temporary file {temp_file_path}: {e}")
        cleanup_duration = time.time() - cleanup_start_time
            
        # Thumbnail generation (placeholder)
        if create_thumbnail:
            logger.info("Thumbnail creation requested but not yet implemented.")
            metadata["thumbnail_status"] = "pending"

        overall_end_time = time.time()
        overall_duration = overall_end_time - overall_start_time
        logger.info(f"[TIMING_MEDIA_STORE] Finished media processing for {project_id}/{scene_id}. Overall duration: {overall_duration:.2f}s")
        
        # Construct the success response using the tuple results
        result = {
            "success": True,
            "url": public_media_url,
            "storage_key": storage_key,
            "media_type": media_type,
            "content_type": content_type,
            "size": len(content),
            "metadata": metadata,
        }

        # Add timing information
        timing_info = {
            "overall_duration_ms": int(overall_duration * 1000),
            "download_duration_ms": int(download_duration * 1000),
            "write_duration_ms": int(write_duration * 1000),
            "upload_duration_ms": int(upload_duration * 1000),
            "cleanup_duration_ms": int(cleanup_duration * 1000),
        }
        result["timing"] = timing_info

        # Optionally add connection info if available in metadata
        if "connection_info" in metadata:
            result["connectionInfo"] = metadata["connection_info"]
            
        logger.info(f"Media processing successful for {filename}. Returning result.")
        # logger.debug(f"Result details: {result}") # Optional detailed logging

        return result
        
    except MediaDownloadError as e:
        logger.error(f"Failed to download media: {str(e)}")
        raise HTTPException(
            status_code=e.status_code or 500,
            detail={"message": str(e), "code": "media_download_failed"}
        )
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