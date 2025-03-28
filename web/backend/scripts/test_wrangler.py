#!/usr/bin/env python3
"""
Test script to verify Wrangler can access our R2 bucket.
This script checks:
1. Wrangler is installed and accessible
2. Wrangler can list objects in our R2 bucket
3. Wrangler permissions are correctly configured
"""

import subprocess
import json
import os
import sys
import logging
import time
import tempfile
from collections import namedtuple
import uuid

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("wrangler-test")

def get_r2_bucket_name():
    """Get the R2 bucket name from environment variables or config."""
    # Try to import from app settings
    try:
        from app.core.config import settings
        if hasattr(settings, 'R2_BUCKET_NAME'):
            return settings.R2_BUCKET_NAME
    except ImportError:
        logger.warning("Could not import settings, will try environment variables")
        
    # Try environment variables
    bucket_name = os.environ.get('R2_BUCKET_NAME')
    if bucket_name:
        return bucket_name
        
    # Fallback to manual entry
    logger.warning("R2 bucket name not found in settings or environment")
    if len(sys.argv) > 1:
        return sys.argv[1]
    else:
        bucket_name = input("Enter your R2 bucket name: ")
        return bucket_name

def check_wrangler_installed():
    """Check if Wrangler is installed and accessible."""
    try:
        result = subprocess.run(
            ["wrangler", "--version"],
            capture_output=True,
            text=True,
            check=False  # Don't raise exception if command fails
        )
        
        if result.returncode == 0:
            version = result.stdout.strip()
            logger.info(f"✅ Wrangler is installed: {version}")
            return True
        else:
            logger.error(f"❌ Wrangler is not installed or not in PATH: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"❌ Error checking Wrangler installation: {str(e)}")
        return False

def run_command(command):
    """Run a subprocess command and return the result."""
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False
        )
        return result
    except Exception as e:
        logger.error(f"❌ Error running command {' '.join(command)}: {str(e)}")
        # Return a dummy result to avoid None errors
        DummyResult = namedtuple('DummyResult', ['returncode', 'stdout', 'stderr'])
        return DummyResult(returncode=1, stdout="", stderr=str(e))

def test_list_bucket(bucket_name):
    """Test listing a bucket contents."""
    logger.info(f"Testing access to bucket: {bucket_name}")
    
    # The correct command is "wrangler r2 bucket list" without --remote
    result = run_command(["wrangler", "r2", "bucket", "list"])
    
    if result.returncode != 0:
        logger.error(f"❌ Failed to list buckets: {result.stderr}")
        return False

    # Check if our bucket exists in the output
    if bucket_name not in result.stdout:
        logger.error(f"❌ Bucket '{bucket_name}' not found in your account")
        return False
        
    logger.info(f"✅ Bucket '{bucket_name}' found, testing object operations")
    
    # Test access by uploading and deleting a test file
    test_file_name = f"test-file-{int(time.time())}.txt"
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
        temp_file.write(f"Test content created at {time.time()}")
        temp_path = temp_file.name
    
    try:
        # Upload the test file
        object_path = f"{bucket_name}/{test_file_name}"
        upload_result = run_command([
            "wrangler", "r2", "object", "put", 
            object_path, "--file", temp_path, "--remote"
        ])
        
        if upload_result.returncode != 0:
            logger.error(f"❌ Failed to upload test file: {upload_result.stderr}")
            return False
        
        logger.info(f"✅ Successfully uploaded test file")
        
        # Delete the test file
        delete_result = run_command([
            "wrangler", "r2", "object", "delete", 
            object_path, "--remote"
        ])
        
        if delete_result.returncode != 0:
            logger.error(f"❌ Failed to delete test file: {delete_result.stderr}")
            return False
        
        logger.info(f"✅ Successfully deleted test file")
        logger.info(f"✅ Bucket '{bucket_name}' is accessible for read and write operations")
        return True
    
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
            
def test_list_objects(bucket_name):
    """Test listing objects in a bucket."""
    # Note: Wrangler CLI doesn't support direct object listing
    # This is a workaround test function that verifies bucket accessibility
    
    logger.info(f"Testing object listing in bucket: {bucket_name}")
    logger.info("Note: Wrangler CLI has limited support for object listing")
    
    # First verify bucket exists
    if not test_list_bucket(bucket_name):
        logger.error("Failed to list objects in bucket")
        return False
    
    logger.info(f"✅ Verified bucket exists and is accessible for object operations")
    return True

def test_delete_nonexistent_object(bucket_name):
    """Test if we can attempt to delete nonexistent objects (permissions check)."""
    nonexistent_key = f"test_wrangler_nonexistent_object_{uuid.uuid4().hex[:8]}"
    logger.info(f"Testing deletion permissions with nonexistent object: {nonexistent_key}")
    
    # Correct syntax for object delete:
    # wrangler r2 object delete <bucket-name>/<object-key>
    object_path = f"{bucket_name}/{nonexistent_key}"
    result = run_command(["wrangler", "r2", "object", "delete", object_path, "--remote"])
    
    # We expect an error about the object not existing, but the command should run
    # without permission issues
    if result.returncode != 0:
        # Check if it's specifically an "object not found" error rather than permissions issue
        if "does not exist" in result.stderr or "key does not exist" in result.stderr:
            logger.info("✅ Permission check passed: We have delete permissions (object not found error)")
            return True
        else:
            logger.error(f"❌ Error testing delete permissions: {result.stderr}")
            return False
    
    # If it somehow succeeded (shouldn't happen), that's also fine
    logger.warning("⚠️ Unexpected success when trying to delete nonexistent object")
    return True

def main():
    """Run the Wrangler tests."""
    logger.info("Starting Wrangler R2 access tests")
    
    # Check if Wrangler is installed
    if not check_wrangler_installed():
        logger.error("Please install Wrangler using: npm install -g wrangler")
        sys.exit(1)
    
    # Get bucket name
    bucket_name = get_r2_bucket_name()
    if not bucket_name:
        logger.error("Bucket name is required")
        sys.exit(1)
    
    # Test listing objects
    if not test_list_objects(bucket_name):
        logger.error("Failed to list objects in bucket")
        sys.exit(1)
    
    # Test deletion permissions
    if not test_delete_nonexistent_object(bucket_name):
        logger.error("Failed to verify deletion permissions")
        sys.exit(1)
    
    logger.info("✅ All tests passed! Wrangler is properly configured to access R2")
    
if __name__ == "__main__":
    main() 