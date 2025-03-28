"""
Project management service.
This module provides functions for managing projects.
"""

import logging
from typing import Dict, List, Any, Optional

from app.services.wrangler_r2 import WranglerR2Client
from app.core.config import settings
from app.services.r2_file_tracking import r2_file_tracking
from app.services.storage import storage

# Set up logging
logger = logging.getLogger(__name__)

async def cleanup_project_storage(project_id: str, dry_run: bool = False) -> dict:
    """
    Clean up files associated with a project in R2 storage.
    
    This function uses a multi-strategy approach:
    1. If Worker deletion is enabled, it tries to use the Cloudflare Worker
    2. If Worker isn't available or fails, it uses tracked file paths from the database
    3. If no tracked files are found, it falls back to the pattern-based approach
    
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
    
    # Initialize tracking results
    results = {
        "project_id": project_id,
        "tracked_files_deleted": 0,
        "pattern_files_deleted": 0,
        "total_deleted": 0,
        "total_failed": 0,
        "deletion_strategy": None,
        "dry_run": dry_run
    }
    
    # PHASE 0: Try Worker-based deletion if enabled and not in dry run mode
    if settings.use_worker_for_deletion and not dry_run:
        try:
            logger.info(f"[CLEANUP] Attempting Worker-based deletion for project {project_id}")
            results["deletion_strategy"] = "worker"
            
            # Use the worker for deletion
            worker_result = await storage.cleanup_project_storage_via_worker(project_id)
            
            # If worker was successful, return results
            if worker_result and worker_result.get("successful", 0) > 0:
                logger.info(f"[CLEANUP] Worker deletion successful: {worker_result.get('successful')} files deleted")
                results["tracked_files_deleted"] = worker_result.get("successful", 0)
                results["total_deleted"] = worker_result.get("successful", 0)
                results["total_failed"] = worker_result.get("failed", 0)
                results["worker_result"] = worker_result
                return results
            else:
                logger.warning(f"[CLEANUP] Worker deletion unsuccessful, falling back to tracked files")
        except Exception as e:
            logger.error(f"[CLEANUP] Error during Worker-based cleanup: {str(e)}")
            # Fall through to tracked files approach
    
    # PHASE 1: Use tracked file paths from database
    try:
        # Get tracked file paths for this project
        tracked_files = await r2_file_tracking.get_project_files(project_id)
        logger.info(f"[CLEANUP] Found {len(tracked_files)} tracked files for project {project_id}")
        
        if tracked_files:
            # We have tracked files, use direct deletion
            logger.info(f"[CLEANUP] Using tracked files for deletion")
            results["deletion_strategy"] = "tracked_files"
            
            if not dry_run:
                # Extract object keys
                object_keys = [file["object_key"] for file in tracked_files]
                
                # Delete files in batches
                batch_size = 100
                success_count = 0
                failed_keys = []
                
                for i in range(0, len(object_keys), batch_size):
                    batch = object_keys[i:i + batch_size]
                    logger.info(f"[CLEANUP] Deleting batch {i//batch_size + 1} with {len(batch)} files")
                    
                    # Delete batch
                    for key in batch:
                        try:
                            success, _ = await storage.delete_file(key)
                            if success:
                                success_count += 1
                            else:
                                failed_keys.append(key)
                        except Exception as e:
                            logger.error(f"[CLEANUP] Error deleting file {key}: {str(e)}")
                            failed_keys.append(key)
                
                # Update results
                results["tracked_files_deleted"] = success_count
                results["total_deleted"] = success_count
                results["total_failed"] = len(failed_keys)
                
                # Clean up tracking records regardless of whether files were successfully deleted
                # This prevents orphaned records in case files were already removed
                deleted_records = await r2_file_tracking.delete_project_files(project_id)
                logger.info(f"[CLEANUP] Deleted {deleted_records} tracking records for project {project_id}")
                
                logger.info(f"[CLEANUP] Successfully deleted {success_count} tracked files, failed to delete {len(failed_keys)}")
                return results
            else:
                # Dry run - just report what would be deleted
                logger.info(f"[CLEANUP] DRY RUN: Would delete {len(tracked_files)} tracked files")
                results["tracked_files_deleted"] = len(tracked_files)
                results["total_deleted"] = len(tracked_files)
                return results
    except Exception as e:
        logger.error(f"[CLEANUP] Error during tracked file cleanup: {str(e)}")
        # Fall through to pattern-based approach
    
    # PHASE 2: Fall back to pattern-based approach if no tracked files or error
    logger.info(f"[CLEANUP] Falling back to pattern-based deletion")
    results["deletion_strategy"] = "pattern_based"
    
    # Initialize the Wrangler R2 client
    bucket_name = settings.R2_BUCKET_NAME
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Use the Wrangler client to find and delete files
    wrangler_results = wrangler_client.delete_objects_by_project_id(project_id, dry_run=dry_run)
    
    # Update results with pattern-based deletion results
    if dry_run:
        results["pattern_files_deleted"] = len(wrangler_results.get("would_delete", []))
        results["total_deleted"] = results["pattern_files_deleted"]
        logger.info(f"[CLEANUP] DRY RUN completed for {project_id}: Would delete {results['pattern_files_deleted']} files")
    else:
        results["pattern_files_deleted"] = wrangler_results.get("total_deleted", 0)
        results["total_deleted"] = results["tracked_files_deleted"] + results["pattern_files_deleted"]
        results["total_failed"] = wrangler_results.get("total_failed", 0)
        logger.info(f"[CLEANUP] Completed for {project_id}: Deleted {results['total_deleted']} files, Failed {results['total_failed']} files")
    
    return results

async def get_project_storage_usage(project_id: str) -> dict:
    """
    Get storage usage for a project.
    
    This function uses tracked file paths first, then falls back to pattern-based discovery.
    
    Args:
        project_id: The project ID to get storage usage for
        
    Returns:
        Dictionary with storage usage information
    """
    logger.info(f"[STORAGE] Getting storage usage for project: {project_id}")
    
    # Ensure project ID has the correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Try to get tracked files first
    tracked_files = await r2_file_tracking.get_project_files(project_id)
    if tracked_files:
        logger.info(f"[STORAGE] Found {len(tracked_files)} tracked files for project {project_id}")
        
        # Calculate total size from tracked files
        total_size = sum(file.get("size_bytes", 0) for file in tracked_files)
        
        return {
            "project_id": project_id,
            "file_count": len(tracked_files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2) if total_size > 0 else 0,
            "files": tracked_files,
            "source": "tracked_files"
        }
    
    # Fall back to pattern-based discovery
    logger.info(f"[STORAGE] No tracked files found, using pattern-based discovery")
    
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
        "files": matching_objects,
        "source": "pattern_based"
    } 