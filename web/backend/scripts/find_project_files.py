#!/usr/bin/env python3
"""
Find Project Files in R2 Storage

This script helps find files associated with a specific project ID in Cloudflare R2 storage.
It's useful for debugging when project files aren't being deleted properly.

Usage:
    python find_project_files.py proj_YOUR_PROJECT_ID
    
    Add --verbose to see detailed output
    
Example:
    python find_project_files.py proj_test_1743155878 --verbose
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

logger = logging.getLogger('find-project-files')

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
    command = ["r2", "object", "get", full_path, "--remote", "--no-download"]
    
    result = run_wrangler_command(command)
    
    # If the command succeeds, the file exists
    if result.returncode == 0:
        return True
    
    # If the error message indicates the file doesn't exist
    if "Object not found" in result.stderr or "not found" in result.stderr:
        return False
    
    # For other errors, log and assume the file doesn't exist
    logger.debug(f"Error checking {file_path}: {result.stderr}")
    return False

def generate_file_patterns(project_id: str) -> List[str]:
    """
    Generate common file patterns for the project ID
    Similar to the approach in the fast deletion script
    """
    # Track patterns to check
    file_patterns = []
    
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
        
    logger.info(f"Using project ID variations: {project_id_variations}")
    
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
        for i in range(3):  # Check a few possible timestamp variations
            file_patterns.append(f"{variation}_{i}_media.mp4")
            file_patterns.append(f"test_{variation}_{i}_media.mp4")
        
        # Scenes
        for i in range(1, 4):  # Check a few scenes
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
    
    # For the specific files we saw in the screenshot
    if project_id == "proj_m8sloqie_zhpekyfp1la459wf5pmo5":
        file_patterns.append("proj_m8sloqie_zhpekyfp1la459wf5pmo5_media.mp4")
    
    if project_id == "proj_m8smm0mg_7yuk5z9yvctc1mdfxynqjm":
        file_patterns.append("proj_m8smm0mg_7yuk5z9yvctc1mdfxynqjm_media.mp4")
    
    logger.info(f"Generated {len(file_patterns)} file patterns to check")
    
    return file_patterns

def find_project_files(project_id: str, bucket_name: str, verbose: bool = False) -> List[str]:
    """Find all files related to a project in the bucket"""
    logger.info(f"Finding files for project: {project_id}")
    
    start_time = time.time()
    
    # Generate all possible file patterns
    file_patterns = generate_file_patterns(project_id)
    
    if verbose:
        logger.info("Checking these patterns:")
        for pattern in file_patterns:
            logger.info(f"  - {pattern}")
    
    # Track found files
    found_files = []
    
    # Check each pattern
    total_patterns = len(file_patterns)
    for i, pattern in enumerate(file_patterns):
        if i % 10 == 0 and i > 0:
            logger.info(f"Progress: Checked {i}/{total_patterns} patterns...")
        
        if check_file_exists(bucket_name, pattern):
            logger.info(f"Found file: {pattern}")
            found_files.append(pattern)
    
    elapsed_time = time.time() - start_time
    logger.info(f"Search completed in {elapsed_time:.2f} seconds")
    logger.info(f"Found {len(found_files)} files out of {len(file_patterns)} patterns checked")
    
    return found_files

def main():
    parser = argparse.ArgumentParser(description="Find files for a specific project in Cloudflare R2")
    parser.add_argument("project_id", help="Project ID to search for (e.g., proj_abc123)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    parser.add_argument("--bucket", default="autoshorts-media", help="Bucket name (default: autoshorts-media)")
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    project_id = args.project_id
    bucket_name = args.bucket
    
    logger.info(f"Starting search for project ID: {project_id}")
    
    # Find all files for the project
    found_files = find_project_files(project_id, bucket_name, args.verbose)
    
    # Print the found files
    if found_files:
        logger.info("\nFound Files:")
        for i, file in enumerate(found_files):
            logger.info(f"{i+1}. {file}")
    else:
        logger.info("No files found for this project ID")
    
    return 0 if found_files else 1

if __name__ == "__main__":
    sys.exit(main()) 