import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, HttpUrl

from app.core.config import settings
from app.services.ai_text import rewrite_text
from app.services.content_retrieval import extract_url_content
from app.services.video_processing import video_processor
from app.services.voice_generation import generate_voice

router = APIRouter(
    prefix="/video-creation",
    tags=["video-creation"],
    responses={404: {"description": "Not found"}},
)


class CreateVideoRequest(BaseModel):
    source_url: HttpUrl
    title: str
    voice_id: Optional[str] = "default"
    text_style: Optional[str] = "engaging"


class CreateVideoResponse(BaseModel):
    task_id: str
    message: str


class VideoStatusResponse(BaseModel):
    task_id: str
    status: str
    video_id: Optional[str] = None
    storage_url: Optional[str] = None
    error: Optional[str] = None


# Simple in-memory task storage (in a real app, this would be in a database)
video_tasks = {}


@router.post("/create", response_model=CreateVideoResponse)
async def create_video(request: CreateVideoRequest, background_tasks: BackgroundTasks):
    """
    Initiate video creation from a source URL.
    The process runs asynchronously in the background.
    """
    # Generate a task ID
    task_id = str(uuid.uuid4())

    # Store initial task status
    video_tasks[task_id] = {
        "status": "queued",
        "source_url": str(request.source_url),
        "title": request.title,
        "voice_id": request.voice_id,
        "text_style": request.text_style,
    }

    # Add the video creation task to background tasks
    background_tasks.add_task(
        process_video_creation,
        task_id=task_id,
        source_url=str(request.source_url),
        title=request.title,
        voice_id=request.voice_id,
        text_style=request.text_style,
    )

    return CreateVideoResponse(
        task_id=task_id, message="Video creation started. Check status with the /status endpoint."
    )


@router.get("/status/{task_id}", response_model=VideoStatusResponse)
async def get_video_status(task_id: str):
    """
    Check the status of a video creation task.
    """
    if task_id not in video_tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    task_info = video_tasks[task_id]

    return VideoStatusResponse(
        task_id=task_id,
        status=task_info["status"],
        video_id=task_info.get("video_id"),
        storage_url=task_info.get("storage_url"),
        error=task_info.get("error"),
    )


async def process_video_creation(
    task_id: str, source_url: str, title: str, voice_id: str, text_style: str
):
    """
    Background process to handle video creation.
    """
    try:
        # Update status
        video_tasks[task_id]["status"] = "extracting_content"

        # 1. Extract content from URL
        content = await extract_url_content(source_url)
        if not content:
            video_tasks[task_id]["status"] = "failed"
            video_tasks[task_id]["error"] = "Failed to extract content from URL"
            return

        # Update status
        video_tasks[task_id]["status"] = "rewriting_text"

        # 2. Rewrite the text
        original_text = content.get("text", "")
        rewritten_text = await rewrite_text(
            text=original_text, style=text_style, max_length=settings.FREE_TIER_MAX_CHARS
        )

        if not rewritten_text:
            video_tasks[task_id]["status"] = "failed"
            video_tasks[task_id]["error"] = "Failed to rewrite text"
            return

        # Update status
        video_tasks[task_id]["status"] = "generating_voice"

        # 3. Generate voice audio
        voice_path = await generate_voice(text=rewritten_text, voice_id=voice_id)

        if not voice_path:
            video_tasks[task_id]["status"] = "failed"
            video_tasks[task_id]["error"] = "Failed to generate voice audio"
            return

        # Update status
        video_tasks[task_id]["status"] = "creating_video"

        # 4. Create the video
        # Note: This is a placeholder - in a real system we'd use a proper user ID
        mock_user_id = "user123"
        success, video_info = await video_processor.create_video(
            text=rewritten_text, voice_path=voice_path, title=title, user_id=mock_user_id
        )

        if not success:
            video_tasks[task_id]["status"] = "failed"
            video_tasks[task_id]["error"] = video_info.get("error", "Unknown error creating video")
            return

        # Update status to completed
        video_tasks[task_id]["status"] = "completed"
        video_tasks[task_id]["video_id"] = video_info.get("video_id")
        video_tasks[task_id]["storage_url"] = video_info.get("storage_url")

    except Exception as e:
        # Handle any unexpected errors
        video_tasks[task_id]["status"] = "failed"
        video_tasks[task_id]["error"] = str(e)
