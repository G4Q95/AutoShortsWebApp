from typing import Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.services.ai_text import rewrite_text

router = APIRouter(
    prefix="/ai",
    tags=["ai"],
    responses={404: {"description": "Not found"}},
)


class TextRewriteRequest(BaseModel):
    text: str
    style: Optional[str] = "engaging"
    max_length: Optional[int] = None


class TextRewriteResponse(BaseModel):
    original: str
    rewritten: str
    character_count: int


@router.post("/rewrite", response_model=TextRewriteResponse)
async def rewrite_content(request: TextRewriteRequest):
    """
    Rewrite text using AI to make it more engaging for short videos.
    """
    # Apply free tier character limit if no subscription
    max_length = request.max_length
    if not max_length:
        max_length = settings.FREE_TIER_MAX_CHARS

    # Call rewrite service
    rewritten = await rewrite_text(text=request.text, style=request.style, max_length=max_length)

    if not rewritten:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Failed to rewrite the text. Please try again with different content.",
        )

    return TextRewriteResponse(
        original=request.text, rewritten=rewritten, character_count=len(rewritten)
    )
