import boto3
import os
import sys
from botocore.exceptions import ClientError, NoCredentialsError

# INSTRUCTIONS:
# 1. Replace these values with your actual R2 credentials from the Cloudflare dashboard
# 2. Run this script with: python r2_purger.py
# 3. Follow the prompts - you'll need to confirm before deletion happens

# ======= CREDENTIALS FROM YOUR PERMANENT TOKEN =======
ACCOUNT_ID = "68b1765fe971ce074e1a3bad853b4031"  # From your Cloudflare URL
BUCKET_NAME = "autoshorts-media"  # From your screenshot

# These credentials are from the PermanentR2fulldelete token
ACCESS_KEY_ID = "019d1c930b850ca247fae1fd2d603ff1"
SECRET_ACCESS_KEY = "518c57527d4c9f76d64a6da6eef75745174332740ece3d1d9b2c4a106de32dbd"

# Using the exact endpoint from your token information
ENDPOINT_URL = "https://68b1765fe971ce074e1a3bad853b4031.r2.cloudflarestorage.com"
# ===================================

# Before proceeding, let's verify credentials are set
if ACCESS_KEY_ID in ["your-access-key-id", ""]:
    print("ERROR: You need to set a valid ACCESS_KEY_ID.")
    print("Please edit this script following the instructions at the top.")
    sys.exit(1)

print("=== R2 Bucket Purge Script ===")
print(f"Target Bucket: {BUCKET_NAME}")
print(f"Endpoint URL: {ENDPOINT_URL}")

# Confirm before proceeding
confirm = input("\nWARNING: This will DELETE ALL OBJECTS in the bucket.\nType 'yes' to confirm: ")
if confirm.lower() != "yes":
    print("Operation cancelled.")
    sys.exit(0)

try:
    # Initialize S3 client for R2
    s3 = boto3.client(
        "s3",
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        region_name="auto",  # R2 specific
    )
    
    # Test connection
    print("Testing connection to R2...")
    try:
        s3.head_bucket(Bucket=BUCKET_NAME)
        print("Successfully connected to R2 bucket.")
    except ClientError as e:
        error = e.response.get("Error", {})
        error_code = error.get("Code", "Unknown")
        error_message = error.get("Message", "No additional information")
        print(f"Error accessing bucket: {error_code} - {error_message}")
        sys.exit(1)
    
    # List and count objects
    print("\nListing objects in the bucket...")
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=BUCKET_NAME)
    
    objects_to_delete = []
    object_count = 0
    
    for page in pages:
        if 'Contents' in page:
            page_objects = [{'Key': obj['Key']} for obj in page['Contents']]
            objects_to_delete.extend(page_objects)
            object_count += len(page_objects)
            print(f"Found {len(page_objects)} objects in this page. Total found so far: {object_count}")
    
    if not objects_to_delete:
        print("Bucket is already empty. No objects to delete.")
        sys.exit(0)
    
    # Final confirmation with count
    confirm = input(f"\nFound {object_count} objects. Proceed with deletion? Type 'yes' to confirm: ")
    if confirm.lower() != "yes":
        print("Operation cancelled.")
        sys.exit(0)
    
    # Delete objects in batches
    print(f"\nDeleting {object_count} objects...")
    batch_size = 1000  # S3 limit
    total_deleted = 0
    errors = []
    
    for i in range(0, len(objects_to_delete), batch_size):
        batch = objects_to_delete[i:i + batch_size]
        batch_num = i // batch_size + 1
        total_batches = (len(objects_to_delete) + batch_size - 1) // batch_size
        print(f"Deleting batch {batch_num}/{total_batches} ({len(batch)} objects)...")
        
        try:
            response = s3.delete_objects(
                Bucket=BUCKET_NAME,
                Delete={'Objects': batch, 'Quiet': False}  # Set Quiet=False to get results
            )
            
            # Process results
            if 'Deleted' in response:
                deleted_count = len(response['Deleted'])
                total_deleted += deleted_count
                print(f"Successfully deleted {deleted_count} objects in this batch.")
            
            if 'Errors' in response and response['Errors']:
                print("Errors in this batch:")
                for error in response['Errors']:
                    error_msg = f"Error deleting {error['Key']}: {error.get('Code', 'Unknown')} - {error.get('Message', 'No message')}"
                    print(f"  - {error_msg}")
                    errors.append(error_msg)
        
        except Exception as e:
            print(f"Error processing batch {batch_num}: {str(e)}")
            errors.append(f"Batch {batch_num}: {str(e)}")
    
    # Print summary
    print("\n=== Purge Operation Complete ===")
    print(f"Total objects targeted: {object_count}")
    print(f"Total objects successfully deleted: {total_deleted}")
    
    if errors:
        print(f"Errors encountered: {len(errors)}")
        print("First few errors:")
        for i, error in enumerate(errors[:5]):
            print(f"  {i+1}. {error}")
        if len(errors) > 5:
            print(f"  ... and {len(errors) - 5} more errors.")
    else:
        print("No errors encountered. Bucket should be empty!")

except NoCredentialsError:
    print("Error: Invalid credentials.")
except ClientError as e:
    print(f"Boto3 client error: {str(e)}")
except Exception as e:
    print(f"Unexpected error: {str(e)}")
    import traceback
    traceback.print_exc() 