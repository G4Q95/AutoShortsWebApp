#!/usr/bin/env python3
"""
Test script for R2 deletion functionality.
This script creates test files in R2 with project ID prefixes and then tests deletion.
"""

import sys
import os
import time
import logging
import argparse
import tempfile
from pathlib import Path

# Add backend to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("test-deletion")

# Import project-specific modules
try:
    from app.services.wrangler_r2 import WranglerR2Client
    from app.core.config import settings
except ImportError as e:
    logger.error(f"Failed to import required modules: {e}")
    sys.exit(1)

def create_test_files(wrangler_client, project_id, count=3):
    """Create test files in R2 with the project ID prefix."""
    logger.info(f"Creating {count} test files for project: {project_id}")
    
    created_files = []
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
        temp_file.write(f"Test content for project {project_id} created at {time.time()}")
        temp_path = temp_file.name
        
        try:
            # Create files with different prefixes to test various formats
            for i in range(count):
                # Different file name patterns to test
                if i == 0:
                    # Standard format: proj_ID_scene_media
                    key = f"{project_id}_scene1_media_{int(time.time())}.txt"
                elif i == 1:
                    # Format with double prefix: proj_proj_ID_scene_media
                    if project_id.startswith("proj_"):
                        clean_id = project_id.replace("proj_", "")
                        key = f"proj_proj_{clean_id}_scene2_media_{int(time.time())}.txt"
                    else:
                        key = f"proj_proj_{project_id}_scene2_media_{int(time.time())}.txt"
                else:
                    # Format with additional content: proj_ID_OTHER
                    key = f"{project_id}_other_content_{int(time.time())}.txt"
                
                # Upload the file
                success = wrangler_client.upload_file(temp_path, key)
                if success:
                    logger.info(f"Successfully created test file: {key}")
                    created_files.append(key)
                else:
                    logger.error(f"Failed to create test file: {key}")
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    return created_files

def verify_files_exist(wrangler_client, file_keys):
    """Verify that the given files exist in R2."""
    logger.info(f"Verifying {len(file_keys)} files exist")
    
    all_exist = True
    for key in file_keys:
        exists = wrangler_client.object_exists(key)
        if exists:
            logger.info(f"✅ File exists: {key}")
        else:
            logger.error(f"❌ File does not exist: {key}")
            all_exist = False
    
    return all_exist

def list_bucket_files(wrangler_client):
    """List files in the bucket using wrangler commands."""
    bucket_name = wrangler_client.bucket_name
    logger.info(f"Attempting to list files in bucket: {bucket_name}")
    
    # Since Wrangler CLI doesn't have a good way to list objects,
    # we'll use a workaround to upload and delete a test file
    test_key = f"_test_list_{int(time.time())}.txt"
    with tempfile.NamedTemporaryFile(delete=False, mode="w") as temp_file:
        temp_file.write("Test content")
        temp_path = temp_file.name
    
    try:
        upload_success = wrangler_client.upload_file(temp_path, test_key)
        if upload_success:
            logger.info(f"Successfully verified bucket access by uploading test file: {test_key}")
            
            # Delete the test file
            delete_success = wrangler_client.delete_object(test_key)
            if delete_success:
                logger.info(f"Successfully verified deletion by removing test file: {test_key}")
            else:
                logger.warning(f"Failed to delete test file: {test_key}")
                
            logger.info("Bucket exists and is accessible, but Wrangler doesn't support listing all files directly.")
            
            return True
        else:
            logger.error(f"Failed to verify bucket access - could not upload test file")
            return False
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def delete_project_files(wrangler_client, project_id):
    """Delete files associated with the project using the cleanup function."""
    logger.info(f"Deleting files for project: {project_id}")
    
    from app.services.project import cleanup_project_storage
    import asyncio
    
    # Run the async cleanup function
    results = asyncio.run(cleanup_project_storage(project_id))
    
    if results["total_deleted"] > 0:
        logger.info(f"✅ Successfully deleted {results['total_deleted']} files")
        for file in results.get("deleted_objects", []):
            logger.info(f"  - Deleted: {file}")
    else:
        logger.warning(f"⚠️ No files were deleted for project: {project_id}")
        
    if results.get("total_failed", 0) > 0:
        logger.error(f"❌ Failed to delete {results['total_failed']} files")
        for file in results.get("failed_objects", []):
            logger.error(f"  - Failed to delete: {file}")
    
    return results

def verify_files_deleted(wrangler_client, file_keys):
    """Verify that the given files no longer exist in R2."""
    logger.info(f"Verifying {len(file_keys)} files have been deleted")
    
    all_deleted = True
    for key in file_keys:
        exists = wrangler_client.object_exists(key)
        if exists:
            logger.error(f"❌ File still exists and was not deleted: {key}")
            all_deleted = False
        else:
            logger.info(f"✅ File was successfully deleted: {key}")
    
    return all_deleted

def main():
    """Main function to execute the test."""
    parser = argparse.ArgumentParser(description="Test R2 deletion functionality")
    parser.add_argument("--bucket", help="R2 bucket name", default=settings.R2_BUCKET_NAME)
    parser.add_argument("--project-id", help="Project ID to use for testing", default=f"proj_test_{int(time.time())}")
    parser.add_argument("--cleanup-only", help="Only clean up files for project-id without creating test files", action="store_true")
    args = parser.parse_args()
    
    bucket_name = args.bucket
    project_id = args.project_id
    
    # Initialize Wrangler client
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Print test information
    logger.info("R2 Deletion Test")
    logger.info(f"Bucket: {bucket_name}")
    logger.info(f"Project ID: {project_id}")
    
    # First verify bucket access
    logger.info("========== STEP 1: VERIFY BUCKET ACCESS ==========")
    if not list_bucket_files(wrangler_client):
        logger.error("Failed to access bucket, aborting test")
        return 1
    
    created_files = []
    if not args.cleanup_only:
        # Create test files
        logger.info("========== STEP 2: CREATE TEST FILES ==========")
        created_files = create_test_files(wrangler_client, project_id)
        if not created_files:
            logger.error("Failed to create test files, aborting test")
            return 1
        
        # Verify files exist
        logger.info("========== STEP 3: VERIFY FILES EXIST ==========")
        if not verify_files_exist(wrangler_client, created_files):
            logger.warning("Some files were not created properly")
    
    # Delete project files
    logger.info("========== STEP 4: DELETE PROJECT FILES ==========")
    results = delete_project_files(wrangler_client, project_id)
    
    # Verify files were deleted
    if not args.cleanup_only and created_files:
        logger.info("========== STEP 5: VERIFY FILES DELETED ==========")
        if verify_files_deleted(wrangler_client, created_files):
            logger.info("✅ SUCCESS: All files were successfully deleted")
        else:
            logger.error("❌ ERROR: Some files were not deleted")
            return 1
    
    logger.info("Test completed")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 