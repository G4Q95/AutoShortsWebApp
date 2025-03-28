#!/usr/bin/env python3
"""
Test script for fast R2 file deletion.
"""

import os
import sys
import time
import argparse
import logging
import subprocess

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def quick_delete(bucket_name: str, file_pattern: str) -> bool:
    """
    Directly delete a specific file without any checks.
    """
    try:
        # Create the full path for the delete command
        object_path = f"{bucket_name}/{file_pattern}"
        # Execute the deletion directly without waiting
        delete_cmd = ["wrangler", "r2", "object", "delete", object_path, "--remote"]
        subprocess.Popen(delete_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception as e:
        logger.warning(f"Quick delete failed for {file_pattern}: {str(e)}")
        return False

def delete_objects_by_project_id(bucket_name: str, project_id: str, dry_run: bool = False) -> dict:
    """
    Delete all objects associated with a project ID.
    """
    results = {
        "project_id": project_id,
        "deleted_objects": [],
        "total_deleted": 0,
        "dry_run": dry_run
    }
    
    # Normalize project ID
    if not project_id.startswith("proj_"):
        project_id_with_prefix = f"proj_{project_id}"
    else:
        project_id_with_prefix = project_id
        
    # Extract clean ID without prefix
    project_id_clean = project_id_with_prefix.replace("proj_", "")
    
    # Fast direct deletion approach - use known file pattern formats
    file_patterns = [
        # Standard media files
        f"proj_{project_id_clean}_media.mp4",
        f"proj_{project_id_clean}_scene1_media.mp4",
        f"proj_{project_id_clean}_scene2_media.mp4",
        
        # Audio files
        f"proj_{project_id_clean}_audio.mp3",
        f"proj_{project_id_clean}_scene1_audio.mp3",
        f"proj_{project_id_clean}_scene2_audio.mp3",
        
        # Double prefix pattern
        f"proj_proj_{project_id_clean}_media.mp4",
        f"proj_proj_{project_id_clean}_scene1_media.mp4",
        f"proj_proj_{project_id_clean}_scene2_media.mp4",
        
        # Timestamp patterns (use unix timestamp)
        f"proj_{project_id_clean}_{int(time.time())}_media.mp4",
        
        # Double-dash patterns
        f"proj_{project_id_clean}_media.mp4--",
        f"proj_{project_id_clean}_scene1_media.mp4--",
        f"proj_{project_id_clean}_scene2_media.mp4--",
    ]
    
    # Add common voice providers to audio patterns
    voice_providers = ["adam", "dorothy", "clyde", "eleven"]
    for voice in voice_providers:
        file_patterns.append(f"proj_{project_id_clean}_audio_{voice}.mp3")
        file_patterns.append(f"proj_{project_id_clean}_scene1_audio_{voice}.mp3")
        file_patterns.append(f"proj_{project_id_clean}_scene2_audio_{voice}.mp3")
    
    logger.info(f"Checking {len(file_patterns)} common file patterns for project {project_id}")
    
    # Skip actual deletion for dry run
    if dry_run:
        logger.info(f"DRY RUN - would check these patterns: {file_patterns}")
        results["would_check_patterns"] = file_patterns
        return results
    
    # Efficient batch execution - try to delete each pattern directly
    deleted_count = 0
        
    for file_key in file_patterns:
        # Direct parallel deletion attempts
        if quick_delete(bucket_name, file_key):
            results["deleted_objects"].append(file_key)
            deleted_count += 1
    
    # Record results
    results["total_deleted"] = deleted_count
    
    logger.info(f"Submitted {deleted_count} deletion operations for project {project_id}")
    
    return results

def main():
    parser = argparse.ArgumentParser(description="Fast R2 file deletion test")
    parser.add_argument("project_id", help="Project ID to delete files for")
    parser.add_argument("--bucket", default="autoshorts-media", help="R2 bucket name")
    parser.add_argument("--dry-run", action="store_true", help="Dry run mode - don't actually delete")
    args = parser.parse_args()

    logger.info(f"Starting fast deletion for project: {args.project_id}")
    
    # Start timing
    start_time = time.time()
    
    # Run deletion
    results = delete_objects_by_project_id(args.bucket, args.project_id, dry_run=args.dry_run)
    
    # End timing
    end_time = time.time()
    
    # Report results
    logger.info(f"Deletion operation completed in {end_time - start_time:.2f} seconds")
    logger.info(f"Submitted {results['total_deleted']} deletion operations")
    logger.info("Note: Deletions are running in parallel and may still be in progress")
    
    if args.dry_run:
        logger.info(f"DRY RUN - would check {len(results['would_check_patterns'])} patterns")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 