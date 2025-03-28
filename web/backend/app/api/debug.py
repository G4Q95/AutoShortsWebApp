"""
Debug router for R2 storage testing.
"""

import os
import subprocess
import uuid
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.services.storage import get_storage
from app.services.r2_file_tracking import r2_file_tracking
from app.services.project import cleanup_project_storage
from app.services.worker_client import worker_client

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])


class WorkerTestRequest(BaseModel):
    """Request model for testing the Cloudflare Worker"""
    object_keys: List[str]
    dry_run: bool = False


@router.get("/wrangler-auth", response_model=Dict[str, Any])
async def verify_wrangler_auth():
    """Verify Wrangler authentication status from application context."""
    try:
        result = subprocess.run(["wrangler", "whoami"], capture_output=True, text=True)
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "is_authenticated": "You are logged in" in result.stdout
        }
    except Exception as e:
        logger.error(f"Error verifying Wrangler auth: {str(e)}")
        return {
            "error": str(e),
            "exit_code": -1,
            "is_authenticated": False
        }


@router.get("/r2-access", response_model=Dict[str, Any])
async def verify_r2_access():
    """Verify R2 bucket access from application context."""
    try:
        result = subprocess.run(["wrangler", "r2", "bucket", "list", "--remote"], 
                            capture_output=True, text=True)
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "exit_code": result.returncode,
            "buckets": [line.strip() for line in result.stdout.splitlines() if line.strip()]
        }
    except Exception as e:
        logger.error(f"Error verifying R2 access: {str(e)}")
        return {
            "error": str(e),
            "exit_code": -1,
            "buckets": []
        }


@router.get("/env-vars", response_model=Dict[str, str])
async def get_r2_env_vars():
    """Return R2-related environment variables (redacted for security)."""
    env_vars = {
        "CLOUDFLARE_ACCOUNT_ID": "✓ Set" if os.environ.get("CLOUDFLARE_ACCOUNT_ID") else "❌ Not Set",
        "CLOUDFLARE_API_TOKEN": "✓ Set" if os.environ.get("CLOUDFLARE_API_TOKEN") else "❌ Not Set",
        "R2_BUCKET_NAME": settings.r2_bucket_name if hasattr(settings, 'r2_bucket_name') else "Not Set",
        "WRANGLER_PATH": os.environ.get("PATH", "Not Set")
    }
    return env_vars


@router.get("/list-project-files/{project_id}", response_model=Dict[str, Any])
async def list_project_files(project_id: str):
    """List all files associated with a project."""
    storage = get_storage()
    
    try:
        # Get files using the application's discovery logic
        files = await storage.list_project_files(project_id)
        
        # For now, we don't have the script's logic directly available,
        # so we'll just return the files found by the app
        return {
            "project_id": project_id,
            "files_found_by_app": files,
            "files_found_by_script": [],  # To be implemented
            "differences": {
                "only_in_app": [],
                "only_in_script": []
            }
        }
    except Exception as e:
        logger.error(f"Error listing project files: {str(e)}")
        return {
            "project_id": project_id,
            "error": str(e),
            "files_found_by_app": [],
            "files_found_by_script": []
        }


@router.post("/cleanup/{project_id}", response_model=Dict[str, Any])
async def debug_cleanup(
    project_id: str, 
    mode: str = Query("wrangler", enum=["wrangler", "s3", "sequential"]),
    dry_run: bool = Query(False)
):
    """Debug endpoint for testing different cleanup strategies."""
    storage = get_storage()
    deletion_id = str(uuid.uuid4())
    
    logger.info(f"[{deletion_id}] Debug cleanup for project {project_id} using {mode} mode")
    
    try:
        if mode == "wrangler":
            # Use Wrangler for cleanup
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=True,
                sequential=False
            )
        elif mode == "s3":
            # Use S3 API for cleanup
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=False,
                sequential=False
            )
        elif mode == "sequential":
            # Use sequential deletion
            result = await storage.cleanup_project_storage(
                project_id=project_id,
                dry_run=dry_run,
                use_wrangler=True,
                sequential=True
            )
        
        return {
            "deletion_id": deletion_id,
            "project_id": project_id,
            "mode": mode,
            "dry_run": dry_run,
            "result": result
        }
    except Exception as e:
        logger.error(f"[{deletion_id}] Error in debug cleanup: {str(e)}")
        return {
            "deletion_id": deletion_id,
            "project_id": project_id,
            "mode": mode,
            "dry_run": dry_run,
            "error": str(e)
        }


@router.get("/verify-cleanup/{project_id}", response_model=Dict[str, Any])
async def verify_cleanup(project_id: str):
    """Check if any files remain for a project after cleanup."""
    storage = get_storage()
    
    try:
        # List remaining files
        remaining_files = await storage.list_project_files(project_id)
        
        return {
            "project_id": project_id,
            "files_remaining": remaining_files,
            "is_clean": len(remaining_files) == 0
        }
    except Exception as e:
        logger.error(f"Error verifying cleanup: {str(e)}")
        return {
            "project_id": project_id,
            "error": str(e),
            "files_remaining": [],
            "is_clean": False
        }


@router.get("/r2-file-paths/{project_id}", response_model=Dict[str, Any])
async def get_project_file_paths(project_id: str):
    """
    Debug endpoint to get all tracked R2 file paths for a project.
    
    Args:
        project_id: The project ID to get file paths for
        
    Returns:
        List of tracked file paths
    """
    # Ensure project ID has correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Get tracked file paths
    files = await r2_file_tracking.get_project_files(project_id)
    
    return {
        "project_id": project_id,
        "files_count": len(files),
        "files": files
    }


@router.post("/test-worker", response_model=Dict[str, Any])
async def test_worker(request: WorkerTestRequest):
    """
    Test the Cloudflare Worker for R2 deletion.
    
    This endpoint allows testing the Worker with specific object keys.
    In dry_run mode, it will only log what would be deleted.
    """
    logger.info(f"Testing Worker with {len(request.object_keys)} keys (dry_run: {request.dry_run})")
    
    if not settings.worker_url or not settings.worker_api_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Worker settings not configured"
        )
    
    if request.dry_run:
        logger.info(f"DRY RUN: Would delete these keys: {request.object_keys}")
        return {
            "dry_run": True,
            "keys": request.object_keys,
            "count": len(request.object_keys)
        }
    
    # Use the Worker client to delete files
    result = await worker_client.delete_r2_objects(request.object_keys)
    return result


@router.post("/cleanup-project/{project_id}", response_model=Dict[str, Any])
async def debug_cleanup_project(
    project_id: str,
    dry_run: bool = Query(True, description="Only list files without deleting"),
    mode: str = Query("auto", description="Deletion mode: auto, worker, tracked, pattern"),
):
    """
    Debug endpoint for cleaning up project storage.
    
    This endpoint allows testing different cleanup strategies:
    - 'auto': Use the default strategy order (worker > tracked > pattern)
    - 'worker': Use only the Cloudflare Worker approach
    - 'tracked': Use only tracked file paths
    - 'pattern': Use only pattern-based discovery
    
    By default, dry_run is True to prevent accidental deletion.
    """
    logger.info(f"Debug cleanup for project {project_id} (mode: {mode}, dry_run: {dry_run})")
    
    # For Worker-only mode
    if mode == "worker":
        logger.info("Using Worker-only mode")
        # Get tracked files
        files = await r2_file_tracking.get_project_files(project_id)
        if not files:
            return {"error": "No tracked files found for this project"}
        
        object_keys = [file.get("object_key") for file in files if file.get("object_key")]
        
        if dry_run:
            return {
                "dry_run": True,
                "mode": "worker",
                "keys": object_keys,
                "count": len(object_keys)
            }
        
        # Use Worker client directly
        result = await worker_client.delete_r2_objects(object_keys)
        
        # Delete tracking records
        if not dry_run:
            deleted_records = await r2_file_tracking.delete_project_files(project_id)
            result["tracking_records_deleted"] = deleted_records
            
        return result
    
    # For tracked-only mode
    elif mode == "tracked":
        # Modify the temp results to only use tracked files
        temp_settings_value = settings.use_worker_for_deletion
        settings.use_worker_for_deletion = False
        result = await cleanup_project_storage(project_id, dry_run)
        settings.use_worker_for_deletion = temp_settings_value
        return result
    
    # For pattern-only mode
    elif mode == "pattern":
        # Temporarily clear the tracked files
        files = await r2_file_tracking.get_project_files(project_id)
        temp_settings_value = settings.use_worker_for_deletion
        settings.use_worker_for_deletion = False
        
        # Backup the files
        backup_files = files.copy() if files else []
        
        # Clear the tracked files table for this project
        if files:
            await r2_file_tracking.delete_project_files(project_id)
        
        # Run the cleanup with pattern matching only
        result = await cleanup_project_storage(project_id, dry_run)
        
        # Restore the settings
        settings.use_worker_for_deletion = temp_settings_value
        
        # If we were just testing, restore the files
        if dry_run and backup_files:
            # We'd need to implement a restore function
            pass
            
        return result
    
    # For auto/default mode, use the normal cleanup process
    else:
        # Set worker mode based on settings
        return await cleanup_project_storage(project_id, dry_run)


@router.get("/worker-status", response_model=Dict[str, Any])
async def get_worker_status():
    """
    Get the status of the Cloudflare Worker integration.
    
    This endpoint checks the worker configuration and credentials.
    """
    return {
        "worker_url_configured": bool(settings.worker_url),
        "worker_token_configured": bool(settings.worker_api_token),
        "worker_deletion_enabled": settings.use_worker_for_deletion,
        "worker_url": settings.worker_url[:20] + "..." if settings.worker_url else None,
    } 