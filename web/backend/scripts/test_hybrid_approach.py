#!/usr/bin/env python3
"""
Test script for the hybrid approach of using S3 API for listing objects
and Wrangler for operations on Cloudflare R2 bucket.

This script demonstrates how to:
1. Use S3 API for comprehensive object listing
2. Use Wrangler for reliable object operations (upload, delete)

Usage:
    ./test_hybrid_approach.py <bucket_name> [--delete-test] [--project-id <project_id>]
"""

import os
import sys
import time
import logging
import tempfile
import argparse
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

# Add the parent directory to sys.path to import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("hybrid-test")

# Import the services
try:
    from app.services.wrangler_r2 import WranglerR2Client
    from app.services.storage import storage as s3_storage
    from app.core.config import settings  # Fixed import path
except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    logger.error("Make sure you're running this script from the backend directory")
    sys.exit(1)

# Define a get_settings function since we're directly importing the settings instance
def get_settings():
    return settings

async def test_list_objects_s3(bucket_name: str, prefix: str = None) -> Tuple[bool, List[Dict[str, Any]]]:
    """List objects using S3 API which has better listing capabilities."""
    logger.info(f"Testing S3 API for listing objects in bucket: {bucket_name}")
    
    # Initialize S3 client
    s3_client = await s3_storage.get_s3_client()
    
    # List objects
    objects = []
    
    try:
        # Use the regular list_objects_v2 instead of paginator for simplicity
        logger.info(f"Listing objects with prefix: {prefix if prefix else 'None'}")
        
        # Set up parameters
        params = {'Bucket': bucket_name, 'MaxKeys': 100}  # Limit to 100 objects
        if prefix:
            params['Prefix'] = prefix
            
        # Execute the list operation
        response = await s3_client.list_objects_v2(**params)
        
        # Process results
        if "Contents" in response:
            for obj in response["Contents"]:
                objects.append({
                    "key": obj["Key"],
                    "size": obj["Size"],
                    "last_modified": obj["LastModified"].isoformat()
                })
    
        logger.info(f"S3 API found {len(objects)} objects in bucket: {bucket_name}")
        
        # Print first 5 objects for verification
        if objects:
            logger.info("Sample objects:")
            for i, obj in enumerate(objects[:5]):
                logger.info(f"  {i+1}. {obj['key']} ({obj['size']} bytes)")
                
        return True, objects
                
    except Exception as e:
        logger.error(f"S3 API Error listing objects: {str(e)}")
        logger.error(f"Error type: {type(e)}")
        return False, []

async def test_operations_wrangler(bucket_name: str, delete_test: bool = False) -> bool:
    """Test operations using Wrangler CLI which has more reliable operations."""
    logger.info(f"Testing Wrangler for operations in bucket: {bucket_name}")
    
    # Initialize Wrangler client
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Create a test file
    test_key = f"test_hybrid_{int(time.time())}.txt"
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
        temp_file.write(f"Test content for hybrid approach at {time.time()}")
        temp_path = temp_file.name
    
    try:
        # 1. Test upload
        logger.info(f"Uploading test file: {test_key}")
        upload_success = wrangler_client.upload_file(temp_path, test_key)
        if not upload_success:
            logger.error("Wrangler upload failed")
            return False
        
        logger.info("Wrangler upload successful")
        
        # 2. Test check existence
        exists = wrangler_client.object_exists(test_key)
        if not exists:
            logger.error("Object doesn't exist after upload")
            return False
        
        logger.info("Wrangler existence check successful")
        
        # 3. Test deletion if requested
        if delete_test:
            logger.info(f"Deleting test file: {test_key}")
            delete_success = wrangler_client.delete_object(test_key)
            if not delete_success:
                logger.error("Wrangler deletion failed")
                return False
            
            logger.info("Wrangler deletion successful")
            
            # Verify deletion
            exists = wrangler_client.object_exists(test_key)
            if exists:
                logger.error("Object still exists after deletion")
                return False
            
            logger.info("Wrangler deletion verification successful")
        
        return True
    
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        
        # Clean up the test file in R2 if not already deleted
        if not delete_test:
            logger.info(f"Cleaning up test file: {test_key}")
            wrangler_client.delete_object(test_key)

async def test_hybrid_project_cleanup(bucket_name: str, project_id: str) -> Dict[str, Any]:
    """Test hybrid cleanup for a project using S3 for listing and Wrangler for deletion."""
    logger.info(f"Testing hybrid cleanup for project: {project_id} in bucket: {bucket_name}")
    
    # Initialize clients
    s3_client = await s3_storage.get_s3_client()
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Normalize project ID
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Create variations to search for
    variations = []
    if project_id.startswith("proj_"):
        clean_id = project_id.replace("proj_", "")
        variations.extend([
            project_id,  # Original with proj_ prefix
            clean_id,    # Without proj_ prefix
            f"proj_{clean_id}"  # In case of double prefix
        ])
    else:
        variations.extend([
            project_id,         # Original without prefix
            f"proj_{project_id}"  # With prefix added
        ])
    
    # Track results
    results = {
        "project_id": project_id,
        "variations": variations,
        "found_objects": [],
        "total_found": 0,
        "s3_api_working": False,
    }
    
    # Try S3 API first for comprehensive listing
    s3_api_working = False
    all_matching_objects = []
    
    # 1. Use S3 to list all objects
    logger.info(f"Using S3 API to list all objects for variations: {variations}")
    
    for variant in variations:
        # Try direct prefix matching
        prefix = f"{variant}_"
        logger.info(f"Checking prefix: {prefix}")
        
        success, objects = await test_list_objects_s3(bucket_name, prefix)
        if success and objects:
            logger.info(f"S3 API: Found {len(objects)} objects with prefix: {prefix}")
            all_matching_objects.extend(objects)
            s3_api_working = True
    
    # If S3 API didn't work, use Wrangler as fallback
    if not s3_api_working:
        logger.warning("S3 API failed, falling back to Wrangler for object listing")
        # Note: This is limited because Wrangler doesn't have robust listing capabilities
        objects = wrangler_client.list_objects()
        if objects:
            logger.info(f"Wrangler reported bucket is accessible")
            results["wrangler_access"] = True
        else:
            logger.error("Wrangler could not access the bucket")
            results["wrangler_access"] = False
    else:
        # Process the objects found by S3 API
        # Remove duplicates
        unique_objects = {}
        for obj in all_matching_objects:
            key = obj.get("key")
            if key:
                unique_objects[key] = obj
        
        results["found_objects"] = list(unique_objects.values())
        results["total_found"] = len(results["found_objects"])
        results["s3_api_working"] = True
        
        logger.info(f"Found {results['total_found']} unique objects associated with project: {project_id}")
    
    return results

async def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Test hybrid approach for Cloudflare R2')
    parser.add_argument('bucket_name', help='Name of the R2 bucket to use')
    parser.add_argument('--delete-test', action='store_true', help='Run deletion test')
    parser.add_argument('--project-id', help='Project ID to test cleanup for')
    parser.add_argument('--skip-s3', action='store_true', help='Skip S3 API tests (if authentication fails)')
    args = parser.parse_args()
    
    # Run the tests
    try:
        s3_working = True
        
        # 1. List objects using S3 API (skip if requested)
        if not args.skip_s3:
            s3_success, _ = await test_list_objects_s3(args.bucket_name)
            s3_working = s3_success
        else:
            logger.info("Skipping S3 API tests as requested")
            s3_working = False
        
        # 2. Test operations using Wrangler
        logger.info("============ WRANGLER OPERATIONS TEST ============")
        operations_success = await test_operations_wrangler(args.bucket_name, args.delete_test)
        
        if operations_success:
            logger.info("✅ Wrangler operations test PASSED")
        else:
            logger.error("❌ Wrangler operations test FAILED")
        
        # 3. Test project cleanup if project ID provided
        if args.project_id:
            logger.info("============ HYBRID CLEANUP TEST ============")
            cleanup_results = await test_hybrid_project_cleanup(args.bucket_name, args.project_id)
            if cleanup_results["s3_api_working"]:
                logger.info(f"Hybrid cleanup found {cleanup_results['total_found']} objects for project: {args.project_id}")
            else:
                logger.warning("Hybrid cleanup test limited due to S3 API authentication issues")
                logger.info("Consider using a direct Wrangler approach for production")
        
        logger.info("============ TEST SUMMARY ============")
        logger.info(f"S3 API Working: {s3_working}")
        logger.info(f"Wrangler Operations Working: {operations_success}")
        logger.info("All tests completed")
        
        return 0 if operations_success else 1
        
    except Exception as e:
        logger.error(f"Error during test: {str(e)}")
        return 1

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <bucket_name> [--delete-test] [--project-id <project_id>]")
        sys.exit(1)
    
    # Run the async main function
    sys.exit(asyncio.run(main()))
