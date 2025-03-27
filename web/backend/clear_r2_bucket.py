#!/usr/bin/env python3
import asyncio
import os
import sys
import logging

# Add the parent directory to the path so we can import the app modules
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.storage import R2Storage

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("clear_r2_bucket")

async def clear_all_r2_storage(dry_run=True):
    """
    Clear all objects from the R2 bucket.
    
    Args:
        dry_run: If True, only list objects without deleting them
    """
    logger.info("Initializing R2 bucket clearing...")
    storage = R2Storage()
    
    # First list all objects to see what we have
    success, result = await storage.list_directory("")
    
    if not success:
        logger.error(f"Failed to list objects: {result}")
        return
    
    objects = result
    total_size = sum(obj.get("Size", 0) for obj in objects)
    
    logger.info(f"Found {len(objects)} objects in bucket, total size: {total_size/1024/1024:.2f} MB")
    
    # In dry run mode, just show what would be deleted
    if dry_run:
        logger.info("DRY RUN MODE: No files will be deleted")
        
        # Group objects by common prefixes to show the structure
        prefixes = {}
        for obj in objects:
            key = obj.get("Key", "")
            parts = key.split("/")
            
            # Use the first level directory as grouping
            prefix = parts[0] if parts else ""
            if prefix not in prefixes:
                prefixes[prefix] = {
                    "count": 0,
                    "size": 0
                }
            
            prefixes[prefix]["count"] += 1
            prefixes[prefix]["size"] += obj.get("Size", 0)
        
        # Show grouped stats
        logger.info("Current bucket structure:")
        for prefix, stats in prefixes.items():
            logger.info(f"  - {prefix or 'ROOT'}: {stats['count']} objects, {stats['size']/1024/1024:.2f} MB")
        
        # Show some example objects
        if objects:
            logger.info("Sample objects:")
            for obj in objects[:10]:  # Show first 10 objects
                logger.info(f"  - {obj.get('Key', 'unknown')}, {obj.get('Size', 0)/1024:.2f} KB")
            
            if len(objects) > 10:
                logger.info(f"  ... and {len(objects) - 10} more")
        
        logger.info("To actually delete these files, run again without --dry-run")
        return
    
    # Actually delete everything
    logger.info(f"Deleting all {len(objects)} objects from bucket...")
    success, result = await storage.delete_directory("")
    
    logger.info(f"Deletion results:")
    logger.info(f"  - Deleted: {result['deleted']} objects")
    logger.info(f"  - Failed: {result['failed']} objects")
    
    # Verify bucket is empty now
    success, remaining = await storage.list_directory("")
    if success:
        logger.info(f"Bucket now contains {len(remaining)} objects")
    else:
        logger.warning(f"Failed to verify bucket contents after deletion: {remaining}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Clear all objects from R2 bucket")
    parser.add_argument("--dry-run", action="store_true", help="List objects without deleting them")
    args = parser.parse_args()
    
    asyncio.run(clear_all_r2_storage(dry_run=args.dry_run))
    
    if args.dry_run:
        logger.info("DRY RUN complete. No files were deleted.")
    else:
        logger.info("R2 bucket clearing completed!") 