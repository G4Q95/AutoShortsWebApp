#!/usr/bin/env python3
"""
List objects in R2 storage using the Wrangler-based approach.

Usage:
    python list_r2_objects.py [--prefix PREFIX] [--limit LIMIT]

Arguments:
    --prefix PREFIX   Only list objects with the specified prefix
    --limit LIMIT     Maximum number of objects to list (default: 100)

Examples:
    python list_r2_objects.py
    python list_r2_objects.py --prefix proj_abc123
    python list_r2_objects.py --limit 50
"""

import asyncio
import sys
import os
import argparse
import json
import logging
from pathlib import Path

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

# Import Wrangler client and settings
from app.services.wrangler_r2 import WranglerR2Client
from app.config import get_settings

async def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="List objects in R2 storage")
    parser.add_argument("--prefix", help="Only list objects with the specified prefix")
    parser.add_argument("--limit", type=int, default=100, help="Maximum number of objects to list (default: 100)")
    parser.add_argument("--search", help="Search for objects containing this string")
    parser.add_argument("--case-insensitive", action="store_true", help="Use case-insensitive search")
    args = parser.parse_args()
    
    # Get the R2 bucket name from settings
    settings = get_settings()
    bucket_name = settings.r2_bucket_name
    
    logger.info(f"Listing objects in bucket: {bucket_name}")
    logger.info(f"Prefix: {args.prefix or 'None'}")
    logger.info(f"Limit: {args.limit}")
    
    try:
        # Initialize the Wrangler client
        client = WranglerR2Client(bucket_name)
        
        # List objects
        if args.search:
            logger.info(f"Searching for objects containing: {args.search}")
            objects = client.find_objects_containing(
                args.search, 
                case_sensitive=not args.case_insensitive
            )
        else:
            objects = client.list_objects(prefix=args.prefix, limit=args.limit)
        
        # Display results
        logger.info(f"Found {len(objects)} objects")
        
        if objects:
            # Display detailed information for the first 20 objects
            logger.info("\nObject details (first 20):")
            for i, obj in enumerate(objects[:20]):
                key = obj.get("key", "")
                size = obj.get("size", 0)
                size_mb = round(size / (1024 * 1024), 2) if size > 0 else 0
                etag = obj.get("etag", "")
                uploaded = obj.get("uploaded", "")
                
                logger.info(f"  {i+1}. Key: {key}")
                logger.info(f"     Size: {size_mb} MB")
                logger.info(f"     ETag: {etag}")
                logger.info(f"     Uploaded: {uploaded}")
                logger.info("")
            
            if len(objects) > 20:
                logger.info(f"... and {len(objects) - 20} more objects")
            
            # Calculate total size
            total_size = sum(obj.get("size", 0) for obj in objects)
            total_size_mb = round(total_size / (1024 * 1024), 2)
            logger.info(f"\nTotal size: {total_size_mb} MB")
            
            # Group objects by common prefixes
            prefixes = {}
            for obj in objects:
                key = obj.get("key", "")
                parts = key.split("/")
                if len(parts) > 1:
                    prefix = parts[0]
                    if prefix not in prefixes:
                        prefixes[prefix] = {"count": 0, "size": 0}
                    prefixes[prefix]["count"] += 1
                    prefixes[prefix]["size"] += obj.get("size", 0)
            
            if prefixes:
                logger.info("\nObject groups by prefix:")
                for prefix, stats in sorted(prefixes.items(), key=lambda x: x[1]["count"], reverse=True):
                    count = stats["count"]
                    size = stats["size"]
                    size_mb = round(size / (1024 * 1024), 2)
                    logger.info(f"  {prefix}: {count} objects, {size_mb} MB")
        else:
            logger.info("No objects found")
    
    except Exception as e:
        logger.error(f"Error listing objects: {str(e)}")
        return 1
    
    return 0

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(result) 