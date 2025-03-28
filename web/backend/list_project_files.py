import os
import asyncio
import logging
import sys
from typing import List, Optional

import boto3
import aioboto3
from dotenv import load_dotenv
from botocore.exceptions import ClientError

# Import config from app
try:
    sys.path.append('/app')
    from app.core.config import settings
    R2_ACCOUNT_ID = settings.R2_ACCOUNT_ID
    R2_ACCESS_KEY_ID = settings.R2_ACCESS_KEY_ID
    R2_SECRET_ACCESS_KEY = settings.R2_SECRET_ACCESS_KEY
    R2_BUCKET_NAME = settings.R2_BUCKET_NAME
    R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    print(f"Successfully loaded R2 config from app settings")
except ImportError:
    # Fallback to environment variables
    load_dotenv()
    R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
    R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
    R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "autoshorts-media")
    R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    print(f"Failed to load app settings, using environment variables")

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

async def list_project_files(project_id: str) -> List[dict]:
    """
    List all files in R2 storage with the given project ID in their path.
    
    Args:
        project_id: The project ID to search for
        
    Returns:
        List of file objects with their keys and sizes
    """
    session = aioboto3.Session(
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    )
    
    # Print connection details (without secrets)
    logger.info(f"Connecting to R2: endpoint={R2_ENDPOINT}, bucket={R2_BUCKET_NAME}")
    
    # Check credentials
    if not R2_ACCESS_KEY_ID or not R2_SECRET_ACCESS_KEY:
        logger.error("Missing R2 credentials")
        return []
    
    # Different prefixes to check
    prefixes_to_check = [
        f"users/default/projects/{project_id}/",  # New path structure
        f"{project_id}/",                         # Root level prefix
        f"projects/{project_id}/",                # Old path structure - projects folder
        f"media/{project_id}/",                   # Old path structure - media folder
        f"audio/{project_id}/",                   # Old path structure - audio folder
        f"video/{project_id}/",                   # Old path structure - video folder
        f"thumbnails/{project_id}/"               # Old path structure - thumbnails folder
    ]
    
    result_files = []
    
    try:
        async with session.client("s3", endpoint_url=R2_ENDPOINT) as s3:
            for prefix in prefixes_to_check:
                logger.info(f"Searching for objects with prefix: {prefix}")
                
                try:
                    # List objects with the current prefix
                    response = await s3.list_objects_v2(
                        Bucket=R2_BUCKET_NAME,
                        Prefix=prefix,
                        MaxKeys=1000
                    )
                    
                    # Extract files from response
                    if "Contents" in response:
                        files = response["Contents"]
                        for file in files:
                            result_files.append({
                                "key": file["Key"],
                                "size": file["Size"],
                                "last_modified": file["LastModified"]
                            })
                        
                        logger.info(f"Found {len(files)} objects with prefix '{prefix}'")
                    else:
                        logger.info(f"No objects found with prefix '{prefix}'")
                        
                except ClientError as e:
                    logger.error(f"Error listing objects with prefix '{prefix}': {str(e)}")
                
            # If no files found with any prefix, try listing by directory
            if not result_files:
                # Try to list common directories that might contain project files
                # This handles the case where files might be stored with only the project ID as folder
                logger.info("No files found with direct prefixes, checking directory structure...")
                
                # List all top-level "directories"
                response = await s3.list_objects_v2(
                    Bucket=R2_BUCKET_NAME,
                    Delimiter='/',
                    MaxKeys=1000
                )
                
                # Check for project ID in common prefixes
                if "CommonPrefixes" in response:
                    for prefix in response["CommonPrefixes"]:
                        prefix_key = prefix.get("Prefix", "")
                        if project_id in prefix_key:
                            logger.info(f"Found matching directory: {prefix_key}")
                            
                            # List contents of matching directory
                            dir_response = await s3.list_objects_v2(
                                Bucket=R2_BUCKET_NAME,
                                Prefix=prefix_key,
                                MaxKeys=1000
                            )
                            
                            if "Contents" in dir_response:
                                files = dir_response["Contents"]
                                for file in files:
                                    result_files.append({
                                        "key": file["Key"],
                                        "size": file["Size"],
                                        "last_modified": file["LastModified"]
                                    })
                                
                                logger.info(f"Found {len(files)} objects in directory '{prefix_key}'")
    
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        
    return result_files

async def main():
    if len(sys.argv) < 2:
        print("Usage: python list_project_files.py <project_id>")
        return
        
    project_id = sys.argv[1]
    print(f"Searching for files with project ID: {project_id}")
    
    files = await list_project_files(project_id)
    
    if files:
        total_size = sum(file["size"] for file in files)
        print(f"\nFound {len(files)} files for project {project_id}, total size: {total_size/1024/1024:.2f} MB")
        print("\nFiles:")
        for file in files:
            print(f"  - {file['key']} ({file['size']/1024:.2f} KB)")
    else:
        print(f"\nNo files found for project {project_id}")
        
if __name__ == "__main__":
    asyncio.run(main()) 