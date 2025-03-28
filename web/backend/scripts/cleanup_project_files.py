#!/usr/bin/env python3
"""
Cleanup project files in R2 storage using the Wrangler-based approach.

Usage:
    python cleanup_project_files.py <project_id> [--dry-run]

Arguments:
    project_id   The ID of the project to clean up files for
    --dry-run    Only list files that would be deleted without actually deleting them

Examples:
    python cleanup_project_files.py proj_abc123
    python cleanup_project_files.py abc123 --dry-run
"""

import asyncio
import sys
import os
import argparse
import json
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Import project service
from app.services.project import cleanup_project_storage

async def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Cleanup project files in R2 storage")
    parser.add_argument("project_id", help="The ID of the project to clean up files for")
    parser.add_argument("--dry-run", action="store_true", help="Only list files that would be deleted without actually deleting them")
    args = parser.parse_args()
    
    # Extract project ID and dry run flag
    project_id = args.project_id
    dry_run = args.dry_run
    
    logger.info(f"Starting cleanup for project {project_id} (dry run: {dry_run})")
    
    try:
        # Call the cleanup function
        results = await cleanup_project_storage(project_id, dry_run=dry_run)
        
        # Print results
        if dry_run:
            logger.info(f"DRY RUN: Would delete {len(results.get('would_delete', []))} files")
            
            # Print the first 10 files that would be deleted
            files_to_delete = results.get("would_delete", [])
            if files_to_delete:
                logger.info("First 10 files that would be deleted:")
                for i, file_key in enumerate(files_to_delete[:10]):
                    logger.info(f"  {i+1}. {file_key}")
                
                if len(files_to_delete) > 10:
                    logger.info(f"  ... and {len(files_to_delete) - 10} more files")
            else:
                logger.info("No files found matching the project ID")
        else:
            logger.info(f"Successfully deleted {results['total_deleted']} files")
            
            if results["total_failed"] > 0:
                logger.warning(f"Failed to delete {results['total_failed']} files")
                logger.warning("First 10 failed files:")
                for i, file_key in enumerate(results.get("failed_objects", [])[:10]):
                    logger.warning(f"  {i+1}. {file_key}")
    
    except Exception as e:
        logger.error(f"Error cleaning up project files: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(result) 