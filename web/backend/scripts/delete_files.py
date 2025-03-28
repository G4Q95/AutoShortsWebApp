#!/usr/bin/env python3
"""
Delete specific files from Cloudflare R2

This script helps delete specific files from Cloudflare R2 storage that weren't removed
by the project deletion process.

Usage:
    python delete_files.py FILENAME1 [FILENAME2 ...]
    
    Add --dry-run to only check what would be deleted without actually deleting
    
Example:
    python delete_files.py proj_m8smm0mg_7yuk5z9yvctc1mdfxynqjm_media.mp4
"""

import os
import sys
import subprocess
import logging
import argparse
import time
from typing import List, Dict, Any, Optional

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger('delete-files')

def run_wrangler_command(command: List[str]) -> subprocess.CompletedProcess:
    """Run a wrangler command and return the result"""
    full_command = ["wrangler"] + command
    logger.debug(f"Running command: {' '.join(full_command)}")
    
    result = subprocess.run(
        full_command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    if result.returncode != 0:
        logger.debug(f"Command failed with exit code {result.returncode}")
        logger.debug(f"Command error: {result.stderr}")
    
    return result

def check_file_exists(bucket_name: str, file_path: str) -> bool:
    """
    Check if a specific file exists in the bucket
    Uses wrangler r2 object get to check for existence
    """
    full_path = f"{bucket_name}/{file_path}"
    command = ["r2", "object", "get", full_path, "--remote"]
    
    result = run_wrangler_command(command)
    
    # If the command succeeds, the file exists
    if result.returncode == 0:
        return True
    
    # For other errors, log and assume the file doesn't exist
    if "not found" not in result.stderr and "does not exist" not in result.stderr:
        logger.warning(f"Unexpected error checking {file_path}: {result.stderr}")
    return False

def delete_file(bucket_name: str, file_path: str, dry_run: bool = False) -> bool:
    """
    Delete a specific file from the bucket
    
    Returns True if file was deleted or would be deleted (dry run)
    """
    full_path = f"{bucket_name}/{file_path}"
    
    # First check if file exists
    if not check_file_exists(bucket_name, file_path):
        logger.warning(f"File does not exist, cannot delete: {file_path}")
        return False
    
    # If dry run, just return success
    if dry_run:
        logger.info(f"[DRY RUN] Would delete: {full_path}")
        return True
    
    # Delete the file
    command = ["r2", "object", "delete", full_path, "--remote"]
    result = run_wrangler_command(command)
    
    if result.returncode == 0:
        logger.info(f"Successfully deleted: {file_path}")
        return True
    else:
        logger.error(f"Failed to delete {file_path}: {result.stderr}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Delete specific files from Cloudflare R2")
    parser.add_argument("filenames", nargs='+', help="Files to delete")
    parser.add_argument("--bucket", default="autoshorts-media", help="Bucket name (default: autoshorts-media)")
    parser.add_argument("--dry-run", action="store_true", help="Only check what would be deleted")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    bucket_name = args.bucket
    dry_run = args.dry_run
    
    logger.info(f"Starting deletion of {len(args.filenames)} files (dry run: {dry_run})")
    
    # Track results
    success_count = 0
    failure_count = 0
    
    # Process each file
    for filename in args.filenames:
        if delete_file(bucket_name, filename, dry_run):
            success_count += 1
        else:
            failure_count += 1
    
    # Report results
    logger.info(f"Deletion complete: {success_count} succeeded, {failure_count} failed")
    
    # Return success if all operations succeeded
    return 0 if failure_count == 0 else 1

if __name__ == "__main__":
    sys.exit(main()) 