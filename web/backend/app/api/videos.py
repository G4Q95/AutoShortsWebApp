from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.models.video import Video, VideoCreate, VideoUpdate

router = APIRouter(
    prefix="/videos",
    tags=["videos"],
    responses={404: {"description": "Not found"}},
)


@router.get("/", response_model=List[Video])
async def read_videos():
    """
    Get all videos for the current user.
    """
    # TODO: Implement database access
    # TODO: Implement authorization
    return []


@router.post("/", response_model=Video)
async def create_video(video: VideoCreate):
    """
    Create a new video from a URL.
    """
    # TODO: Implement video creation
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{video_id}", response_model=Video)
async def read_video(video_id: str):
    """
    Get a specific video by ID.
    """
    # TODO: Implement video retrieval
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/{video_id}", response_model=Video)
async def update_video(video_id: str, video: VideoUpdate):
    """
    Update a specific video.
    """
    # TODO: Implement video update
    raise HTTPException(status_code=501, detail="Not implemented")


@router.delete("/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(video_id: str):
    """
    Delete a specific video.
    """
    # TODO: Implement video deletion
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{video_id}/status", response_model=dict)
async def get_video_status(video_id: str):
    """
    Get the processing status of a video.
    """
    # TODO: Implement status retrieval
    raise HTTPException(status_code=501, detail="Not implemented")
