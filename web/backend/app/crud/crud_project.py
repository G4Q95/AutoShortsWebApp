import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.project import Project, ProjectCreate, ProjectUpdate, Scene

logger = logging.getLogger(__name__)

COLLECTION_NAME = "projects"


async def get_project(db: AsyncIOMotorDatabase, project_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single project by its ID."""
    try:
        obj_id = ObjectId(project_id)
    except Exception:
        logger.error(f"Invalid ObjectId format: {project_id}")
        return None
    
    project = await db[COLLECTION_NAME].find_one({"_id": obj_id})
    return project


async def create_project(db: AsyncIOMotorDatabase, project_data: ProjectCreate) -> Optional[Dict[str, Any]]:
    """Create a new project."""
    try:
        # Create a Project instance to leverage Pydantic defaults (like created_at)
        new_project = Project(**project_data.model_dump())
        # Exclude None values, especially if scenes is empty, and let MongoDB handle _id
        insert_data = new_project.model_dump(by_alias=True, exclude_none=True, exclude={"id"})
        
        result = await db[COLLECTION_NAME].insert_one(insert_data)
        
        if result.inserted_id:
            created_project = await db[COLLECTION_NAME].find_one({"_id": result.inserted_id})
            return created_project
        else:
            logger.error("Failed to insert project, no inserted_id returned.")
            return None
    except Exception as e:
        logger.error(f"Error creating project: {e}", exc_info=True)
        return None

async def update_project(db: AsyncIOMotorDatabase, project_id: str, update_data: ProjectUpdate) -> Optional[Dict[str, Any]]:
    """Update an existing project."""
    try:
        obj_id = ObjectId(project_id)
    except Exception:
        logger.error(f"Invalid ObjectId format for update: {project_id}")
        return None

    # Prepare update payload, excluding fields that were not provided
    update_payload = {k: v for k, v in update_data.model_dump(exclude_unset=True).items()}

    # Handle scenes update: Pydantic models need to be dumped to dicts for MongoDB
    if "scenes" in update_payload and update_payload["scenes"] is not None:
        update_payload["scenes"] = [scene.model_dump(by_alias=True, exclude_none=True) 
                                     for scene in update_payload["scenes"]]
    elif "scenes" in update_payload and update_payload["scenes"] is None:
        # If explicitly set to None, we might want to clear scenes or handle differently
        # For now, let's assume None means no change if exclude_unset=True didn't catch it
        # Or perhaps filter it out if we don't want to set scenes to null
        del update_payload["scenes"] # Example: Don't allow setting scenes to None via PATCH

    if not update_payload:
        logger.warning(f"Update called for project {project_id} with no data to update.")
        # Return current project data without making DB call?
        return await get_project(db, project_id)
        
    # Add updated_at timestamp
    update_payload["updated_at"] = datetime.utcnow()

    try:
        updated_project = await db[COLLECTION_NAME].find_one_and_update(
            {"_id": obj_id},
            {"$set": update_payload},
            return_document=ReturnDocument.AFTER
        )
        return updated_project
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}", exc_info=True)
        return None 