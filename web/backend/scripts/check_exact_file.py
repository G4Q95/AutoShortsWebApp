#!/usr/bin/env python3
"""
Check if an exact file exists in Cloudflare R2

This script takes an exact filename and checks if it exists in Cloudflare R2.

Usage:
    python check_exact_file.py FILENAME [--verbose]
    
Example:
    python check_exact_file.py proj_m8sloqie_zhpekyfp1la459wf5pmo5_media.mp4
"""

import sys
import subprocess
import logging
import argparse
import os
import tempfile

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger('check-exact-file')

def check_file_exists(bucket_name: str, file_path: str) -> bool:
    """Check if a specific file exists in the bucket"""
    full_path = f"{bucket_name}/{file_path}"
    logger.info(f"Checking if file exists: {full_path}")
    
    try:
        # Create a temporary file to download to
        with tempfile.NamedTemporaryFile(delete=True) as temp_file:
            # Use wrangler to check if the file exists - note that we need to redirect output 
            # to avoid downloading the actual file
            command = ["wrangler", "r2", "object", "get", full_path, "--remote"]
            
            result = subprocess.run(
                command,
                stdout=subprocess.PIPE, 
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Log the full output in verbose mode
            if logger.level <= logging.DEBUG:
                logger.debug(f"Command output (truncated): {result.stdout[:100]}...")
                logger.debug(f"Command error: {result.stderr}")
            
            # If command succeeded, file exists
            if result.returncode == 0:
                logger.info(f"✅ File EXISTS: {file_path}")
                return True
            else:
                # Check if the error is "object not found"
                if "not found" in result.stderr.lower() or "object not found" in result.stderr.lower():
                    logger.info(f"❌ File DOES NOT EXIST: {file_path}")
                else:
                    logger.warning(f"❓ Error checking file: {result.stderr}")
                return False
                
    except Exception as e:
        logger.error(f"Error checking file: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Check if an exact file exists in Cloudflare R2")
    parser.add_argument("filename", help="Exact filename to check")
    parser.add_argument("--bucket", default="autoshorts-media", help="Bucket name (default: autoshorts-media)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose output")
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    filename = args.filename
    bucket = args.bucket
    
    # Check if the file exists
    exists = check_file_exists(bucket, filename)
    
    # Exit with success code if file exists
    return 0 if exists else 1

if __name__ == "__main__":
    sys.exit(main()) 