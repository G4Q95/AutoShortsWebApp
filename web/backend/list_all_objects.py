import os
import asyncio
import logging
import sys
from typing import List, Dict, Any
import json
from datetime import datetime

import aioboto3
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
    print(f"Failed to load app settings, using environment variables")
    # Fallback to environment variables
    from dotenv import load_dotenv
    load_dotenv()
    R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
    R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
    R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "autoshorts-media")
    R2_ENDPOINT = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Set up logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Custom JSON encoder to handle datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(DateTimeEncoder, self).default(obj)

async def list_all_objects() -> Dict[str, Any]:
    """
    List all objects in the R2 bucket, organized by project ID.
    
    Returns:
        Dictionary mapping project IDs to lists of files
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
        return {}
    
    result = {
        "total_objects": 0,
        "total_size_bytes": 0,
        "top_level_prefixes": [],
        "projects": {},
        "other_files": []
    }
    
    try:
        async with session.client("s3", endpoint_url=R2_ENDPOINT) as s3:
            # First, list top-level "directories"
            logger.info("Listing top-level prefixes...")
            response = await s3.list_objects_v2(
                Bucket=R2_BUCKET_NAME,
                Delimiter='/',
                MaxKeys=1000
            )
            
            # Extract top-level prefixes
            if "CommonPrefixes" in response:
                for prefix in response["CommonPrefixes"]:
                    prefix_key = prefix.get("Prefix", "")
                    result["top_level_prefixes"].append(prefix_key)
                    logger.info(f"Found top-level prefix: {prefix_key}")
            
            # Now list all objects in the bucket
            logger.info("Listing all objects in bucket...")
            paginator = s3.get_paginator('list_objects_v2')
            
            async for page in paginator.paginate(Bucket=R2_BUCKET_NAME):
                if "Contents" in page:
                    for obj in page["Contents"]:
                        key = obj["Key"]
                        size = obj["Size"]
                        
                        # Count total objects and size
                        result["total_objects"] += 1
                        result["total_size_bytes"] += size
                        
                        # Parse key to extract project ID
                        project_id = None
                        
                        # Try different path patterns to extract project ID
                        if key.startswith("projects/proj_"):
                            # Format: projects/proj_XXXXXX/...
                            parts = key.split("/")
                            if len(parts) > 1:
                                project_id = parts[1]
                        elif key.startswith("users/default/projects/proj_"):
                            # Format: users/default/projects/proj_XXXXXX/...
                            parts = key.split("/")
                            if len(parts) > 3:
                                project_id = parts[3]
                        elif key.startswith("audio/proj_") or key.startswith("media/proj_") or key.startswith("video/proj_"):
                            # Format: audio/proj_XXXXX/... or media/proj_XXXXX/...
                            parts = key.split("/")
                            if len(parts) > 1:
                                project_id = parts[1]
                        elif key.startswith("proj_"):
                            # Format: proj_XXXXX/...
                            parts = key.split("/")
                            if len(parts) > 0:
                                project_id = parts[0]
                        
                        # Add to project dict or other_files list
                        if project_id:
                            if project_id not in result["projects"]:
                                result["projects"][project_id] = {
                                    "file_count": 0,
                                    "total_size_bytes": 0,
                                    "files": []
                                }
                            
                            result["projects"][project_id]["file_count"] += 1
                            result["projects"][project_id]["total_size_bytes"] += size
                            result["projects"][project_id]["files"].append({
                                "key": key,
                                "size": size,
                                "last_modified": obj["LastModified"]
                            })
                        else:
                            result["other_files"].append({
                                "key": key,
                                "size": size,
                                "last_modified": obj["LastModified"]
                            })
    
    except Exception as e:
        logger.error(f"Error listing objects: {str(e)}")
        
    return result

async def main():
    print(f"Listing all objects in R2 bucket {R2_BUCKET_NAME}...")
    
    result = await list_all_objects()
    
    print(f"\nSummary:")
    print(f"- Total objects: {result['total_objects']}")
    print(f"- Total size: {result['total_size_bytes']/1024/1024:.2f} MB")
    print(f"- Top-level prefixes: {', '.join(result['top_level_prefixes'])}")
    print(f"- Projects found: {len(result['projects'])}")
    print(f"- Other files: {len(result['other_files'])}")
    
    print("\nProjects:")
    for project_id, project_data in result["projects"].items():
        print(f"  - {project_id}: {project_data['file_count']} files, {project_data['total_size_bytes']/1024/1024:.2f} MB")
    
    # Check if output file was specified
    if len(sys.argv) > 1:
        output_file = sys.argv[1]
        print(f"\nWriting detailed results to {output_file}...")
        with open(output_file, 'w') as f:
            json.dump(result, f, indent=2, cls=DateTimeEncoder)
        print(f"Results written to {output_file}")
        
if __name__ == "__main__":
    asyncio.run(main()) 