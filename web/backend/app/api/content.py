from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from pydantic import HttpUrl
import httpx

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
    try:
        content = await extract_url_content(str(url))
        if not content:
            raise ContentExtractionError("Unable to extract content from the provided URL")
        
        # Transform the content into our standardized format
        extraction_response = ContentExtractionResponse(
            title=content.get("title", "Untitled"),
            text=content.get("text", content.get("selftext", "")),
            media_url=content.get("media_url"),
            media_type=content.get("media_type"),
            author=content.get("author"),
            platform=content.get("platform", "unknown"),
            metadata={
                k: v for k, v in content.items() 
                if k not in ["title", "text", "selftext", "media_url", "media_type", "author", "platform"]
            }
        )
        
        return ApiResponse(
            success=True,
            message="Content extracted successfully",
            data=extraction_response
        )
    except Exception as e:
        # If it's already our custom error, use it to create the response
        if isinstance(e, ContentExtractionError):
            error_response = create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=str(e),
                error_code=ErrorCodes.CONTENT_EXTRACTION_ERROR
            )
        else:
            # Create a standardized error response for other exceptions
            error_response = create_error_response(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                message=f"Failed to extract content: {str(e)}",
                error_code=ErrorCodes.CONTENT_EXTRACTION_ERROR,
                details=[{
                    "loc": ["query", "url"],
                    "msg": str(e),
                    "type": "extraction_error"
                }]
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response
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
    try:
        async with httpx.AsyncClient() as client:
            # Forward the request to Reddit's servers
            response = await client.get(url, follow_redirects=True)
            response.raise_for_status()

            # Get the content type from the response
            content_type = response.headers.get("content-type", "video/mp4")

            # Create a streaming response with CORS headers
            return StreamingResponse(
                response.iter_bytes(),
                media_type=content_type,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Content-Type": content_type,
                }
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to proxy video: {str(e)}"
        )
