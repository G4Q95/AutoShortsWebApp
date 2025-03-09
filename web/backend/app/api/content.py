from fastapi import APIRouter, HTTPException, Depends, status
from typing import Dict, Any
from pydantic import HttpUrl
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
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unable to extract content from the provided URL",
        )
    return content 