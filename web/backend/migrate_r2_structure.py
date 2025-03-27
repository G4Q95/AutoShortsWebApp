#!/usr/bin/env python3
import asyncio
import os
import sys
import logging
import tempfile

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.storage import R2Storage
from app.db.mongodb import get_database
from app.core.config import settings
from bson import ObjectId

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("migrate_r2_structure")

async def migrate_r2_structure(dry_run=True):
    """
    Migrate existing R2 files to the new directory structure.
    
    Args:
        dry_run: If True, only list changes without modifying files
    """
    logger.info("Initializing R2 storage migration...")
    storage = R2Storage()
    db = await get_database()
    
    # Stats
    stats = {
        "projects_processed": 0,
        "scenes_processed": 0,
        "media_files_migrated": 0,
        "audio_files_migrated": 0,
        "failed_migrations": 0,
        "total_bytes_processed": 0
    }
    
    # Get all projects
    logger.info("Retrieving projects from database...")
    projects = await db.projects.find({}).to_list(length=None)
    logger.info(f"Found {len(projects)} projects to process")
    
    for project in projects:
        project_id = str(project["_id"])
        user_id = project.get("user_id", "default")
        
        logger.info(f"Processing project {project_id} for user {user_id}...")
        stats["projects_processed"] += 1
        
        # Get all scenes for this project
        scenes = await db.scenes.find({"project_id": project_id}).to_list(length=None)
        logger.info(f"  Found {len(scenes)} scenes")
        
        for scene in scenes:
            scene_id = str(scene["_id"])
            stats["scenes_processed"] += 1
            
            # Handle media files
            if scene.get("media") and scene["media"].get("storageKey"):
                old_key = scene["media"]["storageKey"]
                media_type = scene["media"].get("type", "image")
                filename = os.path.basename(old_key)
                
                # Create new key path
                new_key = storage.get_file_path(
                    user_id, 
                    project_id,
                    scene_id,
                    media_type,
                    filename
                )
                
                if dry_run:
                    logger.info(f"  [DRY RUN] Would migrate media: {old_key} → {new_key}")
                else:
                    success = await copy_r2_object(storage, old_key, new_key)
                    
                    if success:
                        # Update database
                        await db.scenes.update_one(
                            {"_id": scene["_id"]},
                            {"$set": {"media.storageKey": new_key}}
                        )
                        stats["media_files_migrated"] += 1
                    else:
                        stats["failed_migrations"] += 1
                
            # Handle audio files
            if scene.get("audio") and scene["audio"].get("storageKey"):
                old_key = scene["audio"]["storageKey"]
                filename = os.path.basename(old_key)
                
                # Create new key path
                new_key = storage.get_file_path(
                    user_id, 
                    project_id,
                    scene_id,
                    "audio",
                    filename
                )
                
                if dry_run:
                    logger.info(f"  [DRY RUN] Would migrate audio: {old_key} → {new_key}")
                else:
                    success = await copy_r2_object(storage, old_key, new_key)
                    
                    if success:
                        # Update database
                        await db.scenes.update_one(
                            {"_id": scene["_id"]},
                            {"$set": {"audio.storageKey": new_key}}
                        )
                        stats["audio_files_migrated"] += 1
                    else:
                        stats["failed_migrations"] += 1
    
    # Print stats
    logger.info("Migration stats:")
    logger.info(f"  - Projects processed: {stats['projects_processed']}")
    logger.info(f"  - Scenes processed: {stats['scenes_processed']}")
    logger.info(f"  - Media files migrated: {stats['media_files_migrated']}")
    logger.info(f"  - Audio files migrated: {stats['audio_files_migrated']}")
    logger.info(f"  - Failed migrations: {stats['failed_migrations']}")
    logger.info(f"  - Total bytes processed: {stats['total_bytes_processed']/1024/1024:.2f} MB")
    
    if dry_run:
        logger.info("DRY RUN complete. No files were modified.")
    else:
        logger.info("Migration completed successfully!")

async def copy_r2_object(storage, old_key, new_key):
    """
    Copy an R2 object from old path to new path.
    
    Args:
        storage: R2Storage instance
        old_key: Original object key
        new_key: New object key
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Get object size for logging
        success, object_info = await storage.get_object_info(old_key)
        if not success:
            logger.warning(f"  Failed to get object info for {old_key}: {object_info}")
            return False
            
        object_size = object_info.get("ContentLength", 0)
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_path = temp_file.name
        
        try:
            # Download to temp file
            logger.info(f"  Downloading {old_key} ({object_size/1024:.2f} KB)...")
            success, message = await storage.download_file(old_key, temp_path)
            
            if not success:
                logger.warning(f"  Failed to download {old_key}: {message}")
                return False
            
            # Upload to new location
            logger.info(f"  Uploading to {new_key}...")
            success, url = await storage.upload_file(temp_path, new_key)
            
            if not success:
                logger.warning(f"  Failed to upload to {new_key}: {url}")
                return False
            
            # Delete old file
            logger.info(f"  Deleting old file {old_key}...")
            success, message = await storage.delete_file(old_key)
            
            if not success:
                logger.warning(f"  Failed to delete old file {old_key}: {message}")
                # Don't fail the migration if only deletion fails
            
            logger.info(f"  Successfully migrated {old_key} → {new_key}")
            return True
            
        finally:
            # Clean up temp file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    except Exception as e:
        logger.error(f"  Error migrating {old_key}: {str(e)}")
        return False

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate R2 storage to new structure")
    parser.add_argument("--dry-run", action="store_true", help="Show changes without modifying files")
    args = parser.parse_args()
    
    asyncio.run(migrate_r2_structure(dry_run=args.dry_run)) 