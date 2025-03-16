import boto3
import os
from botocore.exceptions import ClientError

def test_r2_connection():
    print("Testing R2 connection with new credentials...")
    
    # Get credentials from environment (hardcoded for testing)
    access_key = "9d7d5a07297042b9b69d1b8680c3fa5f"
    secret_key = "42b1510d0a04c649a0d52de2e56e62c26a087efb90305f7d85e7a0887f20221"
    endpoint = "https://68b1765fe971ce074e1a3bad853b4031.r2.cloudflarestorage.com"
    bucket_name = "autoshorts-media"
    
    print(f"Access Key: {access_key[:5]}...{access_key[-4:]} (length: {len(access_key)})")
    print(f"Secret Key: {secret_key[:5]}...{secret_key[-4:]} (length: {len(secret_key)})")
    print(f"Endpoint: {endpoint}")
    print(f"Bucket: {bucket_name}")
    
    # Create S3 client
    print("\nCreating S3 client...")
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
        print(f"Error code: {e.response.get('Error', {}).get('Code', 'Unknown')}")
        print(f"Error message: {e.response.get('Error', {}).get('Message', 'Unknown')}")
    
    # Try listing buckets without specifying a bucket name
    try:
        print("\nTesting list_buckets operation:")
        response = s3.list_buckets()
        print(f"✅ Successfully listed buckets. Found {len(response.get('Buckets', []))} buckets")
        for bucket in response.get('Buckets', []):
            print(f"  - {bucket.get('Name')}")
    except ClientError as e:
        print(f"❌ Error listing buckets: {e}")
        print(f"Error code: {e.response.get('Error', {}).get('Code', 'Unknown')}")
        print(f"Error message: {e.response.get('Error', {}).get('Message', 'Unknown')}")
    
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
        print(f"Error code: {e.response.get('Error', {}).get('Code', 'Unknown')}")
        print(f"Error message: {e.response.get('Error', {}).get('Message', 'Unknown')}")
    
if __name__ == "__main__":
    test_r2_connection() 