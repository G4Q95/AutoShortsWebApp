import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError

# Configuration from environment variables
endpoint_url = os.getenv('R2_ENDPOINT_URL')
access_key_id = os.getenv('R2_ACCESS_KEY_ID')
secret_access_key = os.getenv('R2_SECRET_ACCESS_KEY')
bucket_name = os.getenv('R2_BUCKET_NAME')
region_name = 'auto' # R2 specific

print("--- R2 Bucket Purge Script ---")

# Validate configuration
if not all([endpoint_url, access_key_id, secret_access_key, bucket_name]):
    print("Error: Missing one or more R2 environment variables:")
    print(f"  R2_ENDPOINT_URL: {'Set' if endpoint_url else 'Missing'}")
    print(f"  R2_ACCESS_KEY_ID: {'Set' if access_key_id else 'Missing'}")
    print(f"  R2_SECRET_ACCESS_KEY: {'Set' if secret_access_key else 'Missing'}")
    print(f"  R2_BUCKET_NAME: {'Set' if bucket_name else 'Missing'}")
    exit(1)

print(f"Target Bucket: {bucket_name}")
print(f"Endpoint URL: {endpoint_url}")

# Initialize S3 client for R2
try:
    s3 = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name=region_name
    )
    # Test connection by listing buckets (optional, good check)
    # s3.list_buckets() 
    print("Successfully connected to R2.")
except NoCredentialsError:
    print("Error: Credentials not found.")
    exit(1)
except ClientError as e:
    print(f"Error connecting to R2: {e}")
    exit(1)
except Exception as e:
    print(f"An unexpected error occurred during connection: {e}")
    exit(1)
    
# --- Object Listing and Deletion ---
objects_to_delete = []
total_deleted = 0
try:
    print("Listing objects in the bucket...")
    paginator = s3.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket=bucket_name)

    object_count = 0
    for page in pages:
        if 'Contents' in page:
            page_objects = [{'Key': obj['Key']} for obj in page['Contents']]
            objects_to_delete.extend(page_objects)
            object_count += len(page_objects)
            print(f"Found {len(page_objects)} objects in this page. Total found so far: {object_count}")
        else:
            print("No objects found in this page.")

    if not objects_to_delete:
        print("Bucket is already empty. No objects to delete.")
        exit(0)

    print(f"\nPreparing to delete {len(objects_to_delete)} objects...")

    # Delete objects in batches of 1000 (S3 limit)
    batch_size = 1000
    for i in range(0, len(objects_to_delete), batch_size):
        batch = objects_to_delete[i:i + batch_size]
        print(f"Deleting batch {i // batch_size + 1} ({len(batch)} objects)...")
        try:
            response = s3.delete_objects(
                Bucket=bucket_name,
                Delete={'Objects': batch, 'Quiet': False} # Set Quiet=False to get detailed results
            )
            
            deleted_count_batch = 0
            if 'Deleted' in response:
                deleted_count_batch = len(response['Deleted'])
                total_deleted += deleted_count_batch
                print(f"Successfully deleted {deleted_count_batch} objects in this batch.")
                # Optional: print deleted keys
                # for deleted_obj in response['Deleted']:
                #    print(f"  - Deleted: {deleted_obj['Key']}")

            if 'Errors' in response and response['Errors']:
                print("Errors occurred during deletion in this batch:")
                for error in response['Errors']:
                    print(f"  - Error deleting {error['Key']}: {error['Code']} - {error['Message']}")
            
        except ClientError as e:
            print(f"Error during batch deletion: {e}")
            # Decide if you want to stop or continue with other batches
            # For a purge script, we might want to continue if possible
            print("Attempting to continue with next batch...")
        except Exception as e:
            print(f"An unexpected error occurred during batch deletion: {e}")
            print("Attempting to continue with next batch...")

    print(f"\n--- Purge Complete ---")
    print(f"Total objects targeted for deletion: {len(objects_to_delete)}")
    print(f"Total objects successfully deleted: {total_deleted}")
    errors_occurred = len(objects_to_delete) - total_deleted
    if errors_occurred > 0:
         print(f"Errors occurred for {errors_occurred} objects. Please review the logs above.")

except ClientError as e:
    error_code = e.response.get('Error', {}).get('Code')
    if error_code == 'NoSuchBucket':
        print(f"Error: The bucket '{bucket_name}' does not exist.")
    elif error_code == 'AccessDenied':
         print(f"Error: Access Denied. Check credentials and bucket permissions for listing/deleting objects.")
    else:
        print(f"An error occurred while listing or preparing deletion: {e}")
    exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    exit(1) 