"""
Project CRUD operations service module.
This module provides functions for managing projects in the database.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.project import ProjectCreate, ProjectUpdate, ProjectResponse
from app.core.errors import NotFoundError

# Set up logging
logger = logging.getLogger(__name__)

async def create_project_service(db: AsyncIOMotorDatabase, project: ProjectCreate, user_id: str) -> Dict[str, Any]:
    """
    Create a new project in the database.
    
    Args:
        db: Database connection
        project: Project data
        user_id: ID of the user creating the project
        
    Returns:
        The created project
    """
    try:
        # Create project document
        project_dict = project.dict()
        project_dict["user_id"] = user_id
        project_dict["created_at"] = datetime.utcnow()
        project_dict["updated_at"] = project_dict["created_at"]
        
        # Insert into database
        result = await db.projects.insert_one(project_dict)
        project_id = result.inserted_id
        
        # Get the created project
        created_project = await db.projects.find_one({"_id": project_id})
        if not created_project:
            raise Exception("Project was created but could not be retrieved")
        
        # Format project for response
        return {
            "id": str(created_project["_id"]),
            "title": created_project["title"],
            "description": created_project.get("description"),
            "user_id": created_project["user_id"],
            "scenes": created_project.get("scenes", []),
            "created_at": created_project["created_at"],
            "updated_at": created_project["updated_at"],
        }
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        raise

async def get_projects_service(db: AsyncIOMotorDatabase, user_id: str) -> List[Dict[str, Any]]:
    """
    Retrieve all projects for a specific user.
    
    Args:
        db: Database connection
        user_id: ID of the user
        
    Returns:
        List of projects
    """
    try:
        # Get projects for this user
        cursor = db.projects.find({"user_id": user_id})
        projects_list = await cursor.to_list(length=100)
        
        # Process the projects for the response
        formatted_projects = []
        for project in projects_list:
            processed_project = {
                "id": str(project["_id"]),
                "title": project.get("title", ""),
                "description": project.get("description"),
                "user_id": project.get("user_id"),
                "scenes": project.get("scenes", []),
                "created_at": project.get("created_at") or project.get("createdAt"),
                "updated_at": project.get("updated_at") or project.get("created_at"),
            }
            formatted_projects.append(processed_project)
        
        return formatted_projects
    except Exception as e:
        logger.error(f"Error retrieving projects: {str(e)}")
        raise

async def get_project_service(db: AsyncIOMotorDatabase, project_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve a specific project by ID and user ID.
    
    Args:
        db: Database connection
        project_id: ID of the project
        user_id: ID of the user
        
    Returns:
        Project data or None if not found
    """
    try:
        # Convert string ID to ObjectId
        obj_id = ObjectId(project_id)
        
        # Find project
        project = await db.projects.find_one({
            "_id": obj_id, 
            "user_id": user_id
        })
        
        if not project:
            return None
        
        # Format project for response
        return {
            "id": str(project["_id"]),
            "title": project.get("title", ""),
            "description": project.get("description"),
            "user_id": project.get("user_id"),
            "scenes": project.get("scenes", []),
            "created_at": project.get("created_at") or project.get("createdAt"),
            "updated_at": project.get("updated_at") or project.get("created_at"),
        }
    except Exception as e:
        logger.error(f"Error retrieving project {project_id}: {str(e)}")
        raise

async def update_project_service(
    db: AsyncIOMotorDatabase, 
    project_id: str, 
    project_update: ProjectUpdate, 
    user_id: str
) -> Optional[Dict[str, Any]]:
    """
    Update a project by ID.
    
    Args:
        db: Database connection
        project_id: ID of the project
        project_update: Updated project data
        user_id: ID of the user
        
    Returns:
        Updated project data or None if not found
    """
    try:
        # Convert string ID to ObjectId
        obj_id = ObjectId(project_id)
        
        # Verify project exists and belongs to user
        project = await db.projects.find_one({
            "_id": obj_id, 
            "user_id": user_id
        })
        
        if not project:
            return None
        
        # Prepare update data
        update_data = project_update.dict(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        # Update project
        await db.projects.update_one(
            {"_id": obj_id}, 
            {"$set": update_data}
        )
        
        # Get updated project
        updated_project = await db.projects.find_one({"_id": obj_id})
        
        # Format project for response
        return {
            "id": str(updated_project["_id"]),
            "title": updated_project.get("title", ""),
            "description": updated_project.get("description"),
            "user_id": updated_project.get("user_id"),
            "scenes": updated_project.get("scenes", []),
            "created_at": updated_project.get("created_at") or updated_project.get("createdAt"),
            "updated_at": updated_project.get("updated_at") or updated_project.get("created_at"),
        }
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {str(e)}")
        raise

async def delete_project_service(db: AsyncIOMotorDatabase, project_id: str, user_id: str) -> bool:
    """
    Delete a project by ID.
    
    Args:
        db: Database connection
        project_id: ID of the project
        user_id: ID of the user
        
    Returns:
        True if deleted, False if not found
    """
    try:
        # Convert string ID to ObjectId
        obj_id = ObjectId(project_id)
        
        # Delete project
        result = await db.projects.delete_one({
            "_id": obj_id, 
            "user_id": user_id
        })
        
        # Return True if deleted, False if not found
        return result.deleted_count > 0
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {str(e)}")
        raise 