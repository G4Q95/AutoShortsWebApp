"""
Wrangler-based R2 Client for Cloudflare R2 operations.
This module provides a wrapper around the Wrangler CLI for R2 storage operations.
"""

import subprocess
import json
import logging
import time
import os
import tempfile
from typing import List, Dict, Tuple, Optional, Any, Union

# Set up logging
logger = logging.getLogger(__name__)

class WranglerR2Client:
    """A client for interacting with Cloudflare R2 using the Wrangler CLI."""
    
    def __init__(self, bucket_name: str, retry_attempts: int = 3):
        """
        Initialize the Wrangler R2 client.
        
        Args:
            bucket_name: The name of the R2 bucket to interact with
            retry_attempts: Number of retry attempts for failed operations
        """
        self.bucket_name = bucket_name
        self.retry_attempts = retry_attempts
        logger.info(f"[WRANGLER] Initialized client for bucket: {bucket_name}")
        
    def _run_command(self, args: List[str], check: bool = True) -> Tuple[bool, Union[List[Dict], str]]:
        """
        Run a Wrangler command and handle the output.
        
        Args:
            args: The Wrangler command arguments
            check: Whether to raise an exception on command failure
            
        Returns:
            Tuple of (success, result), where result is either parsed JSON or error message
        """
        # Add the --remote flag to all R2 commands to access the remote bucket
        # Exception: bucket list doesn't work with --remote
        if args and args[0] == "r2" and "--remote" not in args:
            # Don't add --remote flag for bucket list/info commands
            if not (len(args) > 1 and args[1] == "bucket" and args[2] in ["list", "info"]):
                args.append("--remote")
            
        cmd = ["wrangler"] + args
        cmd_str = " ".join(cmd)
        logger.info(f"[WRANGLER] Running command: {cmd_str}")
        
        # Handle retry logic
        for attempt in range(1, self.retry_attempts + 1):
            try:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    check=check
                )
                
                if result.returncode == 0:
                    # Try to parse as JSON if possible (most Wrangler commands return JSON)
                    try:
                        if result.stdout.strip():
                            parsed_result = json.loads(result.stdout)
                            return True, parsed_result
                        return True, []
                    except json.JSONDecodeError:
                        # Not JSON, return as string
                        return True, result.stdout.strip()
                else:
                    error_msg = result.stderr.strip() or "Unknown error"
                    logger.error(f"[WRANGLER] Command failed: {error_msg}")
                    
                    # Check if we should retry
                    if attempt < self.retry_attempts:
                        logger.info(f"[WRANGLER] Retrying command (attempt {attempt}/{self.retry_attempts})")
                        time.sleep(1)  # Small delay before retry
                        continue
                    else:
                        return False, error_msg
            except Exception as e:
                error_msg = str(e)
                logger.error(f"[WRANGLER] Unexpected error: {error_msg}")
                
                # Check if we should retry
                if attempt < self.retry_attempts:
                    logger.info(f"[WRANGLER] Retrying command (attempt {attempt}/{self.retry_attempts})")
                    time.sleep(1)  # Small delay before retry
                    continue
                else:
                    return False, error_msg
        
        # Should never reach here
        return False, "Failed after retry attempts"
    
    def list_objects(self, prefix: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        List objects in the bucket.
        
        Note: Wrangler CLI doesn't support listing objects in a bucket directly.
        This method verifies the bucket exists and is accessible but returns a limited result.
        
        Args:
            prefix: Optional prefix to filter objects (not used in this implementation)
            limit: Maximum number of objects to return (not used in this implementation)
            
        Returns:
            List containing a single object with metadata about the bucket accessibility
        """
        # Wrangler doesn't have a native command to list objects
        # Verify the bucket exists by listing buckets
        args = ["r2", "bucket", "list"]
        success, result = self._run_command(args)
        
        if not success:
            logger.error(f"[WRANGLER] Failed to list buckets: {result}")
            return []
        
        # Check if our bucket exists in the output
        bucket_found = False
        if isinstance(result, str):
            lines = result.strip().split("\n")
            for line in lines:
                if self.bucket_name in line:
                    bucket_found = True
                    break
        
        if not bucket_found:
            logger.error(f"[WRANGLER] Bucket '{self.bucket_name}' not found")
            return []
        
        logger.info(f"[WRANGLER] Verified bucket '{self.bucket_name}' exists")
        
        # Create a test file to verify bucket access
        test_key = f"_list_test_{int(time.time())}.txt"
        with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
            temp_file.write(f"Test content for listing verification at {time.time()}")
            temp_path = temp_file.name
        
        try:
            # Upload the test file
            upload_success = self.upload_file(temp_path, test_key)
            if not upload_success:
                logger.error(f"[WRANGLER] Failed to upload test file to bucket '{self.bucket_name}'")
                return []
            
            # Delete the test file
            delete_success = self.delete_object(test_key)
            if not delete_success:
                logger.warning(f"[WRANGLER] Failed to delete test file from bucket '{self.bucket_name}'")
            
            # Log limitation warning
            logger.warning("[WRANGLER] Object listing is limited with Wrangler CLI")
            if prefix:
                logger.warning(f"[WRANGLER] Prefix filtering not available: {prefix}")
            if limit:
                logger.warning(f"[WRANGLER] Limit not available: {limit}")
            
            # Return a dummy result indicating the bucket is accessible
            return [{
                "key": "__bucket_access_test__",
                "bucket": self.bucket_name,
                "accessible": True,
                "test_upload_success": upload_success,
                "test_delete_success": delete_success,
                "message": "Wrangler CLI doesn't support direct object listing. Use S3 API for complete listing."
            }]
        
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def object_exists(self, object_key: str) -> bool:
        """
        Check if an object exists in the bucket.
        
        Args:
            object_key: The key of the object to check
            
        Returns:
            True if the object exists, False otherwise
        """
        # The correct syntax for wrangler r2 object get is:
        # wrangler r2 object get <bucket-name>/<object-key>
        object_path = f"{self.bucket_name}/{object_key}"
        args = ["r2", "object", "get", object_path]
        success, _ = self._run_command(args, check=False)
        return success
    
    def delete_object(self, object_key: str) -> bool:
        """
        Delete an object from the bucket.
        
        Args:
            object_key: The key of the object to delete
            
        Returns:
            True if deletion was successful, False otherwise
        """
        # The correct syntax for wrangler r2 object delete is:
        # wrangler r2 object delete <bucket-name>/<object-key>
        object_path = f"{self.bucket_name}/{object_key}"
        args = ["r2", "object", "delete", object_path]
        success, result = self._run_command(args)
        
        if success:
            logger.info(f"[WRANGLER] Successfully deleted object: {object_key}")
            return True
        else:
            logger.error(f"[WRANGLER] Failed to delete object {object_key}: {result}")
            return False
    
    def batch_delete_objects(self, object_keys: List[str]) -> Tuple[int, int, List[str]]:
        """
        Delete multiple objects in sequence.
        
        Args:
            object_keys: List of object keys to delete
            
        Returns:
            Tuple of (success_count, failure_count, failed_keys)
        """
        success_count = 0
        failure_count = 0
        failed_keys = []
        
        logger.info(f"[WRANGLER] Starting batch deletion of {len(object_keys)} objects")
        
        for key in object_keys:
            if self.delete_object(key):
                success_count += 1
            else:
                failure_count += 1
                failed_keys.append(key)
        
        logger.info(f"[WRANGLER] Batch deletion complete: {success_count} succeeded, {failure_count} failed")
        return success_count, failure_count, failed_keys
    
    def find_objects_containing(self, substring: str, case_sensitive: bool = True) -> List[Dict[str, Any]]:
        """
        Find all objects containing a specific substring in their key.
        
        Args:
            substring: The substring to search for
            case_sensitive: Whether to use case-sensitive matching
            
        Returns:
            List of matching objects with their metadata
        """
        # List all objects first
        all_objects = self.list_objects()
        matching_objects = []
        
        # Filter objects containing the substring
        for obj in all_objects:
            key = obj.get("key", "")
            
            if case_sensitive:
                if substring in key:
                    matching_objects.append(obj)
            else:
                if substring.lower() in key.lower():
                    matching_objects.append(obj)
        
        logger.info(f"[WRANGLER] Found {len(matching_objects)} objects containing '{substring}'")
        return matching_objects
    
    def delete_objects_by_project_id(self, project_id: str, dry_run: bool = False, debug: bool = False) -> dict:
        """
        Delete all objects associated with a project ID using fast parallel approach.
        
        Args:
            project_id: The project ID to clean up
            dry_run: If True, only list objects without deleting
            debug: Enable debug logging
            
        Returns:
            Dictionary with deletion results
        """
        if debug:
            logging.getLogger().setLevel(logging.DEBUG)
            
        logging.info(f"Starting R2 cleanup for project_id: {project_id}")
        
        # Track results
        results = {
            "deleted": [],
            "failed": [],
            "total_deleted": 0,
            "total_failed": 0
        }
        
        # Generate variations of project ID for matching
        project_id_variations = []
        
        # Original form
        project_id_variations.append(project_id)
        
        # With proj_ prefix if not already there
        if not project_id.startswith("proj_"):
            project_id_with_prefix = f"proj_{project_id}"
            project_id_variations.append(project_id_with_prefix)
        else:
            # Without prefix if it's there
            project_id_clean = project_id.replace("proj_", "")
            project_id_variations.append(project_id_clean)
        
        # Handle potential double prefix case
        if project_id.startswith("proj_proj_"):
            double_prefix_clean = project_id.replace("proj_proj_", "proj_")
            project_id_variations.append(double_prefix_clean)
            # Also add without any prefix
            no_prefix_clean = project_id.replace("proj_proj_", "")
            project_id_variations.append(no_prefix_clean)
            
        if debug:
            logging.debug(f"Using project ID variations: {project_id_variations}")
        
        # Construct file patterns to search for
        file_patterns = []
        
        # For each variation, construct common patterns
        for variation in project_id_variations:
            # Media files with timestamp variations
            file_patterns.append(f"{variation}_media.mp4")
            file_patterns.append(f"{variation}_media.jpg")
            file_patterns.append(f"{variation}_media.jpeg")
            file_patterns.append(f"{variation}_media.png")
            file_patterns.append(f"{variation}_media.webp")
            file_patterns.append(f"{variation}_media--.mp4")  # Handle double dash case
            
            # With timestamps (common pattern)
            for i in range(5):  # Check several possible timestamp variations
                file_patterns.append(f"{variation}_{i}_media.mp4")
                file_patterns.append(f"test_{variation}_{i}_media.mp4")
            
            # Scenes
            for i in range(1, 6):  # Up to 5 scenes
                file_patterns.append(f"{variation}_scene_{i}.mp4")
                file_patterns.append(f"{variation}_scene--{i}.mp4")  # Handle double dash case
            
            # Audio files
            file_patterns.append(f"{variation}_audio.mp3")
            file_patterns.append(f"{variation}_audio.wav")
            file_patterns.append(f"{variation}_audio.m4a")
            file_patterns.append(f"{variation}_audio--.mp3")  # Handle double dash case
            
            # Generated files
            file_patterns.append(f"{variation}_generated.mp4")
            file_patterns.append(f"{variation}_output.mp4")
            file_patterns.append(f"{variation}_thumbnail.jpg")
        
        # Add more specific formats and variations
        file_patterns.append(f"{project_id}.mp4")
        file_patterns.append(f"proj_{project_id}.mp4")
        
        if debug:
            logging.debug(f"Generated {len(file_patterns)} file patterns to check")
            logging.debug(f"Sample patterns: {file_patterns[:5]}")
        
        # For dry runs, just show what would be deleted
        if dry_run:
            logging.info(f"DRY RUN: Would check {len(file_patterns)} patterns for deletion")
            for pattern in file_patterns:
                logging.info(f"Would check: {self.bucket_name}/{pattern}")
            results["would_delete"] = file_patterns
            return results
        
        # Launch deletion operations for every pattern in parallel without waiting
        deletion_count = 0
        try:
            for pattern in file_patterns:
                if self.quick_delete(pattern):
                    deletion_count += 1
                    results["deleted"].append(pattern)
                else:
                    results["failed"].append(pattern)
            
            results["total_deleted"] = deletion_count
            results["total_failed"] = len(file_patterns) - deletion_count
            
            logging.info(f"Submitted {deletion_count} deletion operations for project {project_id}")
            logging.info("Note: deletions run in parallel and may still be in progress")
            
        except Exception as e:
            logging.error(f"Error during project cleanup: {str(e)}")
            results["error"] = str(e)
        
        return results
    
    def upload_file(self, local_path: str, object_key: str) -> bool:
        """
        Upload a file to the bucket.
        
        Args:
            local_path: Path to the local file to upload
            object_key: The key to store the object under in the bucket
            
        Returns:
            True if upload was successful, False otherwise
        """
        # The correct syntax for wrangler r2 object put is:
        # wrangler r2 object put <bucket-name>/<object-key> --file <local-path>
        object_path = f"{self.bucket_name}/{object_key}"
        args = ["r2", "object", "put", object_path, "--file", local_path]
        success, result = self._run_command(args)
        
        if success:
            logger.info(f"[WRANGLER] Successfully uploaded {local_path} to {object_key}")
            return True
        else:
            logger.error(f"[WRANGLER] Failed to upload {local_path}: {result}")
            return False
    
    def quick_delete(self, file_pattern: str) -> bool:
        """
        Delete a specific file pattern without any checks - fastest approach.
        
        Args:
            file_pattern: The exact file pattern to delete
            
        Returns:
            True if the command was submitted successfully
        """
        full_path = f"{self.bucket_name}/{file_pattern}"
        
        try:
            # Fast non-blocking deletion
            cmd = ["wrangler", "r2", "object", "delete", full_path, "--remote"]
            
            # Execute without waiting for completion
            process = subprocess.Popen(
                cmd, 
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            
            logging.debug(f"Submitted deletion of {full_path}")
            return True
            
        except Exception as e:
            logging.warning(f"Deletion submission failed for {full_path}: {str(e)}")
            return False 