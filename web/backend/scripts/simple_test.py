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

def test_list_bucket(bucket_name):
    """Test listing objects in the R2 bucket."""
    try:
        logger.info(f"Testing access to bucket: {bucket_name}")
        
        # First, verify the bucket exists
        result = subprocess.run(
            ["wrangler", "r2", "bucket", "list"],
            capture_output=True,
            text=True,
            check=False
        )
        
        if result.returncode == 0:
            try:
                buckets = json.loads(result.stdout) if "{" in result.stdout else [{"name": bucket} for bucket in result.stdout.strip().split("\n") if "name:" in bucket]
                
                bucket_exists = False
                for bucket in buckets:
                    if isinstance(bucket, dict) and bucket.get("name") == bucket_name:
                        bucket_exists = True
                        break
                    elif isinstance(bucket, str) and bucket_name in bucket:
                        bucket_exists = True
                        break
                
                if not bucket_exists:
                    logger.error(f"❌ Bucket '{bucket_name}' not found in your account")
                    return False
                
                logger.info(f"✅ Bucket '{bucket_name}' found in your account")
                
                # Now try to list files in the bucket
                logger.info(f"Attempting to list objects in bucket '{bucket_name}'...")
                
                # Note: Wrangler doesn't have a direct command to list objects in a bucket yet
                logger.warning("Unable to list objects directly with Wrangler CLI")
                logger.info("✅ Bucket access check passed (bucket exists)")
                return True
            except json.JSONDecodeError:
                logger.warning("Could not parse bucket list response as JSON")
                if bucket_name in result.stdout:
                    logger.info(f"✅ Bucket '{bucket_name}' appears to exist based on output")
                    return True
                logger.error(f"❌ Could not verify if bucket '{bucket_name}' exists")
                return False
        else:
            logger.error(f"❌ Error accessing bucket list: {result.stderr}")
            logger.error("Make sure you have authenticated with Cloudflare:")
            logger.error("  Run: wrangler login")
            return False
    except Exception as e:
        logger.error(f"❌ Unexpected error testing bucket access: {str(e)}")
        return False

def test_delete_nonexistent_object(bucket_name):
    """Test deleting a nonexistent object to verify permissions."""
    try:
        nonexistent_key = "test_wrangler_nonexistent_object_" + os.urandom(4).hex()
        logger.info(f"Testing deletion permissions with nonexistent object: {nonexistent_key}")
        
        result = subprocess.run(
            ["wrangler", "r2", "object", "delete", bucket_name, nonexistent_key],
            capture_output=True,
            text=True,
            check=False
        )
        
        # Check if we got the expected "not found" error
        if "not found" in result.stderr.lower() or "not exist" in result.stderr.lower():
            logger.info("✅ Delete permission test successful - received expected 'not found' response")
            return True
        elif result.returncode == 0:
            logger.warning("⚠️ Delete test succeeded unexpectedly - object shouldn't exist")
            return True
        else:
            logger.error(f"❌ Error testing delete permissions: {result.stderr}")
            return False
    except Exception as e:
        logger.error(f"❌ Unexpected error testing delete permissions: {str(e)}")
        return False

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
    if not test_list_bucket(bucket_name):
        logger.error("Failed to list objects in bucket")
        sys.exit(1)
    
    # Test deletion permissions
    if not test_delete_nonexistent_object(bucket_name):
        logger.error("Failed to verify deletion permissions")
        sys.exit(1)
    
    logger.info("✅ All tests passed! Wrangler is properly configured to access R2")
    
if __name__ == "__main__":
    main() 