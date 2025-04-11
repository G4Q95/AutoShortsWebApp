import uuid
import logging
from typing import Dict, Any
from fastapi import APIRouter, BackgroundTasks, HTTPException, status, Body
from pydantic import BaseModel

from app.core.errors import create_error_response, ErrorCodes
from app.models.api import ApiResponse
# Import the function that the process_project endpoint will call
from app.services.video_processing import process_project_video

logger = logging.getLogger(__name__)

# Create router
generation_router = APIRouter()

# Define models previously in projects.py
class ProcessProjectRequest(BaseModel):
    mode: str = "custom"  # 'custom' or 'fast'

class ProcessProjectResponse(BaseModel):
    task_id: str
    message: str

# Simple in-memory task storage (moved from projects.py)
# NOTE: This will be shared by process_project and get_project_processing_status
project_processing_tasks: Dict[str, Dict[str, Any]] = {}

# --- Endpoints will be added below ---

@generation_router.post("/projects/{project_id}/process", response_model=ApiResponse[Dict[str, Any]])
async def process_project(
    project_id: str,
    background_tasks: BackgroundTasks,
    request: ProcessProjectRequest = Body(...)
):
    """
    Start processing a project into a video.
    Returns a standardized response with the processing task details.
    """
    try:
        # Generate a task ID
        task_id = str(uuid.uuid4())
        
        # Initialize task info in the shared dictionary
        project_processing_tasks[task_id] = {
            "project_id": project_id,
            "status": "queued",
            "mode": request.mode
        }
        
        # Add processing task to background tasks
        background_tasks.add_task(
            process_project_video, # Ensure this is imported
            project_id,
            task_id,
            project_processing_tasks, # Pass the shared dictionary
            mode=request.mode
        )
        
        return ApiResponse(
            success=True,
            message="Project processing started",
            data={
                "task_id": task_id,
                "status": "queued",
                "project_id": project_id
            }
        )
    except Exception as e:
        logger.error(f"Error starting project processing for {project_id}: {e}", exc_info=True)
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to start project processing: {str(e)}",
            error_code=ErrorCodes.ACTION_FAILED
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        ) 