"""
Test script for media service functionality.
"""

import asyncio
import logging
import os
from dotenv import load_dotenv

from app.services.media_service import download_media, store_media_content, MediaType

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Test URLs
TEST_IMAGE_URL = "https://i.redd.it/tz7aayydvjo41.jpg"  # A Reddit image
TEST_VIDEO_URL = "https://v.redd.it/9es27q0fxnl81/DASH_720.mp4"  # A Reddit video
TEST_PROJECT_ID = "test_project_123"
TEST_SCENE_ID = "test_scene_456"

async def test_download_media():
    """Test downloading media from URLs."""
    logger.info("=== Testing download_media function ===")
    
    # Test image download
    logger.info(f"Downloading image from {TEST_IMAGE_URL}")
    try:
        content, content_type, metadata = await download_media(TEST_IMAGE_URL, MediaType.IMAGE)
        logger.info(f"Successfully downloaded image. Size: {len(content)} bytes")
        logger.info(f"Content type: {content_type}")
        logger.info(f"Metadata: {metadata}")
    except Exception as e:
        logger.error(f"Error downloading image: {str(e)}")
    
    # Test video download
    logger.info(f"Downloading video from {TEST_VIDEO_URL}")
    try:
        content, content_type, metadata = await download_media(TEST_VIDEO_URL, MediaType.VIDEO)
        logger.info(f"Successfully downloaded video. Size: {len(content)} bytes")
        logger.info(f"Content type: {content_type}")
        logger.info(f"Metadata: {metadata}")
    except Exception as e:
        logger.error(f"Error downloading video: {str(e)}")

async def test_store_media_content():
    """Test storing media content in R2."""
    logger.info("=== Testing store_media_content function ===")
    
    # Test storing an image
    logger.info(f"Storing image from {TEST_IMAGE_URL}")
    try:
        result = await store_media_content(
            url=TEST_IMAGE_URL,
            project_id=TEST_PROJECT_ID,
            scene_id=TEST_SCENE_ID,
            media_type=MediaType.IMAGE
        )
        logger.info(f"Image storage result: {result}")
    except Exception as e:
        logger.error(f"Error storing image: {str(e)}")
    
    # Test storing a video
    logger.info(f"Storing video from {TEST_VIDEO_URL}")
    try:
        result = await store_media_content(
            url=TEST_VIDEO_URL,
            project_id=TEST_PROJECT_ID,
            scene_id=TEST_SCENE_ID,
            media_type=MediaType.VIDEO
        )
        logger.info(f"Video storage result: {result}")
    except Exception as e:
        logger.error(f"Error storing video: {str(e)}")

async def main():
    """Run all tests."""
    logger.info("Starting media service tests")
    
    # Test download functionality
    await test_download_media()
    
    # Test storage functionality
    await test_store_media_content()
    
    logger.info("Media service tests completed")

if __name__ == "__main__":
    asyncio.run(main()) 