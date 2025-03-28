#!/usr/bin/env python3
"""
Clear All Cloudflare R2 Files

This script deletes all files from the Cloudflare R2 bucket using direct boto3 S3 API calls.
It's designed to be more reliable than wrangler CLI when dealing with large numbers of files.

Usage:
    python clear_all_r2_files.py [--dry-run] [--confirm]

Options:
    --dry-run     Only list files that would be deleted, without actually deleting
    --confirm     Skip the confirmation prompt (use with caution!)
    
Example:
    python clear_all_r2_files.py --dry-run  # List files without deleting
    python clear_all_r2_files.py            # List files and prompt for confirmation
    python clear_all_r2_files.py --confirm  # Delete all files without prompting (CAUTION!)
"""

import os
import sys
import argparse
import logging
import boto3
import time
from typing import List, Dict, Any, Tuple
from botocore.exceptions import ClientError
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger('r2-cleaner')

def get_s3_client():
    """
    Create and return an S3 client configured for Cloudflare R2.
    
    Returns:
        boto3.client: Configured S3 client for R2 access
    """
    try:
        # Get required environment variables directly
        r2_account_id = "68b1765fe971ce074e1a3bad853b4031"  # Hardcoded from previous logs
        r2_access_key_id = os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
        r2_secret_access_key = os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
        bucket_name = "autoshorts-media"  # Hardcoded from previous logs
        
        # Check for required environment variables
        missing_vars = []
        if not r2_access_key_id:
            missing_vars.append("CLOUDFLARE_R2_ACCESS_KEY_ID")
        if not r2_secret_access_key:
            missing_vars.append("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
        
        if missing_vars:
            logger.error(f"Missing required environment variables: {', '.join(missing_vars)}")
            logger.error("Make sure these are set in your .env file or environment.")
            sys.exit(1)
            
        # Create S3 client for Cloudflare R2
        s3_client = boto3.client(
            service_name='s3',
            endpoint_url=f'https://{r2_account_id}.r2.cloudflarestorage.com',
            aws_access_key_id=r2_access_key_id,
            aws_secret_access_key=r2_secret_access_key
        )
        
        logger.info(f"Successfully connected to R2 bucket: {bucket_name}")
        return s3_client, bucket_name
        
    except Exception as e:
        logger.error(f"Failed to create S3 client: {str(e)}")
        sys.exit(1)

def list_all_objects(s3_client, bucket_name: str) -> List[Dict[str, Any]]:
    """
    List all objects in the specified bucket.
    
    Args:
        s3_client: Configured S3 client
        bucket_name: Name of the bucket to list objects from
        
    Returns:
        List of object dictionaries with 'Key' and 'Size' properties
    """
    try:
        logger.info(f"Listing all objects in bucket: {bucket_name}")
        
        all_objects = []
        total_size = 0
        
        # Use paginator to handle buckets with more than 1000 objects
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(Bucket=bucket_name)
        
        for page in page_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    all_objects.append({
                        'Key': obj['Key'],
                        'Size': obj['Size'],
                        'LastModified': obj['LastModified']
                    })
                    total_size += obj['Size']
        
        # Log summary
        total_size_mb = total_size / (1024 * 1024)
        logger.info(f"Found {len(all_objects)} objects (Total: {total_size_mb:.2f} MB)")
        
        # Show a sample of objects for verification
        if all_objects:
            logger.info("Sample of objects (first 5):")
            for obj in all_objects[:5]:
                logger.info(f"  - {obj['Key']} ({obj['Size'] / 1024:.2f} KB)")
        
        return all_objects
        
    except ClientError as e:
        logger.error(f"Error listing objects: {str(e)}")
        return []

def delete_objects(s3_client, bucket_name: str, objects: List[Dict[str, Any]], dry_run: bool = True) -> Tuple[int, int]:
    """
    Delete objects from the bucket in batches.
    
    Args:
        s3_client: Configured S3 client
        bucket_name: Name of the bucket
        objects: List of objects with 'Key' property
        dry_run: If True, only simulate deletion
        
    Returns:
        Tuple of (deleted_count, failed_count)
    """
    if not objects:
        logger.info("No objects to delete.")
        return 0, 0
        
    if dry_run:
        logger.info(f"DRY RUN: Would delete {len(objects)} objects.")
        return len(objects), 0
    
    # S3 API allows deleting up to 1000 objects in a single call
    batch_size = 1000
    deleted_count = 0
    failed_count = 0
    
    # Process objects in batches
    for i in range(0, len(objects), batch_size):
        batch = objects[i:i+batch_size]
        logger.info(f"Processing batch {i//batch_size + 1}/{(len(objects) + batch_size - 1)//batch_size} ({len(batch)} objects)")
        
        try:
            # Create delete request
            delete_dict = {
                'Objects': [{'Key': obj['Key']} for obj in batch],
                'Quiet': True
            }
            
            # Execute batch delete
            response = s3_client.delete_objects(
                Bucket=bucket_name,
                Delete=delete_dict
            )
            
            # Count successful deletions and errors
            batch_deleted = len(batch) - len(response.get('Errors', []))
            batch_failed = len(response.get('Errors', []))
            
            deleted_count += batch_deleted
            failed_count += batch_failed
            
            # Log errors if any
            if 'Errors' in response and response['Errors']:
                logger.warning(f"Failed to delete {len(response['Errors'])} objects in this batch.")
                for error in response['Errors'][:5]:  # Log only first 5 errors
                    logger.warning(f"  - {error.get('Key')}: {error.get('Message')}")
                if len(response['Errors']) > 5:
                    logger.warning(f"  ... and {len(response['Errors']) - 5} more errors.")
            
            logger.info(f"Batch completed. Deleted: {batch_deleted}, Failed: {batch_failed}")
            
            # Brief pause to avoid rate limiting
            time.sleep(0.5)
            
        except ClientError as e:
            logger.error(f"Error in batch delete: {str(e)}")
            failed_count += len(batch)
    
    # Log overall results
    logger.info(f"Deletion complete. Successfully deleted {deleted_count} objects, failed to delete {failed_count} objects.")
    return deleted_count, failed_count

def main():
    """Main execution function."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Clear all files from Cloudflare R2 bucket")
    parser.add_argument("--dry-run", action="store_true", help="Only simulate deletion without actually deleting")
    parser.add_argument("--confirm", action="store_true", help="Skip confirmation prompt (CAUTION)")
    args = parser.parse_args()
    
    # Initialize S3 client
    s3_client, bucket_name = get_s3_client()
    
    # List all objects
    objects = list_all_objects(s3_client, bucket_name)
    
    if not objects:
        logger.info("No objects found in bucket. Nothing to delete.")
        return 0
        
    # Ask for confirmation unless --confirm flag is set
    if not args.dry_run and not args.confirm:
        logger.info(f"You are about to DELETE ALL {len(objects)} OBJECTS from bucket '{bucket_name}'.")
        logger.info("THIS ACTION CANNOT BE UNDONE.")
        
        try:
            confirmation = input("\nType 'DELETE ALL' to confirm: ")
            if confirmation != "DELETE ALL":
                logger.info("Deletion cancelled.")
                return 1
        except KeyboardInterrupt:
            logger.info("\nOperation cancelled by user.")
            return 1
            
        logger.info("Proceeding with deletion...")
    
    # Delete objects
    deleted, failed = delete_objects(s3_client, bucket_name, objects, args.dry_run)
    
    if args.dry_run:
        logger.info(f"DRY RUN complete. Would delete {deleted} objects.")
    else:
        if failed == 0:
            logger.info(f"Successfully deleted all {deleted} objects from bucket '{bucket_name}'.")
        else:
            logger.warning(f"Deleted {deleted}/{len(objects)} objects. Failed to delete {failed} objects.")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 