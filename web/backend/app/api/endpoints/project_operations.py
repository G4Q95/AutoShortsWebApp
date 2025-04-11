import logging
from typing import List
from fastapi import APIRouter, HTTPException, status
from app.core.database import db
from app.models.project import ProjectResponse
from app.core.errors import create_error_response, ErrorCodes
from app.models.api import ApiResponse

logger = logging.getLogger(__name__)

project_router = APIRouter()

# Endpoints will be added here 

@project_router.get("/{project_id}", response_model=ApiResponse[ProjectResponse])
async def get_project(project_id: str):
    """
    Retrieve a specific project by ID.
    Returns a standardized response with the project data.
    """
    try:
        if not db.is_mock:
            mongo_db = db.get_db()
            project = await mongo_db.projects.find_one({"_id": project_id})
            
            if not project:
                error_response = create_error_response(
                    status_code=status.HTTP_404_NOT_FOUND,
                    message=f"Project {project_id} not found",
                    error_code=ErrorCodes.RESOURCE_NOT_FOUND
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=error_response
                )
            
            # Format project for response
            formatted_project = {
                "id": str(project.get("_id")),
                "title": project.get("title", ""),
                "description": project.get("description"),
                "user_id": project.get("user_id"),
                "scenes": project.get("scenes", []),
                "created_at": project.get("created_at") or project.get("createdAt"),
                "updated_at": project.get("updated_at") or project.get("created_at"),
            }
            
            return ApiResponse(
                success=True,
                message="Project retrieved successfully",
                data=formatted_project
            )
        else:
            # Mock response
            return ApiResponse(
                success=True,
                message="Using mock database",
                data={
                    "id": project_id,
                    "title": "Mock Project",
                    "scenes": []
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to retrieve project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

# Other project endpoints will be added here 