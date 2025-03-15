import boto3
import os
import sys
from botocore.exceptions import ClientError

def test_r2_connection():
    print("Testing R2 connection with new credentials...")
    
    # Get credentials from environment
    access_key = os.environ.get('CLOUDFLARE_R2_ACCESS_KEY_ID', '9d7c5d8729760b9b69d1b860bc3fc5f')
    secret_key = os.environ.get('CLOUDFLARE_R2_SECRET_ACCESS_KEY', '42b1518d0d4c649a0b52de2e56e62c26ae87ef0d0305f7d85e7a09887f20221')
    endpoint = os.environ.get('CLOUDFLARE_R2_ENDPOINT', 'https://68b1765fe971ce074e1a3bad853b4031.r2.cloudflarestorage.com')
    bucket_name = os.environ.get('R2_BUCKET_NAME', 'autoshorts-media')
    
    # Check credential length
    print(f"Access Key: {access_key[:5]}...{access_key[-4:]} (length: {len(access_key)})")
    if len(access_key) != 32:
        print(f"⚠️  WARNING: Access Key length is {len(access_key)}, should be 32 characters!")
        print("Let's verify the exact key copied from Cloudflare:")
        print("Key from Cloudflare: 9d7c5d8729760b9b69d1b860bc3fc5f")
        print(f"Key in use: {access_key}")
        
        # Fix the key if needed
        if len('9d7c5d8729760b9b69d1b860bc3fc5f') == 32 and len(access_key) != 32:
            print("⚠️ Using the hardcoded key instead")
            access_key = '9d7c5d8729760b9b69d1b860bc3fc5f'
            if len(access_key) != 32:
                print(f"❌ Still wrong length! Got {len(access_key)}, need 32 characters")
                return
    
    print(f"Endpoint: {endpoint}")
    print(f"Bucket: {bucket_name}")
    
    # Create S3 client
    s3 = boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        aws_session_token=None,
        region_name='auto',
    )
    
    # Test bucket access
    try:
        print("\nTesting head_bucket operation:")
        s3.head_bucket(Bucket=bucket_name)
        print("✅ Bucket exists and is accessible!")
    except ClientError as e:
        print(f"❌ Error accessing bucket: {e}")
    
    # Test listing objects
    try:
        print("\nTesting list_objects operation:")
        response = s3.list_objects_v2(Bucket=bucket_name, MaxKeys=5)
        if 'Contents' in response:
            print(f"✅ Successfully listed objects. Found {len(response['Contents'])} objects")
            for obj in response['Contents']:
                print(f"  - {obj['Key']} ({obj['Size']} bytes)")
        else:
            print("✅ Bucket is empty or you don't have list permissions")
    except ClientError as e:
        print(f"❌ Error listing objects: {e}")
        
    # CORS check
    try:
        print("\nChecking CORS configuration:")
        cors = s3.get_bucket_cors(Bucket=bucket_name)
        print("✅ CORS configuration exists:")
        print(cors)
    except ClientError as e:
        print(f"❌ Error checking CORS: {e}")
    
    # Test uploading a small file
    try:
        print("\nTesting file upload:")
        test_data = b"This is a test file to verify R2 bucket access."
        s3.put_object(
            Bucket=bucket_name,
            Key="test-file.txt",
            Body=test_data,
            ContentType="text/plain"
        )
        print("✅ File uploaded successfully!")
        
        # Verify we can get the file
        print("\nVerifying file access:")
        response = s3.get_object(Bucket=bucket_name, Key="test-file.txt")
        content = response['Body'].read()
        print(f"✅ File retrieved successfully: {content.decode('utf-8')}")
        
    except ClientError as e:
        print(f"❌ Error with file operations: {e}")

if __name__ == "__main__":
    test_r2_connection() 