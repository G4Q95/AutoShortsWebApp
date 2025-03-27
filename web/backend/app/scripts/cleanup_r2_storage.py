#!/usr/bin/env python
"""
R2 Storage Cleanup Utility

This script provides functionality to clean up orphaned media files in R2 storage.
It can be run in dry-run mode to see what would be deleted without actually deleting anything.

Usage:
    python -m app.scripts.cleanup_r2_storage --prefix projects/ --dry-run
    python -m app.scripts.cleanup_r2_storage --prefix projects/ --force

Options:
    --prefix: The storage prefix to scan/cleanup (required)
    --dry-run: List objects that would be deleted without actually deleting them
    --force: Actually delete the objects (BE CAREFUL!)
    --help: Show help message
"""

import asyncio
import argparse
import logging
import sys
import os
from typing import Dict, List, Any, Set, Tuple

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("r2_cleanup")

# Add parent directory to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from app.services.storage import get_storage
from app.core.config import settings
from app.core.database import db

async def get_active_project_ids() -> Set[str]:
    """
    Get a set of all active project IDs from the database.
    
    Returns:
        Set of project ID strings
    """
    logger.info("Fetching active project IDs from database...")
    
    try:
        # Use db directly instead of get_database
        project_cursor = db.client[db.db_name].projects.find({}, {"_id": 1})
        project_ids = set()
        
        async for project in project_cursor:
            project_id = str(project["_id"])
            project_ids.add(project_id)
        
        logger.info(f"Found {len(project_ids)} active projects in database")
        return project_ids
        
    except Exception as e:
        logger.error(f"Error fetching project IDs: {str(e)}")
        return set()

async def scan_for_orphaned_files(prefix: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Scan R2 storage for orphaned files that don't belong to active projects.
    
    Args:
        prefix: The storage prefix to scan
        
    Returns:
        Tuple containing (orphaned_files, active_files)
    """
    logger.info(f"Scanning R2 storage with prefix: {prefix}")
    
    # Get storage client
    storage = get_storage()
    
    # Get active project IDs
    active_project_ids = await get_active_project_ids()
    
    # List all objects with prefix
    success, objects_or_error = await storage.list_directory(prefix)
    
    if not success:
        logger.error(f"Failed to list objects: {objects_or_error}")
        return [], []
    
    objects = objects_or_error
    logger.info(f"Found {len(objects)} total objects in R2 storage")
    
    # Categorize objects as orphaned or active
    orphaned_files = []
    active_files = []
    
    for obj in objects:
        key = obj["Key"]
        
        # Skip if not a project file
        if not key.startswith("projects/"):
            active_files.append(obj)
            continue
        
        # Extract project ID from key (format: projects/{project_id}/...)
        parts = key.split("/")
        if len(parts) >= 2:
            project_id = parts[1]
            
            if project_id in active_project_ids:
                active_files.append(obj)
            else:
                orphaned_files.append(obj)
        else:
            # Can't determine project ID, consider active to be safe
            active_files.append(obj)
    
    logger.info(f"Found {len(orphaned_files)} orphaned files and {len(active_files)} active files")
    return orphaned_files, active_files

async def cleanup_orphaned_files(orphaned_files: List[Dict[str, Any]], dry_run: bool = True) -> Dict[str, Any]:
    """
    Delete orphaned files from R2 storage.
    
    Args:
        orphaned_files: List of orphaned file objects to delete
        dry_run: If True, just log what would be deleted without actually deleting
        
    Returns:
        Statistics about the cleanup operation
    """
    if not orphaned_files:
        logger.info("No orphaned files to clean up")
        return {"deleted": 0, "failed": 0}
    
    if dry_run:
        logger.info(f"DRY RUN: Would delete {len(orphaned_files)} orphaned files")
        
        # Group by project ID for better reporting
        by_project = {}
        for obj in orphaned_files:
            key = obj["Key"]
            parts = key.split("/")
            if len(parts) >= 2:
                project_id = parts[1]
                if project_id not in by_project:
                    by_project[project_id] = []
                by_project[project_id].append(key)
        
        # Log summary by project
        for project_id, keys in by_project.items():
            logger.info(f"Project {project_id}: {len(keys)} orphaned files")
            # Log first 5 files as examples
            for key in keys[:5]:
                logger.info(f"  - {key}")
            if len(keys) > 5:
                logger.info(f"  - ... and {len(keys) - 5} more")
        
        return {"deleted": 0, "failed": 0, "dry_run": True}
    
    # Actual deletion
    logger.info(f"Deleting {len(orphaned_files)} orphaned files...")
    
    # Get storage client
    storage = get_storage()
    
    # Delete files in batches
    batch_size = 1000
    deleted_count = 0
    failed_count = 0
    
    for i in range(0, len(orphaned_files), batch_size):
        batch = orphaned_files[i:i + batch_size]
        
        # Prepare delete objects request
        delete_dict = {
            'Objects': [{'Key': obj['Key']} for obj in batch]
        }
        
        try:
            # Delete the batch
            logger.info(f"Deleting batch of {len(batch)} objects")
            response = storage.s3.delete_objects(
                Bucket=storage.bucket_name,
                Delete=delete_dict
            )
            
            # Count successful deletions
            if 'Deleted' in response:
                deleted_count += len(response['Deleted'])
            
            # Count and log errors
            if 'Errors' in response and response['Errors']:
                for error in response['Errors']:
                    logger.error(f"Failed to delete {error.get('Key')}: {error.get('Code')} - {error.get('Message')}")
                
                failed_count += len(response['Errors'])
        
        except Exception as e:
            logger.error(f"Error during batch deletion: {str(e)}")
            failed_count += len(batch)
    
    result = {"deleted": deleted_count, "failed": failed_count}
    logger.info(f"Cleanup results: {result}")
    return result

async def main():
    """Main entry point for the script."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="R2 Storage Cleanup Utility")
    parser.add_argument("--prefix", required=True, help="Storage prefix to scan/cleanup")
    parser.add_argument("--dry-run", action="store_true", help="Don't actually delete anything")
    parser.add_argument("--force", action="store_true", help="Actually delete orphaned files")
    args = parser.parse_args()
    
    # Validate arguments
    if args.force and args.dry_run:
        logger.error("Cannot specify both --force and --dry-run")
        sys.exit(1)
    
    # Default to dry-run for safety
    dry_run = not args.force
    
    # Scan for orphaned files
    orphaned_files, active_files = await scan_for_orphaned_files(args.prefix)
    
    # Display summary
    total_size_orphaned = sum(obj.get("Size", 0) for obj in orphaned_files)
    total_size_active = sum(obj.get("Size", 0) for obj in active_files)
    
    # Convert to MB for display
    mb_orphaned = total_size_orphaned / (1024 * 1024)
    mb_active = total_size_active / (1024 * 1024)
    
    logger.info("===== R2 Storage Summary =====")
    logger.info(f"Total objects: {len(orphaned_files) + len(active_files)}")
    logger.info(f"Active files: {len(active_files)} ({mb_active:.2f} MB)")
    logger.info(f"Orphaned files: {len(orphaned_files)} ({mb_orphaned:.2f} MB)")
    
    # Cleanup if requested
    if orphaned_files:
        if dry_run:
            logger.info("Running in dry-run mode. Use --force to actually delete orphaned files.")
        else:
            logger.warning("!!! FORCE MODE ENABLED - WILL DELETE ORPHANED FILES !!!")
            proceed = input("Type 'yes' to proceed with deletion: ")
            
            if proceed.lower() != "yes":
                logger.info("Deletion cancelled")
                return
        
        result = await cleanup_orphaned_files(orphaned_files, dry_run=dry_run)
        
        if not dry_run:
            logger.info(f"Cleanup complete: Deleted {result['deleted']} files, Failed: {result['failed']} files")
    else:
        logger.info("No orphaned files found. Storage is clean!")

if __name__ == "__main__":
    asyncio.run(main()) 