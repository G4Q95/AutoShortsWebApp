"""
Cloudflare Worker client for R2 file operations.

This module provides a client for interacting with Cloudflare Workers
that handle R2 storage operations like deletion.
"""

import json
import logging
from typing import Dict, List, Any, Optional
import httpx
from fastapi import HTTPException

from app.core.config import settings

# Configure logger
logger = logging.getLogger(__name__)


class WorkerClient:
    """Client for interacting with Cloudflare Workers."""

    def __init__(
        self,
        worker_url: Optional[str] = None,
        api_token: Optional[str] = None,
        timeout: int = 30,
    ):
        """
        Initialize the Worker client.

        Args:
            worker_url: URL of the Cloudflare Worker
            api_token: Cloudflare API token for authentication
            timeout: Request timeout in seconds
        """
        self.worker_url = worker_url or settings.worker_url
        if not self.worker_url:
            raise ValueError("Worker URL not configured")

        self.api_token = api_token or settings.worker_api_token
        if not self.api_token:
            raise ValueError("Worker API token not configured")

        self.timeout = timeout

    async def delete_r2_objects(self, object_keys: List[str]) -> Dict[str, Any]:
        """
        Delete objects from R2 storage via Cloudflare Worker.

        Args:
            object_keys: List of object keys (paths) to delete

        Returns:
            Dict containing deletion results
            
        Raises:
            HTTPException: If the worker request fails
        """
        if not object_keys:
            logger.warning("No object keys provided for deletion")
            return {"total": 0, "successful": 0, "failed": 0, "results": []}

        logger.info(f"Deleting {len(object_keys)} objects via Worker")
        
        # Prepare the request
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        
        payload = {"objectKeys": object_keys}
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    self.worker_url,
                    headers=headers,
                    json=payload
                )
                
                # Check for errors
                response.raise_for_status()
                
                # Parse the response
                result = response.json()
                logger.info(
                    f"Worker deletion completed: {result.get('successful', 0)} successful, "
                    f"{result.get('failed', 0)} failed"
                )
                
                # Log failures if any
                if result.get("failed", 0) > 0:
                    failures = [r for r in result.get("results", []) if not r.get("success")]
                    logger.error(f"Worker deletion failures: {json.dumps(failures)}")
                
                return result
                
        except httpx.HTTPStatusError as e:
            logger.error(f"Worker returned error status: {e.response.status_code} {e.response.text}")
            raise HTTPException(
                status_code=500,
                detail=f"Worker service error: {e.response.text}"
            )
        except httpx.RequestError as e:
            logger.error(f"Worker request failed: {str(e)}")
            raise HTTPException(
                status_code=503,
                detail=f"Worker service unavailable: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Worker client error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Worker client error: {str(e)}"
            )


# Create a singleton instance
worker_client = WorkerClient() 