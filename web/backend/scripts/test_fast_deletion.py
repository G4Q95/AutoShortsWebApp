#!/usr/bin/env python3
"""
Fast R2 Deletion Test Script

This script demonstrates a fast parallel approach to deleting files from R2 storage
associated with a specific project ID. It's optimized for speed and efficiency.

Usage:
    python test_fast_deletion.py <project_id> [--dry-run] [--bucket <bucket_name>]

Example:
    python test_fast_deletion.py proj_abc123 --dry-run
"""

import os
import sys
import time
import argparse
import logging
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('fast-deletion')

def quick_delete(bucket_name, file_pattern, dry_run=False):
    """
    Delete a specific file pattern without any checks - fastest approach.
    
    Args:
        bucket_name: The R2 bucket name
        file_pattern: The exact file pattern to delete
        dry_run: If True, only print what would be deleted without actually deleting
        
    Returns:
        True if the command was submitted successfully
    """
    full_path = f"{bucket_name}/{file_pattern}"
    
    if dry_run:
        logger.info(f"[DRY RUN] Would delete: {full_path}")
        return True
    
    try:
        # Fast non-blocking deletion
        cmd = ["wrangler", "r2", "object", "delete", full_path, "--remote"]
        
        # Execute without waiting for completion
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        
        return True
        
    except Exception as e:
        logger.warning(f"Delete operation failed for {full_path}: {str(e)}")
        return False

def delete_objects_by_project_id(project_id, bucket, dry_run=False):
    """
    Delete all objects associated with a project ID using fast parallel approach.
    
    Args:
        project_id: The project ID to clean up
        bucket: The R2 bucket name
        dry_run: If True, only list objects without deleting
        
    Returns:
        Dictionary with deletion results
    """
    start_time = time.time()
    logger.info(f"Starting fast deletion for project_id: {project_id}")
    
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
    
    # Construct file patterns to search for
    file_patterns = []
    
    # For each variation, construct common patterns
    for variation in project_id_variations:
        # Media files
        file_patterns.append(f"{variation}_media.mp4")
        file_patterns.append(f"{variation}_media.jpg")
        file_patterns.append(f"{variation}_media.jpeg")
        file_patterns.append(f"{variation}_media.png")
        file_patterns.append(f"{variation}_media.webp")
        file_patterns.append(f"{variation}_media--.mp4")  # Handle double dash case
        
        # Scenes
        file_patterns.append(f"{variation}_scene_1.mp4")
        file_patterns.append(f"{variation}_scene_2.mp4")
        file_patterns.append(f"{variation}_scene_3.mp4")
        file_patterns.append(f"{variation}_scene--1.mp4")  # Handle double dash case
        
        # Audio files
        file_patterns.append(f"{variation}_audio.mp3")
        file_patterns.append(f"{variation}_audio.wav")
        file_patterns.append(f"{variation}_audio.m4a")
        file_patterns.append(f"{variation}_audio--.mp3")  # Handle double dash case
        
        # Generated files
        file_patterns.append(f"{variation}_generated.mp4")
        file_patterns.append(f"{variation}_output.mp4")
        file_patterns.append(f"{variation}_thumbnail.jpg")
    
    # Add more specific formats based on common patterns
    file_patterns.append(f"{project_id}.mp4")
    
    logger.info(f"Checking {len(file_patterns)} file patterns")
    logger.info(f"Common patterns to check: {file_patterns[:5]}...")
    
    # Track deletion statistics
    operations_submitted = 0
    
    # Launch deletion operations for every pattern in parallel
    for pattern in file_patterns:
        if quick_delete(bucket, pattern, dry_run):
            operations_submitted += 1
    
    end_time = time.time()
    duration = end_time - start_time
    
    if dry_run:
        logger.info(f"DRY RUN completed in {duration:.2f} seconds")
        logger.info(f"Would check {len(file_patterns)} patterns for deletion")
    else:
        logger.info(f"Deletion operation completed in {duration:.2f} seconds")
        logger.info(f"Submitted {operations_submitted} deletion operations")
        logger.info("Note: deletions run in parallel and may still be in progress")
    
    return operations_submitted

def main():
    parser = argparse.ArgumentParser(description="Fast R2 file deletion tool for projects")
    parser.add_argument("project_id", help="The project ID to clean up")
    parser.add_argument("--bucket", default="autoshorts-media", help="The R2 bucket name")
    parser.add_argument("--dry-run", action="store_true", help="Only print what would be deleted without actually deleting")
    
    args = parser.parse_args()
    
    logger.info(f"Starting fast deletion process for project: {args.project_id}")
    
    start_time = time.time()
    deletion_count = delete_objects_by_project_id(args.project_id, args.bucket, args.dry_run)
    end_time = time.time()
    
    duration = end_time - start_time
    logger.info(f"Fast deletion operation {'simulation' if args.dry_run else 'execution'} completed in {duration:.2f} seconds")
    logger.info(f"{'Would have submitted' if args.dry_run else 'Submitted'} {deletion_count} deletion operations")

if __name__ == "__main__":
    main() 