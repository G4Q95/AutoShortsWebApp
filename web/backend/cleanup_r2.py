import asyncio
import sys
import logging

try:
    sys.path.append('/app')
    from app.core.config import settings
    import aioboto3
except ImportError:
    print("Failed to import app settings. Make sure you're running this in the correct environment.")
    sys.exit(1)

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# R2 configuration from settings
R2_ACCOUNT_ID = settings.R2_ACCOUNT_ID
R2_ACCESS_KEY_ID = settings.R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY = settings.R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME = settings.R2_BUCKET_NAME
R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

async def delete_all_objects():
    """Delete all objects from the R2 bucket."""
    
    logger.info(f"Starting to delete all objects from bucket: {R2_BUCKET_NAME}")
    
    session = aioboto3.Session(
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    )
    
    try:
        async with session.client("s3", endpoint_url=R2_ENDPOINT) as s3:
            # Get all objects in the bucket
            paginator = s3.get_paginator('list_objects_v2')
            
            total_objects = 0
            total_deleted = 0
            
            # Process each page of objects
            async for page in paginator.paginate(Bucket=R2_BUCKET_NAME):
                if "Contents" not in page:
                    logger.info("No objects found in bucket")
                    return
                
                # Collect keys to delete in batches (S3 delete_objects can take up to 1000 at a time)
                keys_to_delete = []
                for obj in page["Contents"]:
                    key = obj["Key"]
                    size = obj["Size"]
                    total_objects += 1
                    keys_to_delete.append({"Key": key})
                    logger.info(f"Queuing for deletion: {key} ({size/1024:.2f} KB)")
                    
                    # Delete in batches of 1000
                    if len(keys_to_delete) >= 1000:
                        response = await s3.delete_objects(
                            Bucket=R2_BUCKET_NAME,
                            Delete={"Objects": keys_to_delete}
                        )
                        total_deleted += len(keys_to_delete)
                        logger.info(f"Deleted batch of {len(keys_to_delete)} objects")
                        keys_to_delete = []
                
                # Delete any remaining objects
                if keys_to_delete:
                    response = await s3.delete_objects(
                        Bucket=R2_BUCKET_NAME,
                        Delete={"Objects": keys_to_delete}
                    )
                    total_deleted += len(keys_to_delete)
                    logger.info(f"Deleted batch of {len(keys_to_delete)} objects")
            
            logger.info(f"Completed deletion. Found {total_objects} objects, deleted {total_deleted} objects")
            return total_deleted
                
    except Exception as e:
        logger.error(f"Error deleting objects: {e}")
        return 0

async def confirm_and_delete():
    """Confirm with the user before deleting all objects."""
    
    print("\n" + "="*80)
    print(f"WARNING: This will DELETE ALL FILES from the bucket: {R2_BUCKET_NAME}")
    print("="*80)
    print("\nThis action CANNOT be undone! All files will be permanently deleted.")
    
    response = input("\nAre you sure you want to proceed? Type 'DELETE ALL' to confirm: ")
    
    if response.strip() == "DELETE ALL":
        print("\nDeleting all objects. This may take a while...")
        deleted_count = await delete_all_objects()
        print(f"\nSuccess! Deleted {deleted_count} objects from the R2 bucket.")
    else:
        print("\nDeletion cancelled. No files were deleted.")

if __name__ == "__main__":
    asyncio.run(confirm_and_delete()) 