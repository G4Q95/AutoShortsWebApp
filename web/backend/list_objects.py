#!/usr/bin/env python3
"""
List all objects in the R2 bucket.
"""
import os
import sys
import json
import logging
import asyncio
import datetime
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Add the parent directory to sys.path to access app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

# Import the storage module from the app
from app.services.storage import get_storage


# JSON encoder that handles datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.isoformat()
        return super().default(obj)


async def list_all_objects():
    """
    List all objects in the R2 bucket.
    """
    logger.info("Listing all objects in R2 bucket")
    
    try:
        # Get storage service
        storage = get_storage()
        
        # List all objects
        success, objects_or_error = await storage.list_directory("")
        
        if success and isinstance(objects_or_error, list):
            objects = objects_or_error
            
            logger.info(f"Found {len(objects)} objects in bucket")
            
            # Print the first 5 objects
            logger.info("First 5 objects:")
            for obj in objects[:5]:
                logger.info(json.dumps(obj, indent=2, cls=DateTimeEncoder))
            
            # Group by prefixes
            prefixes = {}
            for obj in objects:
                key = obj.get('Key', '')
                parts = key.split('/')
                
                if len(parts) > 0:
                    prefix = parts[0]
                    if prefix not in prefixes:
                        prefixes[prefix] = []
                    prefixes[prefix].append(key)
            
            # Print prefix counts
            logger.info("Object counts by prefix:")
            for prefix, keys in sorted(prefixes.items()):
                logger.info(f"  {prefix}: {len(keys)} objects")
            
            # Check for specific projects
            for target_prefix in ["proj_m8rwxxpx", "proj_m8rwmk9a"]:
                matching_keys = [k for k in objects if k.get('Key', '').startswith(target_prefix)]
                
                if matching_keys:
                    logger.info(f"Found {len(matching_keys)} objects with prefix {target_prefix}:")
                    for key in matching_keys:
                        logger.info(f"  - {key.get('Key')}")
                else:
                    logger.info(f"No objects found with prefix {target_prefix}")
            
            # Check if any directories exist without objects
            logger.info("\nChecking for empty directories...")
            try:
                response = storage.s3.list_objects_v2(
                    Bucket=storage.bucket_name,
                    Delimiter='/'
                )
                
                if 'CommonPrefixes' in response:
                    common_prefixes = response['CommonPrefixes']
                    logger.info(f"Found {len(common_prefixes)} common prefixes (directories):")
                    for prefix in common_prefixes:
                        prefix_path = prefix.get('Prefix', '')
                        logger.info(f"  - {prefix_path}")
                else:
                    logger.info("No common prefixes (directories) found")
            except Exception as e:
                logger.error(f"Error listing common prefixes: {e}")
            
        else:
            logger.error(f"Error listing objects: {objects_or_error}")
        
    except Exception as e:
        logger.error(f"Error listing objects: {e}")
        import traceback
        traceback.print_exc()


def main():
    # Load environment variables
    load_dotenv()
    
    # Run the async function
    asyncio.run(list_all_objects())


if __name__ == "__main__":
    main() 