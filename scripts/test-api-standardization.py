#!/usr/bin/env python3
"""
Test script for API standardization.
This script checks that the API responses follow the standard format
and that media proxying still works correctly.
"""

import os
import sys
import asyncio
import httpx
import json
from urllib.parse import urljoin

# Configuration
API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:8000")
API_VERSION = "/api/v1"
REDDIT_POST_URL = "https://www.reddit.com/r/interesting/comments/1j7mwks/sand_that_moves_like_water_in_the_desert/"


async def test_standard_response():
    """Test the standard response format."""
    url = urljoin(API_BASE_URL, f"{API_VERSION}/test/standard-response")
    
    async with httpx.AsyncClient() as client:
        print(f"\n\033[1;34mTesting standard response format: {url}\033[0m")
        response = await client.get(url)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check that the response has the expected format
        assert "success" in data, "Response missing 'success' field"
        assert "message" in data, "Response missing 'message' field"
        assert "data" in data, "Response missing 'data' field"
        assert "timestamp" in data, "Response missing 'timestamp' field"
        assert data["success"] == True, "Success field should be true"
        assert "test" in data["data"], "Data missing 'test' field"
        
        print("\033[32m✓ Standard response format test passed\033[0m")
        return True


async def test_error_response():
    """Test the error response format."""
    url = urljoin(API_BASE_URL, f"{API_VERSION}/test/error-response")
    
    async with httpx.AsyncClient() as client:
        print(f"\n\033[1;34mTesting error response format: {url}\033[0m")
        response = await client.get(url)
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check that the response has the expected format
        assert response.status_code == 400, "Expected 400 status code"
        assert "status_code" in data, "Response missing 'status_code' field"
        assert "message" in data, "Response missing 'message' field"
        assert data["status_code"] == 400, "Status code should be 400"
        
        print("\033[32m✓ Error response format test passed\033[0m")
        return True


async def test_content_extraction():
    """Test the content extraction endpoint."""
    url = urljoin(API_BASE_URL, f"{API_VERSION}/content/extract")
    
    async with httpx.AsyncClient() as client:
        print(f"\n\033[1;34mTesting content extraction: {url}\033[0m")
        response = await client.get(url, params={"url": REDDIT_POST_URL})
        
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        
        # Check that the response has the expected format
        assert "success" in data, "Response missing 'success' field"
        assert "message" in data, "Response missing 'message' field"
        assert "data" in data, "Response missing 'data' field"
        assert "timestamp" in data, "Response missing 'timestamp' field"
        assert data["success"] == True, "Success field should be true"
        
        # Verify content extraction data
        assert "title" in data["data"], "Data missing 'title' field"
        assert "text" in data["data"], "Data missing 'text' field"
        assert "media_url" in data["data"], "Data missing 'media_url' field"
        assert "media_type" in data["data"], "Data missing 'media_type' field"
        
        # Save the media URL for the next test
        media_url = data["data"]["media_url"]
        if not media_url:
            print("\033[33m⚠ No media URL found, skipping media proxy test\033[0m")
            return True
            
        print("\033[32m✓ Content extraction test passed\033[0m")
        
        # Test media proxy if it's a Reddit video
        if "v.redd.it" in media_url:
            await test_media_proxy(media_url)
        else:
            print("\033[33m⚠ Not a Reddit video, skipping media proxy test\033[0m")
            
        return True


async def test_media_proxy(media_url):
    """Test the media proxy endpoint."""
    url = urljoin(API_BASE_URL, f"{API_VERSION}/content/proxy/reddit-video")
    
    async with httpx.AsyncClient() as client:
        print(f"\n\033[1;34mTesting media proxy: {url}\033[0m")
        
        # First check the headers (HEAD request)
        head_response = await client.head(url, params={"url": media_url})
        print(f"HEAD Status: {head_response.status_code}")
        print(f"Content-Type: {head_response.headers.get('content-type')}")
        
        # Now check the actual content (partial GET request)
        headers = {"Range": "bytes=0-1024"}  # Just get the first 1KB
        response = await client.get(url, params={"url": media_url}, headers=headers)
        
        print(f"GET Status: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type')}")
        print(f"Content-Length: {response.headers.get('content-length')}")
        print(f"First few bytes: {response.content[:20].hex()}")
        
        # Check that the response is valid
        assert response.status_code in (200, 206), f"Expected 200 or 206 status code, got {response.status_code}"
        assert response.headers.get("content-type", "").startswith(("video/", "audio/")), "Expected video or audio content type"
        assert len(response.content) > 0, "Response content is empty"
        
        # Video files typically start with specific bytes
        valid_video_starts = [
            b"\x00\x00\x00", # Some MP4 containers
            b"\x1a\x45\xdf\xa3", # WebM
            b"\x00\x00\x01", # MPEG transport stream
            b"RIFF", # AVI
        ]
        
        content_start = response.content[:4]
        video_start_match = any(content_start.startswith(start) for start in valid_video_starts)
        
        if not video_start_match:
            print("\033[33m⚠ Media content doesn't start with expected video format signature.\033[0m")
            print(f"Content starts with: {content_start.hex()}")
        else:
            print("\033[32m✓ Media content appears to be valid video format\033[0m")
        
        print("\033[32m✓ Media proxy test passed\033[0m")
        return True


async def run_tests():
    """Run all tests."""
    try:
        print("\033[1;36m=== Starting API Standardization Tests ===\033[0m")
        
        await test_standard_response()
        await test_error_response()
        await test_content_extraction()
        
        print("\n\033[1;32m✓ All tests passed!\033[0m")
        return 0
    except AssertionError as e:
        print(f"\n\033[1;31m✗ Test failed: {e}\033[0m")
        return 1
    except Exception as e:
        print(f"\n\033[1;31m✗ Error during tests: {e}\033[0m")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_tests())
    sys.exit(exit_code) 