from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Optional
from bson import ObjectId

from ...core.auth import get_current_user
from ...models.project import ProjectResponse, ProjectCreate, ProjectUpdate
from ...db.mongodb import get_database
from ...services.projects import (
    create_project_service,
    get_projects_service,
    get_project_service,
    update_project_service,
    delete_project_service,
)
from ...models.user import User

# Create router
project_router = APIRouter(
    prefix="/projects",
    tags=["projects"],
)

@project_router.get("", response_model=List[ProjectResponse])
async def get_projects(current_user: User = Depends(get_current_user)):
    """
    Get all projects for the current user.
    """
    try:
        db = await get_database()
        projects = await get_projects_service(db, current_user.id)
        return projects
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve projects: {str(e)}"
        )

@project_router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate, 
    current_user: User = Depends(get_current_user)
):
    """
    Create a new project.
    """
    try:
        db = await get_database()
        new_project = await create_project_service(db, project, current_user.id)
        return new_project
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create project: {str(e)}"
        )

@project_router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str, 
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific project by ID.
    """
    try:
        db = await get_database()
        project = await get_project_service(db, project_id, current_user.id)
        if not project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        return project
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve project: {str(e)}"
        )

@project_router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str, 
    project_update: ProjectUpdate, 
    current_user: User = Depends(get_current_user)
):
    """
    Update a project by ID.
    """
    try:
        db = await get_database()
        updated_project = await update_project_service(db, project_id, project_update, current_user.id)
        if not updated_project:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        return updated_project
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update project: {str(e)}"
        )

@project_router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str, 
    current_user: User = Depends(get_current_user)
):
    """
    Delete a project by ID.
    """
    try:
        db = await get_database()
        deleted = await delete_project_service(db, project_id, current_user.id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Project with ID {project_id} not found"
            )
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete project: {str(e)}"
        ) 