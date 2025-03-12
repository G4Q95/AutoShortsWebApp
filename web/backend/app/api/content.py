from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status, Response
from fastapi.responses import StreamingResponse, PlainTextResponse
from pydantic import HttpUrl
import httpx
import logging

from app.core.errors import ContentExtractionError, create_error_response, ErrorCodes
from app.models.api import ApiResponse, ContentExtractionResponse, UrlPreviewResponse
from app.services.content_retrieval import extract_url_content

router = APIRouter(
    prefix="/content",
    tags=["content"],
    responses={404: {"description": "Not found"}},
)


@router.get("/extract", response_model=ApiResponse[ContentExtractionResponse])
async def extract_content(url: HttpUrl):
    """
    Extract content from a URL.
    Returns a standardized response with the extracted content.
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Content extraction request for URL: {url}")
    
    try:
        # Try to extract content from the URL
        content = await extract_url_content(str(url))
        logger.info(f"Content extraction completed for URL: {url}")
        
        # If no content was extracted, raise an error
        if not content:
            logger.error(f"No content extracted from URL: {url}")
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Unable to extract content from the provided URL"}
            )
        
        # Transform the extracted content into our response format
        extraction_response = ContentExtractionResponse(
            title=content.get("title", "Untitled"),
            text=content.get("text", content.get("selftext", "")),
            media_url=content.get("media_url"),
            media_type=content.get("media_type"),
            author=content.get("author"),
            platform=content.get("platform", "unknown"),
            subreddit=content.get("subreddit"),
            metadata={
                k: v for k, v in content.items() 
                if k not in ["title", "text", "selftext", "media_url", "media_type", 
                            "author", "platform", "subreddit"]
            }
        )
        
        # Log successful extraction details
        if content.get("media_url"):
            logger.info(f"Media URL found: {content.get('media_url')}")
            logger.info(f"Media type: {content.get('media_type')}")
        
        # Return a successful response
        return ApiResponse(
            success=True,
            message="Content extracted successfully",
            data=extraction_response
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        # Log the error
        logger.error(f"Error extracting content: {str(e)}")
        logger.exception("Exception details:")
        
        # Raise a standard HTTP exception
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"message": f"Failed to extract content: {str(e)}"}
        )


@router.get("/preview", response_model=ApiResponse[UrlPreviewResponse])
async def preview_url(url: HttpUrl):
    """
    Generate a preview for a URL (thumbnail, title, description).
    Returns a standardized response with the preview data.
    """
    try:
        content = await extract_url_content(str(url))
        if not content:
            raise ContentExtractionError("Unable to generate preview for the provided URL")

        # Create the preview response
        preview = UrlPreviewResponse(
            title=content.get("title", "No title available"),
            description=content.get("selftext", content.get("description", "No description available")),
            thumbnail=content.get("thumbnail_url") or content.get("preview_image"),
            author=content.get("author"),
            subreddit=content.get("subreddit"),
            platform=content.get("platform", "unknown")
        )
        
        return ApiResponse(
            success=True,
            message="URL preview generated successfully",
            data=preview
        )
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message=f"Failed to generate preview: {str(e)}",
            error_code=ErrorCodes.CONTENT_EXTRACTION_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response
        )


@router.options("/proxy/reddit-video")
async def proxy_reddit_video_options():
    """
    Handle OPTIONS requests for the proxy endpoint.
    This is needed for CORS preflight requests.
    """
    return Response(
        content="",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Max-Age": "3600",
        }
    )

@router.get("/proxy/reddit-video")
async def proxy_reddit_video(url: str):
    """
    Proxy endpoint for Reddit videos to handle CORS issues.
    Streams the video content from Reddit's servers through our backend.
    """
    logger = logging.getLogger(__name__)
    logger.info(f"Reddit video proxy called with URL: {url}")
    
    # Check if URL is empty
    if not url:
        logger.error("Empty URL provided to proxy")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "URL parameter is required"}
        )
    
    # Validate URL format
    if not url.startswith(('http://', 'https://')):
        logger.error(f"Invalid URL format: {url}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Invalid URL format"}
        )
    
    try:
        # Use a longer timeout for Reddit requests
        timeout = httpx.Timeout(30.0)
        logger.info(f"Using timeout: {timeout}")
        
        # Log client creation
        logger.info("Creating HTTP client")
        
        # Create an HTTP client with the timeout
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Use a normal browser user agent
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            }
            logger.info(f"Using user agent: {headers['User-Agent']}")
            
            # Make the request to Reddit
            logger.info(f"Making request to video URL: {url}")
            
            try:
                # First try a HEAD request to check the resource
                logger.info("Sending HEAD request first")
                head_response = await client.head(url, headers=headers, follow_redirects=True)
                logger.info(f"HEAD response status: {head_response.status_code}")
                logger.info(f"HEAD response headers: {dict(head_response.headers)}")
                
                # Check content type from HEAD
                head_content_type = head_response.headers.get("content-type")
                logger.info(f"Content type from HEAD: {head_content_type}")
                
                # Then make the actual GET request
                logger.info("Sending GET request")
                response = await client.get(url, headers=headers, follow_redirects=True)
                logger.info(f"GET response status: {response.status_code}")
                
                # Check if we got a successful response
                response.raise_for_status()
                
                # Log the full response headers
                logger.info(f"Full response headers: {dict(response.headers)}")
                
                # Get content length if available
                content_length = response.headers.get("content-length")
                if content_length:
                    logger.info(f"Content length: {content_length} bytes")
                else:
                    logger.warning("No content length in response")
                
                # Get the content type
                content_type = response.headers.get("content-type", "video/mp4")
                logger.info(f"Using content type: {content_type}")
                
                # Check response body start to verify it's valid
                body_start = None
                try:
                    body_start = response.content[:50].hex()
                    logger.info(f"Response body starts with: {body_start}")
                except Exception as e:
                    logger.warning(f"Could not get body start: {str(e)}")
                
                # Set up CORS headers
                headers = {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                }
                
                # Copy important headers from the original response
                important_headers = ["content-length", "content-type", "content-range", "accept-ranges"]
                for header in important_headers:
                    if header in response.headers:
                        headers[header] = response.headers[header]
                        logger.info(f"Copied header {header}: {response.headers[header]}")
                
                # Return the streaming response
                logger.info("Creating and returning streaming response")
                
                # Return the streaming response
                return StreamingResponse(
                    content=response.iter_bytes(),
                    status_code=200,
                    media_type=content_type,
                    headers=headers
                )
                
            except httpx.RequestError as e:
                logger.exception(f"Request error: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={"message": f"Error making request to video URL: {str(e)}"}
                )
            
    except Exception as e:
        # Log the detailed error
        logger.exception(f"Error in Reddit video proxy: {str(e)}")
        
        # Return a detailed error response
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"message": f"Error proxying Reddit video: {str(e)}"}
        )

@router.get("/test-proxy")
async def test_proxy():
    """
    Test endpoint for the Reddit video proxy.
    Returns a simple video URL and details that can be tested.
    """
    logger = logging.getLogger(__name__)
    logger.info("Test proxy endpoint called")
    
    # Test with a known video URL
    test_url = "https://v.redd.it/zco5kqio65qc1/DASH_720.mp4"
    proxy_url = f"/api/v1/content/proxy/reddit-video?url={test_url}"
    
    return {
        "test_url": test_url,
        "proxy_url": proxy_url,
        "instructions": "To test the proxy, use this URL in a video element or navigate to the proxy_url directly."
    }
