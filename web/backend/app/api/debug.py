"""
Debug router for R2 storage testing.
"""

import os
import subprocess
import uuid
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query, BackgroundTasks, Depends
from pydantic import BaseModel

from app.core.config import settings
from app.services.storage import get_storage

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/debug", tags=["debug"])


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