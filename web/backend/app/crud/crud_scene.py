# web/backend/app/crud/crud_scene.py
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from bson import ObjectId

# Import the global database object
from app.core.database import db
# Import the Scene model and SceneStatus enum from the correct file
from app.models.project import Scene, PyObjectId, SceneStatus 

import pymongo
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, PyMongoError

from app.core.config import settings
# Remove the incorrect import
# from app.models.scene import SceneStatus 
# from app.models.project import ProjectUpdate  # Already imported above

logger = logging.getLogger(__name__)

SCENES_COLLECTION = "scenes"

async def update_scene_status(
    scene_id: str,
    status: str,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    media_url: Optional[str] = None
) -> bool:
    """
    Updates the status and optionally other fields of a scene document in MongoDB.

    Args:
        scene_id: The string representation of the Scene's ObjectId.
        status: The new status string (e.g., 'downloading', 'ready', 'failed').
        error_message: An optional error message if the status is 'failed'.
        metadata: Optional dictionary containing media metadata extracted by yt-dlp.
        media_url: Optional R2 URL of the downloaded media.

    Returns:
        True if the update was successful (document found and modified), False otherwise.
    """
    if not ObjectId.is_valid(scene_id):
        logger.error(f"Invalid ObjectId format for scene_id: {scene_id}")
        return False

    query = {"_id": ObjectId(scene_id)}
    update_data = {
        "$set": {
            "status": status,
            "updated_at": datetime.utcnow()
        }
    }

    if error_message is not None:
        update_data["$set"]["error_message"] = error_message
    else:
        # Ensure error message is removed if status is not 'failed'
        if status != 'failed':
             update_data["$unset"] = {"error_message": ""}

    if media_url is not None:
        update_data["$set"]["media_url"] = media_url
        
    if metadata is not None:
        # We can add specific fields or the whole dict
        # Let's add specific known fields if they exist
        if 'title' in metadata:
            update_data["$set"]["title"] = metadata['title'] # Update title if yt-dlp found one
        if 'duration' in metadata:
            update_data["$set"]["media_metadata.duration"] = metadata['duration']
        if 'ext' in metadata:
             update_data["$set"]["media_metadata.extension"] = metadata['ext']
        # Store the whole metadata dict for reference
        update_data["$set"]["media_metadata.raw"] = metadata
        

    try:
        logger.info(f"Attempting to update scene {scene_id} with status: {status}")
        result = await db.get_collection(SCENES_COLLECTION).update_one(query, update_data)

        if result.matched_count == 0:
            logger.warning(f"Scene with ID {scene_id} not found for status update.")
            return False
        if result.modified_count == 0:
            logger.warning(f"Scene {scene_id} status was already {status} or update failed.")
            # Return True if matched, as the state is technically correct
            return result.matched_count > 0 

        logger.info(f"Successfully updated status for scene {scene_id} to {status}.")
        return True
    except Exception as e:
        logger.error(f"Database error updating scene {scene_id}: {e}", exc_info=True)
        return False

async def add_media_metadata(
    scene_id: str, 
    r2_url: str, 
    metadata: Dict[str, Any]
) -> bool:
    """
    Adds media metadata and R2 URL to a scene document.
    (This might be redundant if update_scene_status handles metadata)
    Kept separate for potential distinct logic later.
    
    Args:
        scene_id: The string representation of the Scene's ObjectId.
        r2_url: The URL of the media file in R2 storage.
        metadata: Dictionary containing media metadata (e.g., from yt-dlp).
        
    Returns:
        True if the update was successful, False otherwise.
    """
    # TODO: Evaluate if this function is needed or if update_scene_status is sufficient.
    # For now, let's just implement it similarly to how update_scene_status handles metadata.
    
    if not ObjectId.is_valid(scene_id):
        logger.error(f"Invalid ObjectId format for scene_id: {scene_id}")
        return False

    query = {"_id": ObjectId(scene_id)}
    update_data = {
        "$set": {
            "media_url": r2_url,
            "media_metadata.r2_url": r2_url, # Store redundantly? Or just use media_url?
            "updated_at": datetime.utcnow()
        }
    }
    
    # Add specific known fields from metadata
    if 'title' in metadata:
        update_data["$set"]["title"] = metadata['title']
    if 'duration' in metadata:
        update_data["$set"]["media_metadata.duration"] = metadata['duration']
    if 'ext' in metadata:
         update_data["$set"]["media_metadata.extension"] = metadata['ext']
    # Store the whole raw metadata
    update_data["$set"]["media_metadata.raw"] = metadata

    try:
        logger.info(f"Attempting to add metadata to scene {scene_id}")
        result = await db.get_collection(SCENES_COLLECTION).update_one(query, update_data)

        if result.matched_count == 0:
            logger.warning(f"Scene with ID {scene_id} not found for metadata update.")
            return False
        if result.modified_count == 0:
            logger.info(f"Scene {scene_id} metadata might already be set or update failed.")
            # Return True if matched
            return result.matched_count > 0
            
        logger.info(f"Successfully added metadata for scene {scene_id}.")
        return True
    except Exception as e:
        logger.error(f"Database error adding metadata to scene {scene_id}: {e}", exc_info=True)
        return False

# Potential future functions:
# async def get_scene(scene_id: str) -> Optional[Scene]: ...
# async def create_scene(...) -> Scene: ... 

# --- New Synchronous Function ---

def update_scene_status_sync(
    project_id: str, 
    scene_id: str, 
    status: str,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    media_url: Optional[str] = None
) -> bool:
    """
    Synchronously updates the status and optionally other fields of a specific scene
    within a project document.

    Args:
        project_id: The ID of the project.
        scene_id: The ID of the scene to update.
        status: The new status string for the scene.
        error_message: An optional error message if the status is 'failed'.
        metadata: Optional dictionary containing media metadata (e.g., from yt-dlp).
        media_url: Optional R2 URL of the downloaded media.


    Returns:
        True if the update was successful, False otherwise.
    """
    mongo_client = None
    try:
        # Connect to MongoDB synchronously
        mongo_client = pymongo.MongoClient(settings.MONGODB_URI)
        db_sync = mongo_client[settings.DATABASE_NAME]
        projects_collection = db_sync["projects"]

        logger.info(f"Attempting sync update for project {project_id}, scene {scene_id} to status {status}")

        # Reinstate ObjectId check and query by _id
        if not ObjectId.is_valid(project_id):
             logger.error(f"Invalid ObjectId format for project_id: {project_id}")
             return False
             
        # Query using the MongoDB _id
        query = {"_id": ObjectId(project_id)}
        update_payload = {"$set": {}, "$unset": {}} # Initialize $set and $unset

        # Core status update
        update_payload["$set"]["scenes.$[elem].status"] = status
        update_payload["$set"]["scenes.$[elem].updated_at"] = datetime.utcnow()


        # Handle optional fields similar to the async version
        if error_message is not None:
            update_payload["$set"]["scenes.$[elem].error_message"] = error_message
            if "error_message" in update_payload["$unset"]: # Remove from unset if setting
                del update_payload["$unset"]["error_message"]
        elif status != SceneStatus.FAILED.value: # Use enum value for comparison
             # Ensure error message is removed if status is not 'failed'
             update_payload["$unset"]["error_message"] = ""


        if media_url is not None:
            update_payload["$set"]["scenes.$[elem].media_url"] = media_url
            
        if metadata is not None:
            # Add specific known fields from metadata, prefixed for the array element
            if 'title' in metadata:
                update_payload["$set"]["scenes.$[elem].title"] = metadata['title'] 
            if 'duration' in metadata:
                 update_payload["$set"]["scenes.$[elem].media_metadata.duration"] = metadata['duration']
            if 'ext' in metadata:
                 update_payload["$set"]["scenes.$[elem].media_metadata.extension"] = metadata['ext']
            # Store the whole raw metadata within the scene element
            update_payload["$set"]["scenes.$[elem].media_metadata.raw"] = metadata

        # Clean up empty $unset
        if not update_payload["$unset"]:
            del update_payload["$unset"]


        # Use update_one with arrayFilters to target the specific scene
        result = projects_collection.update_one(
            query,
            update_payload, # Pass the constructed update document
            array_filters=[{"elem.id": scene_id}]
        )

        if result.matched_count == 0:
            logger.error(f"Sync update failed: Project {project_id} not found.")
            return False
        elif result.modified_count == 0:
            # This could mean the scene wasn't found or the status was already set to the target value
            logger.warning(f"Sync update: Project {project_id} found, but scene {scene_id} not modified (already correct status or scene not found?).")
            # Check if scene exists to differentiate
            project = projects_collection.find_one(
                {"_id": ObjectId(project_id), "scenes.id": scene_id}
            )
            if project:
                 logger.info(f"Scene {scene_id} status likely already {status}.")
                 # We consider this a success if the status is already correct
                 return True 
            else:
                 logger.error(f"Scene {scene_id} not found in project {project_id}.")
                 return False
        else:
            logger.info(f"Successfully updated scene {scene_id} in project {project_id} to status {status}")
            return True

    except pymongo.errors.ConnectionFailure as e:
        logger.error(f"Sync DB connection failed: {e}")
        return False
    except pymongo.errors.PyMongoError as e:
        logger.error(f"Sync MongoDB error during scene status update: {e}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error during sync scene status update: {e}")
        return False
    finally:
        if mongo_client:
            mongo_client.close()
            logger.debug("Sync MongoDB client closed.") 