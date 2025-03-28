#!/usr/bin/env python3
"""
Updated Wrangler R2 test script that tests basic operations with the WranglerR2Client.
"""

import os
import sys
import logging
import tempfile
import time
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test_wrangler")

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Import the WranglerR2Client class
from app.services.wrangler_r2 import WranglerR2Client

def test_upload_and_delete(client, test_key):
    """Test uploading and deleting a file."""
    # Create a temporary file
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
        temp_file.write(f"Test content generated at {time.time()}")
        temp_path = temp_file.name
    
    try:
        logger.info(f"Testing upload with temp file: {temp_path}")
        # Upload the file
        upload_success = client.upload_file(temp_path, test_key)
        if not upload_success:
            logger.error("Upload failed")
            return False
        
        logger.info("Upload successful")
        
        # Check if the file exists
        exists = client.object_exists(test_key)
        if not exists:
            logger.error("Object not found after upload")
            return False
        
        logger.info("Object exists after upload")
        
        # Delete the file
        delete_success = client.delete_object(test_key)
        if not delete_success:
            logger.error("Delete failed")
            return False
        
        logger.info("Delete successful")
        
        # Verify it's gone
        exists = client.object_exists(test_key)
        if exists:
            logger.error("Object still exists after deletion")
            return False
        
        logger.info("Object no longer exists after deletion")
        return True
    
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def test_list_objects(client):
    """Test listing objects in the bucket."""
    # Since we know Wrangler CLI doesn't support proper object listing,
    # we'll just test if the list_objects function correctly verifies bucket accessibility
    
    logger.info("Listing objects (Note: Limited due to Wrangler CLI capabilities)")
    objects = client.list_objects()
    
    # Check if we got any response indicating bucket accessibility
    if not objects:
        logger.error("Bucket accessibility test failed - no response from list_objects")
        return False
    
    # Check if the response indicates bucket is accessible
    for obj in objects:
        if obj.get("accessible"):
            logger.info("Verified bucket exists and is accessible")
            return True
    
    logger.error("Bucket not accessible according to list_objects response")
    return False

def main():
    # Get bucket name from command line argument or use default
    bucket_name = sys.argv[1] if len(sys.argv) > 1 else "autoshorts-media"
    
    logger.info(f"Testing Wrangler R2 client with bucket: {bucket_name}")
    
    # Create client
    client = WranglerR2Client(bucket_name)
    
    # Test upload and delete
    test_key = f"test_file_{int(time.time())}.txt"
    logger.info("=== Testing Upload and Delete ===")
    upload_delete_success = test_upload_and_delete(client, test_key)
    
    # Test list objects
    logger.info("=== Testing List Objects ===")
    list_success = test_list_objects(client)
    
    # Print results
    logger.info("=== Test Results ===")
    logger.info(f"Upload and Delete: {'SUCCESS' if upload_delete_success else 'FAIL'}")
    logger.info(f"List Objects: {'SUCCESS' if list_success else 'FAIL'}")
    
    # Return success/failure
    if upload_delete_success and list_success:
        logger.info("All tests passed!")
        return 0
    else:
        logger.error("Some tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
