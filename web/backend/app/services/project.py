"""
Project management service.
This module provides functions for managing projects.
"""

import logging
from typing import Dict, List, Any, Optional

from app.services.wrangler_r2 import WranglerR2Client
from app.core.config import settings

# Set up logging
logger = logging.getLogger(__name__)

async def cleanup_project_storage(project_id: str, dry_run: bool = False) -> dict:
    """
    Clean up files associated with a project in R2 storage.
    
    Args:
        project_id: The project ID to clean up files for
        dry_run: If True, only list what would be deleted without actually deleting
        
    Returns:
        Dictionary with deletion results
    """
    logger.info(f"[CLEANUP] Starting R2 storage cleanup for project: {project_id} (dry_run: {dry_run})")
    
    # Ensure project ID has the correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
        logger.info(f"[CLEANUP] Added 'proj_' prefix to project ID: {project_id}")
    
    # Initialize the Wrangler R2 client
    bucket_name = settings.R2_BUCKET_NAME
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Use the Wrangler client to find and delete files
    results = wrangler_client.delete_objects_by_project_id(project_id, dry_run=dry_run)
    
    # Log summary
    if dry_run:
        logger.info(f"[CLEANUP] DRY RUN completed for {project_id}: Would delete {len(results.get('would_delete', []))} files")
    else:
        logger.info(f"[CLEANUP] Completed for {project_id}: Deleted {results['total_deleted']} files, Failed {results['total_failed']} files")
    
    return results

async def get_project_storage_usage(project_id: str) -> dict:
    """
    Get storage usage for a project.
    
    Args:
        project_id: The project ID to get storage usage for
        
    Returns:
        Dictionary with storage usage information
    """
    logger.info(f"[STORAGE] Getting storage usage for project: {project_id}")
    
    # Ensure project ID has the correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Initialize the Wrangler R2 client
    bucket_name = settings.R2_BUCKET_NAME
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Use the client to find all files for this project
    # Create variations to search for
    variations = []
    if project_id.startswith("proj_"):
        clean_id = project_id.replace("proj_", "")
        variations.extend([project_id, clean_id])
    else:
        variations.extend([project_id, f"proj_{project_id}"])
    
    all_matching_objects = []
    for variant in variations:
        direct_matches = wrangler_client.find_objects_containing(variant)
        if direct_matches:
            all_matching_objects.extend(direct_matches)
    
    # Remove duplicates
    unique_objects = {}
    for obj in all_matching_objects:
        key = obj.get("key")
        if key:
            unique_objects[key] = obj
    
    matching_objects = list(unique_objects.values())
    
    # Calculate total size
    total_size = sum(obj.get("size", 0) for obj in matching_objects)
    
    return {
        "project_id": project_id,
        "file_count": len(matching_objects),
        "total_size_bytes": total_size,
        "total_size_mb": round(total_size / (1024 * 1024), 2) if total_size > 0 else 0,
        "files": matching_objects
    } 