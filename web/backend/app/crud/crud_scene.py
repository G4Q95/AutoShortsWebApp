# web/backend/app/crud/crud_scene.py
import logging
from datetime import datetime
from typing import Dict, Any, Optional

from bson import ObjectId

# Import the global database object
from app.core.database import db
# Import the Scene model (assuming it's needed for validation or reference, though Motor uses dicts)
from app.models.project import Scene, PyObjectId

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