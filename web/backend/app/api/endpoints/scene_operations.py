from fastapi import APIRouter, Depends, HTTPException, status, Body
from typing import Dict, Any, List, Optional
from bson import ObjectId
import logging
from pydantic import BaseModel

from ...core.errors import DatabaseError, NotFoundError, create_error_response, ErrorCodes
from ...core.database import db
from ...core.auth import get_current_user
from ...models.api import ApiResponse
from ...models.project import Project, Scene
from ...models.user import User

# Configure logging
logger = logging.getLogger(__name__)

# Create router
scene_router = APIRouter(
    prefix="/scenes",
    tags=["scenes"],
)

class SceneTrimUpdateRequest(BaseModel):
    """Request model for updating scene trim data."""
    trim_start: float
    trim_end: Optional[float] = None

class SceneTrimUpdateResponse(BaseModel):
    """Response model for scene trim update."""
    scene_id: str
    trim_start: float
    trim_end: Optional[float] = None
    project_id: str
    success: bool
    
    class Config:
        arbitrary_types_allowed = True

@scene_router.post("/{project_id}", response_model=ApiResponse[Project])
async def add_scene(
    project_id: str,
    scene: Scene = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Add a scene to a project.
    """
    try:
        # Get database reference
        mongo_db = db.get_db()
        
        # Verify project exists and belongs to user
        project = await mongo_db.projects.find_one({"_id": project_id, "user_id": current_user.id})
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
        
        # Add scene to project
        scenes = project.get("scenes", [])
        scenes.append(scene)
        
        # Update project
        result = await mongo_db.projects.update_one(
            {"_id": project_id},
            {"$set": {"scenes": scenes}}
        )
        
        if result.modified_count == 0:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Failed to add scene to project",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Get updated project
        updated_project = await mongo_db.projects.find_one({"_id": project_id})
        
        # Format project for response
        formatted_project = {
            "id": str(updated_project.get("_id")),
            "title": updated_project.get("title", ""),
            "description": updated_project.get("description"),
            "user_id": updated_project.get("user_id"),
            "scenes": updated_project.get("scenes", []),
            "created_at": updated_project.get("created_at"),
            "updated_at": updated_project.get("updated_at"),
        }
        
        return ApiResponse(
            success=True,
            message="Scene added successfully",
            data=formatted_project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding scene to project: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to add scene to project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@scene_router.put("/{project_id}/{scene_id}", response_model=ApiResponse[Project])
async def update_scene(
    project_id: str,
    scene_id: str,
    scene_update: Scene = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Update a scene in a project.
    """
    try:
        # Get database reference
        mongo_db = db.get_db()
        
        # Verify project exists and belongs to user
        project = await mongo_db.projects.find_one({"_id": project_id, "user_id": current_user.id})
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
        
        # Find scene in project
        scenes = project.get("scenes", [])
        scene_index = None
        for i, scene in enumerate(scenes):
            if scene.get("id") == scene_id:
                scene_index = i
                break
        
        if scene_index is None:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Scene {scene_id} not found in project",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )
        
        # Update scene
        scenes[scene_index] = scene_update
        
        # Update project
        result = await mongo_db.projects.update_one(
            {"_id": project_id},
            {"$set": {"scenes": scenes}}
        )
        
        if result.modified_count == 0:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Failed to update scene in project",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Get updated project
        updated_project = await mongo_db.projects.find_one({"_id": project_id})
        
        # Format project for response
        formatted_project = {
            "id": str(updated_project.get("_id")),
            "title": updated_project.get("title", ""),
            "description": updated_project.get("description"),
            "user_id": updated_project.get("user_id"),
            "scenes": updated_project.get("scenes", []),
            "created_at": updated_project.get("created_at"),
            "updated_at": updated_project.get("updated_at"),
        }
        
        return ApiResponse(
            success=True,
            message="Scene updated successfully",
            data=formatted_project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scene in project: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to update scene in project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@scene_router.delete("/{project_id}/{scene_id}", response_model=ApiResponse[Project])
async def delete_scene(
    project_id: str,
    scene_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a scene from a project.
    """
    try:
        # Get database reference
        mongo_db = db.get_db()
        
        # Verify project exists and belongs to user
        project = await mongo_db.projects.find_one({"_id": project_id, "user_id": current_user.id})
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
        
        # Find scene in project
        scenes = project.get("scenes", [])
        scene_index = None
        for i, scene in enumerate(scenes):
            if scene.get("id") == scene_id:
                scene_index = i
                break
        
        if scene_index is None:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Scene {scene_id} not found in project",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )
        
        # Remove scene
        scenes.pop(scene_index)
        
        # Update project
        result = await mongo_db.projects.update_one(
            {"_id": project_id},
            {"$set": {"scenes": scenes}}
        )
        
        if result.modified_count == 0:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Failed to delete scene from project",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Get updated project
        updated_project = await mongo_db.projects.find_one({"_id": project_id})
        
        # Format project for response
        formatted_project = {
            "id": str(updated_project.get("_id")),
            "title": updated_project.get("title", ""),
            "description": updated_project.get("description"),
            "user_id": updated_project.get("user_id"),
            "scenes": updated_project.get("scenes", []),
            "created_at": updated_project.get("created_at"),
            "updated_at": updated_project.get("updated_at"),
        }
        
        return ApiResponse(
            success=True,
            message="Scene deleted successfully",
            data=formatted_project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting scene from project: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to delete scene from project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@scene_router.put("/{project_id}/reorder", response_model=ApiResponse[Project])
async def reorder_scenes(
    project_id: str,
    scene_ids: List[str] = Body(..., embed=True, alias="scene_ids"),
    current_user: User = Depends(get_current_user)
):
    """
    Reorder scenes in a project.
    """
    try:
        # Get database reference
        mongo_db = db.get_db()
        
        # Verify project exists and belongs to user
        project = await mongo_db.projects.find_one({"_id": project_id, "user_id": current_user.id})
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
        
        # Get current scenes
        current_scenes = project.get("scenes", [])
        current_scene_map = {scene.get("id"): scene for scene in current_scenes}
        
        # Validate all scenes exist
        for scene_id in scene_ids:
            if scene_id not in current_scene_map:
                error_response = create_error_response(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    message=f"Scene {scene_id} not found in project",
                    error_code=ErrorCodes.VALIDATION_ERROR
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=error_response
                )
        
        # Reorder scenes
        reordered_scenes = [current_scene_map[scene_id] for scene_id in scene_ids]
        
        # Update project
        result = await mongo_db.projects.update_one(
            {"_id": project_id},
            {"$set": {"scenes": reordered_scenes}}
        )
        
        if result.modified_count == 0:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Failed to reorder scenes in project",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Get updated project
        updated_project = await mongo_db.projects.find_one({"_id": project_id})
        
        # Format project for response
        formatted_project = {
            "id": str(updated_project.get("_id")),
            "title": updated_project.get("title", ""),
            "description": updated_project.get("description"),
            "user_id": updated_project.get("user_id"),
            "scenes": updated_project.get("scenes", []),
            "created_at": updated_project.get("created_at"),
            "updated_at": updated_project.get("updated_at"),
        }
        
        return ApiResponse(
            success=True,
            message="Scenes reordered successfully",
            data=formatted_project
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering scenes in project: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to reorder scenes in project: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        )

@scene_router.put("/{project_id}/{scene_id}/trim", response_model=ApiResponse[SceneTrimUpdateResponse])
async def update_scene_trim(
    project_id: str,
    scene_id: str,
    trim_data: SceneTrimUpdateRequest = Body(...),
    current_user: User = Depends(get_current_user)
):
    """
    Update trim values for a scene in a project.
    """
    try:
        # Get database reference
        mongo_db = db.get_db()
        
        # Verify project exists and belongs to user
        project = await mongo_db.projects.find_one({"_id": project_id, "user_id": current_user.id})
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
        
        # Find scene in project
        scenes = project.get("scenes", [])
        scene_index = None
        for i, scene in enumerate(scenes):
            if scene.get("id") == scene_id:
                scene_index = i
                break
        
        if scene_index is None:
            error_response = create_error_response(
                status_code=status.HTTP_404_NOT_FOUND,
                message=f"Scene {scene_id} not found in project",
                error_code=ErrorCodes.RESOURCE_NOT_FOUND
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_response
            )
        
        # Update scene trim values
        scenes[scene_index]["trim_start"] = trim_data.trim_start
        scenes[scene_index]["trim_end"] = trim_data.trim_end
        
        # Update project
        result = await mongo_db.projects.update_one(
            {"_id": project_id},
            {"$set": {"scenes": scenes}}
        )
        
        if result.modified_count == 0:
            error_response = create_error_response(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Failed to update scene trim values",
                error_code=ErrorCodes.DATABASE_ERROR
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=error_response
            )
        
        # Return response
        response_data = {
            "scene_id": scene_id,
            "trim_start": trim_data.trim_start,
            "trim_end": trim_data.trim_end,
            "project_id": project_id,
            "success": True
        }
        
        return ApiResponse(
            success=True,
            message="Scene trim values updated successfully",
            data=response_data
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scene trim values: {str(e)}")
        logger.exception("Full traceback:")
        error_response = create_error_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            message=f"Failed to update scene trim values: {str(e)}",
            error_code=ErrorCodes.DATABASE_ERROR
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response
        ) 