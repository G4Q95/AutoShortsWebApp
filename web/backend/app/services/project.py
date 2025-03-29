"""
Project management service.
This module provides functions for managing projects.
"""

import logging
from typing import Dict, List, Any, Optional
import uuid
import traceback

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
    3. If no tracked files are found, it falls back to listing all project files directly
    
    Args:
        project_id: The project ID to clean up files for
        dry_run: If True, only list what would be deleted without actually deleting
        
    Returns:
        Dictionary with deletion results
    """
    # Generate a unique ID for tracking this cleanup operation
    cleanup_id = str(uuid.uuid4())[:8]
    logger.info(f"[CLEANUP-{cleanup_id}] Starting R2 storage cleanup for project: {project_id} (dry_run: {dry_run})")
    
    # Ensure project ID has the correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
        logger.info(f"[CLEANUP-{cleanup_id}] Added 'proj_' prefix to project ID: {project_id}")
    
    # Initialize tracking results
    results = {
        "project_id": project_id,
        "tracked_files_deleted": 0,
        "pattern_files_deleted": 0,
        "total_deleted": 0,
        "total_failed": 0,
        "deletion_strategy": None,
        "dry_run": dry_run,
        "cleanup_id": cleanup_id  # Store the cleanup ID in results
    }
    
    # PHASE 0: Try Worker-based deletion if enabled and not in dry run mode
    if settings.use_worker_for_deletion and not dry_run:
        try:
            logger.info(f"[CLEANUP-{cleanup_id}] Attempting Worker-based deletion for project {project_id}")
            results["deletion_strategy"] = "worker"
            
            # Use the worker for deletion
            worker_result = await storage.cleanup_project_storage_via_worker(project_id)
            
            # If worker was successful, return results
            if worker_result and worker_result.get("successful", 0) > 0:
                logger.info(f"[CLEANUP-{cleanup_id}] Worker deletion successful: {worker_result.get('successful')} files deleted")
                results["tracked_files_deleted"] = worker_result.get("successful", 0)
                results["total_deleted"] = worker_result.get("successful", 0)
                results["total_failed"] = worker_result.get("failed", 0)
                results["worker_result"] = worker_result
                return results
            else:
                logger.warning(f"[CLEANUP-{cleanup_id}] Worker deletion unsuccessful, falling back to tracked files")
        except Exception as e:
            logger.error(f"[CLEANUP-{cleanup_id}] Error during Worker-based cleanup: {str(e)}")
            # Fall through to tracked files approach
    
    # PHASE 1: Use tracked file paths from database
    try:
        # Get tracked file paths for this project
        tracked_files = await r2_file_tracking.get_project_files(project_id)
        logger.info(f"[CLEANUP-{cleanup_id}] Found {len(tracked_files)} tracked files for project {project_id}")
        
        if tracked_files:
            # We have tracked files, use direct deletion
            logger.info(f"[CLEANUP-{cleanup_id}] Using tracked files for deletion")
            results["deletion_strategy"] = "tracked_files"
            
            if not dry_run:
                # Extract object keys
                object_keys = [file["object_key"] for file in tracked_files]
                
                # Log the object keys we're going to delete
                logger.info(f"[CLEANUP-{cleanup_id}] Object keys to delete: {object_keys[:5]}..." + 
                          f"({len(object_keys) - 5} more)" if len(object_keys) > 5 else "")
                
                # Delete files in batches
                batch_size = 100
                success_count = 0
                failed_keys = []
                
                for i in range(0, len(object_keys), batch_size):
                    batch = object_keys[i:i + batch_size]
                    logger.info(f"[CLEANUP-{cleanup_id}] Deleting batch {i//batch_size + 1} with {len(batch)} files")
                    
                    # Delete batch
                    for key in batch:
                        try:
                            logger.info(f"[CLEANUP-{cleanup_id}] Attempting to delete file: {key}")
                            success, msg = await storage.delete_file(key)
                            if success:
                                logger.info(f"[CLEANUP-{cleanup_id}] Successfully deleted file: {key}")
                                success_count += 1
                            else:
                                logger.warning(f"[CLEANUP-{cleanup_id}] Failed to delete file: {key} - {msg}")
                                failed_keys.append(key)
                        except Exception as e:
                            logger.error(f"[CLEANUP-{cleanup_id}] Error deleting file {key}: {str(e)}")
                            failed_keys.append(key)
                
                # Update results
                results["tracked_files_deleted"] = success_count
                results["total_deleted"] = success_count
                results["total_failed"] = len(failed_keys)
                results["failed_keys"] = failed_keys[:10]  # Include first 10 failed keys
                
                # Log the results
                logger.info(f"[CLEANUP-{cleanup_id}] Tracked files deletion results: {success_count} successful, {len(failed_keys)} failed")
                
                # Clean up tracking records regardless of whether files were successfully deleted
                # This prevents orphaned records in case files were already removed
                deleted_records = await r2_file_tracking.delete_project_files(project_id)
                logger.info(f"[CLEANUP-{cleanup_id}] Deleted {deleted_records} tracking records from database")
                results["tracking_records_deleted"] = deleted_records
                
        else:
            # No tracked files found, fall back to direct pattern listing
            logger.warning(f"[CLEANUP-{cleanup_id}] No tracked files found, falling back to pattern-based discovery")
            results["deletion_strategy"] = "pattern_based"
            
            # Use list_project_files from storage service to find files
            project_files = await storage.list_project_files(project_id)
            
            # Log how many files found
            if project_files:
                logger.info(f"[CLEANUP-{cleanup_id}] Found {len(project_files)} files via pattern search")
                
                # If dry run, just return what would be deleted
                if dry_run:
                    results["pattern_files_found"] = len(project_files)
                    results["pattern_files"] = [f["key"] for f in project_files][:20]  # First 20 files for reference
                    logger.info(f"[CLEANUP-{cleanup_id}] DRY RUN - Would delete {len(project_files)} files")
                else:
                    # Extract keys for deletion
                    keys_to_delete = [f["key"] for f in project_files]
                    
                    # Use S3 client directly for batch deletion
                    s3_client = storage.get_s3_client()
                    
                    # Check if we have keys to delete
                    if keys_to_delete:
                        try:
                            # Prepare objects for deletion
                            objects_to_delete = [{"Key": key} for key in keys_to_delete]
                            
                            # Batch size for deletion (S3 API limit)
                            batch_size = 1000
                            deleted_count = 0
                            errors = []
                            
                            # Process in batches if needed
                            for i in range(0, len(objects_to_delete), batch_size):
                                batch = objects_to_delete[i:i + batch_size]
                                logger.info(f"[CLEANUP-{cleanup_id}] Deleting batch {i//batch_size + 1} with {len(batch)} files")
                                
                                try:
                                    # Perform the deletion - remove await
                                    delete_response = s3_client.delete_objects(
                                        Bucket=settings.R2_BUCKET_NAME,
                                        Delete={"Objects": batch}
                                    )
                                    
                                    # Count deleted files
                                    batch_deleted = len(delete_response.get("Deleted", []))
                                    deleted_count += batch_deleted
                                    
                                    # Track errors
                                    batch_errors = delete_response.get("Errors", [])
                                    if batch_errors:
                                        for err in batch_errors:
                                            errors.append(f"{err.get('Key', '')}: {err.get('Message', '')}")
                                    
                                    logger.info(f"[CLEANUP-{cleanup_id}] Batch {i//batch_size + 1} complete: {batch_deleted} deleted, {len(batch_errors)} errors")
                                    
                                except Exception as e:
                                    logger.error(f"[CLEANUP-{cleanup_id}] Error deleting batch: {str(e)}")
                                    errors.append(f"Batch error: {str(e)}")
                            
                            # Update results
                            results["pattern_files_deleted"] = deleted_count
                            results["total_deleted"] += deleted_count
                            results["total_failed"] = len(errors)
                            results["pattern_errors"] = errors[:10]  # First 10 errors for reference
                            logger.info(f"[CLEANUP-{cleanup_id}] Pattern-based deletion complete: {deleted_count} deleted, {len(errors)} errors")
                            
                        except Exception as e:
                            logger.error(f"[CLEANUP-{cleanup_id}] Error during pattern-based deletion: {str(e)}")
                            logger.error(traceback.format_exc())
                            results["pattern_error"] = str(e)
                    else:
                        logger.info(f"[CLEANUP-{cleanup_id}] No files found for deletion after processing keys")
            else:
                logger.info(f"[CLEANUP-{cleanup_id}] No files found via pattern search")
    
    except Exception as e:
        logger.error(f"[CLEANUP-{cleanup_id}] Error during file cleanup: {str(e)}")
        logger.error(f"[CLEANUP-{cleanup_id}] {traceback.format_exc()}")
        results["error"] = str(e)
        results["success"] = False
    
    # Log final results
    logger.info(f"[CLEANUP-{cleanup_id}] Final cleanup results for project {project_id}: {results}")
    
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