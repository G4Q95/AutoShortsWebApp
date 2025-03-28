#!/usr/bin/env python3
"""
Script to clear ALL objects from the R2 bucket.
Usage:
  python -m app.scripts.clear_entire_bucket --dry-run  # To see what would be deleted
  python -m app.scripts.clear_entire_bucket --force    # To actually delete everything
"""

import asyncio
import argparse
import logging
import boto3
from app.core.config import settings
from app.services.storage import storage as storage_service

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("clear_bucket")

async def clear_entire_bucket(dry_run=True):
    """
    Delete ALL objects from the R2 bucket.
    
    Args:
        dry_run: If True, only list objects without deleting them
    """
    logger.info(f"Starting R2 bucket cleanup - Dry run: {dry_run}")
    bucket_name = storage_service.bucket_name
    
    # List all objects in the bucket
    logger.info(f"Listing all objects in bucket: {bucket_name}")
    
    # Get all files in the bucket
    success, list_result = await storage_service.list_directory('')
    
    if not success:
        logger.error(f"Failed to list bucket contents: {list_result}")
        return
    
    all_objects = list_result
    
    # Group by prefix for reporting
    prefix_groups = {}
    
    for obj in all_objects:
        obj_key = obj["Key"]
        obj_size = obj.get("Size", 0)
        
        # Extract prefix - first directory or first part of filename
        prefix = obj_key.split("/")[0] if "/" in obj_key else obj_key.split("_")[0] if "_" in obj_key else "other"
        
        if prefix not in prefix_groups:
            prefix_groups[prefix] = {
                "count": 0,
                "size": 0,
                "objects": []
            }
        
        prefix_groups[prefix]["count"] += 1
        prefix_groups[prefix]["size"] += obj_size
        prefix_groups[prefix]["objects"].append(obj)
    
    # Log summary of found objects
    total_objects = len(all_objects)
    total_size = sum(obj.get("Size", 0) for obj in all_objects)
    logger.info(f"Found {total_objects} objects in bucket, total size: {total_size/1024/1024:.2f} MB")
    
    # Log breakdown by prefix
    logger.info("Object breakdown by prefix:")
    for prefix, data in prefix_groups.items():
        logger.info(f"  - {prefix}: {data['count']} objects, {data['size']/1024/1024:.2f} MB")
    
    # Sample objects for each prefix
    logger.info("Sample objects from each prefix:")
    for prefix, data in prefix_groups.items():
        logger.info(f"  Prefix: {prefix}")
        for obj in data["objects"][:3]:  # Show up to 3 objects per prefix
            logger.info(f"    - {obj['Key']} ({obj.get('Size', 0)/1024:.2f} KB)")
        if len(data["objects"]) > 3:
            logger.info(f"    - ...and {len(data['objects']) - 3} more")
    
    # Early return if this is just a dry run
    if dry_run:
        logger.info("DRY RUN MODE - No objects were deleted")
        logger.info(f"To delete all {total_objects} objects, run with --force")
        return
    
    # Confirm deletion with extra prompt if not forced
    logger.warning(f"!!! DELETING ALL {total_objects} OBJECTS FROM BUCKET !!!")
    
    # Create a direct boto3 S3 client for deletion
    s3_client = boto3.client(
        's3',
        endpoint_url=settings.R2_ENDPOINT,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto'
    )
    
    # Process in batches (S3 delete_objects has a limit of 1000 objects per request)
    deleted_count = 0
    failed_count = 0
    deleted_size = 0
    
    batch_size = 500
    for i in range(0, len(all_objects), batch_size):
        batch = all_objects[i:i + batch_size]
        
        # Skip empty batches
        if not batch:
            continue
            
        logger.info(f"Deleting batch {i//batch_size + 1}/{(len(all_objects) + batch_size - 1)//batch_size}: {len(batch)} objects")
        
        # Prepare objects for deletion
        objects_to_delete = [{"Key": obj["Key"]} for obj in batch]
        batch_size_bytes = sum(obj.get("Size", 0) for obj in batch)
        
        try:
            # Perform the deletion
            delete_response = s3_client.delete_objects(
                Bucket=bucket_name,
                Delete={"Objects": objects_to_delete}
            )
            
            # Count successful deletions
            if "Deleted" in delete_response:
                deleted_count += len(delete_response["Deleted"])
                deleted_size += batch_size_bytes
                
                # Log first 5 deletions
                for deleted in delete_response["Deleted"][:5]:
                    logger.info(f"  ✓ Deleted: {deleted.get('Key')}")
                if len(delete_response["Deleted"]) > 5:
                    logger.info(f"  ✓ ...and {len(delete_response['Deleted']) - 5} more files")
                
            # Count failed deletions
            if "Errors" in delete_response:
                failed_count += len(delete_response["Errors"])
                for error in delete_response["Errors"][:5]:  # Show first 5 errors at most
                    logger.error(f"  ✗ Failed to delete {error.get('Key')}: {error.get('Message')}")
                
                if len(delete_response["Errors"]) > 5:
                    logger.error(f"  ✗ ...and {len(delete_response['Errors']) - 5} more errors")
        
        except Exception as e:
            logger.error(f"Error deleting batch: {str(e)}")
            failed_count += len(batch)
    
    # Log final summary
    logger.info("R2 bucket cleanup completed")
    logger.info(f"  - Deleted: {deleted_count} objects ({deleted_size/1024/1024:.2f} MB)")
    logger.info(f"  - Failed: {failed_count} objects")
    
    # Verify bucket is now empty
    try:
        success, remaining_files = await storage_service.list_directory('')
        
        if not success:
            logger.error(f"Failed to verify if bucket is empty: {remaining_files}")
            return
            
        remaining_count = len(remaining_files)
        
        if remaining_count > 0:
            logger.warning(f"Bucket still contains {remaining_count} objects")
            for obj in remaining_files:
                logger.warning(f"  - Remaining: {obj['Key']}")
        else:
            logger.info("Bucket is now empty")
    
    except Exception as e:
        logger.error(f"Error checking if bucket is empty: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clear entire R2 bucket")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--dry-run", action="store_true", help="List objects without deleting them")
    group.add_argument("--force", action="store_true", help="Actually delete ALL objects")
    
    args = parser.parse_args()
    
    asyncio.run(clear_entire_bucket(dry_run=not args.force)) 