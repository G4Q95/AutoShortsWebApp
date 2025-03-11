from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status
from pydantic import HttpUrl

from app.core.errors import create_error_response
from app.services.content_retrieval import extract_url_content

router = APIRouter(
    prefix="/content",
    tags=["content"],
    responses={404: {"description": "Not found"}},
)


@router.get("/extract", response_model=Dict[str, Any])
async def extract_content(url: HttpUrl):
    """
    Extract content from a URL.
    """
    content = await extract_url_content(str(url))
    if not content:
        error_response = create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Unable to extract content from the provided URL",
            error_code="content_extraction_error"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response
        )
    return content


@router.get("/preview", response_model=Dict[str, Any])
async def preview_url(url: HttpUrl):
    """
    Generate a preview for a URL (thumbnail, title, description)
    """
    content = await extract_url_content(str(url))
    if not content:
        error_response = create_error_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            message="Unable to generate preview for the provided URL",
            error_code="content_extraction_error"
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error_response
        )

    # Return a simplified preview format
    preview = {
        "title": content.get("title", "No title available"),
        "description": content.get(
            "selftext", content.get("description", "No description available")
        ),
        "thumbnail": content.get("thumbnail_url") or content.get("preview_image"),
        "author": content.get("author"),
        "subreddit": content.get("subreddit"),
        "platform": content.get("platform", "unknown"),
    }
    
    return preview
