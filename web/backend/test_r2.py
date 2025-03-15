import boto3
import os
import sys

def test_r2_connection():
    """Test connection to R2 storage directly."""
    print("Testing R2 connection...")
    
    # Get environment variables
    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("AWS_ACCESS_KEY_ID") or os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("AWS_SECRET_ACCESS_KEY") or os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    bucket_name = os.environ.get("R2_BUCKET_NAME")
    endpoint_url = os.environ.get("CLOUDFLARE_R2_ENDPOINT")
    region = os.environ.get("AWS_DEFAULT_REGION") or "auto"
    
    # Print environment variables (masking sensitive info)
    print(f"R2_ACCOUNT_ID: {account_id}")
    print(f"ACCESS_KEY_ID: {access_key[:4]}...{access_key[-4:] if access_key else ''}")
    print(f"SECRET_ACCESS_KEY: {'[SET]' if secret_key else '[NOT SET]'}")
    print(f"R2_BUCKET_NAME: {bucket_name}")
    print(f"ENDPOINT_URL: {endpoint_url}")
    print(f"REGION: {region}")
    
    # Construct endpoint URL if not provided
    if not endpoint_url:
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        print(f"Constructed endpoint URL: {endpoint_url}")
    
    try:
        # Create S3 client with the correct region setting
        print(f"Creating S3 client with endpoint: {endpoint_url}")
        
        # Try using boto3 resource first
        print("Trying boto3 resource...")
        s3_resource = boto3.resource(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        
        # Try to list buckets using resource
        try:
            print("Listing all buckets using resource...")
            bucket_names = [bucket.name for bucket in s3_resource.buckets.all()]
            print(f"Available buckets: {bucket_names}")
        except Exception as list_error:
            print(f"Error listing buckets with resource: {str(list_error)}")
        
        # Now try using boto3 client
        print("Trying boto3 client...")
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name=region,
        )
        
        # Check if bucket exists
        try:
            print(f"Checking if bucket {bucket_name} exists...")
            s3.head_bucket(Bucket=bucket_name)
            print(f"Bucket {bucket_name} exists!")
        except Exception as e:
            print(f"Error checking bucket: {str(e)}")
            
            # Try to create the bucket
            try:
                print(f"Attempting to create bucket {bucket_name}...")
                s3.create_bucket(Bucket=bucket_name)
                print(f"Successfully created bucket {bucket_name}!")
            except Exception as create_error:
                print(f"Error creating bucket: {str(create_error)}")
        
        # Try to list buckets
        try:
            print("Listing all buckets...")
            buckets = s3.list_buckets()
            bucket_names = [bucket['Name'] for bucket in buckets.get('Buckets', [])]
            print(f"Available buckets: {bucket_names}")
        except Exception as list_error:
            print(f"Error listing buckets: {str(list_error)}")
        
        # Try to upload a test file
        try:
            print("Creating test file...")
            test_file_path = "/tmp/r2_test_file.txt"
            with open(test_file_path, "w") as f:
                f.write("This is a test file for R2 connection.")
            
            print(f"Uploading test file to {bucket_name}/test/r2_connection_test.txt...")
            test_object_name = "test/r2_connection_test.txt"
            s3.upload_file(test_file_path, bucket_name, test_object_name)
            
            print("Generating presigned URL...")
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': test_object_name},
                ExpiresIn=3600
            )
            
            print(f"Test file uploaded successfully! URL: {url}")
            
            # Clean up
            os.remove(test_file_path)
            print("Test file removed from local storage.")
        except Exception as upload_error:
            print(f"Error uploading test file: {str(upload_error)}")
    
    except Exception as e:
        print(f"Error creating S3 client: {str(e)}")
    
    print("R2 connection test complete.")

if __name__ == "__main__":
    test_r2_connection() 