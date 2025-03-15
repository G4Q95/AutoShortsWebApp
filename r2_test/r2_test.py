import os
import boto3
import uuid
from botocore.exceptions import ClientError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger()

# R2 Configuration - Corrected values from Cloudflare dashboard
r2_account_id = "68b1765fe971ce074e1a3bad853b4031"
access_key_id = "ad3517467c634ecf33f723cd19b25d01"  # Corrected from screenshot
secret_access_key = "179247cd0a61bed35d62efeb4d729ae5be3b281b18f8cb33ebcf804c0c61771a"  # Corrected from screenshot
bucket_name = "autoshorts-media"

# Test with different configurations
configurations = [
    {"region": "weur", "endpoint": f"https://{r2_account_id}.r2.cloudflarestorage.com"},
    {"region": "auto", "endpoint": f"https://{r2_account_id}.r2.cloudflarestorage.com"},
    {"region": "us-east-1", "endpoint": f"https://{r2_account_id}.r2.cloudflarestorage.com"},
    {"region": "", "endpoint": f"https://{r2_account_id}.r2.cloudflarestorage.com"}
]

def test_r2_connection():
    """Test basic operations with R2 using different configurations"""
    logger.info("Starting R2 connection tests with multiple configurations...")
    
    for i, config in enumerate(configurations):
        region = config["region"]
        endpoint_url = config["endpoint"]
        
        logger.info(f"\n\n=== Test Configuration #{i+1} ===")
        logger.info(f"Region: {region}")
        logger.info(f"Endpoint: {endpoint_url}")
        logger.info(f"Access Key ID: {access_key_id[:4]}...{access_key_id[-4:]}")
        logger.info(f"Using bucket: {bucket_name}")
        
        try:
            # Create S3 client
            logger.info("Creating S3 client...")
            s3 = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=access_key_id,
                aws_secret_access_key=secret_access_key,
                region_name=region
            )
            
            # Test 1: Check bucket existence
            try:
                logger.info(f"Test 1: Checking if bucket {bucket_name} exists...")
                response = s3.head_bucket(Bucket=bucket_name)
                logger.info(f"✅ Bucket exists. Response: {response}")
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code')
                logger.error(f"❌ Bucket check failed. Error code: {error_code}")
                logger.error(f"Error message: {str(e)}")
                continue  # Skip to next configuration if bucket check fails
            
            # Test 2: List all buckets
            try:
                logger.info("Test 2: Listing all buckets...")
                response = s3.list_buckets()
                buckets = [bucket['Name'] for bucket in response.get('Buckets', [])]
                logger.info(f"✅ Found buckets: {buckets}")
            except Exception as e:
                logger.error(f"❌ Failed to list buckets: {str(e)}")
            
            # Test 3: Create and upload test file
            try:
                logger.info("Test 3: Creating and uploading test file...")
                test_file_path = f"r2_test_{uuid.uuid4().hex[:8]}.txt"
                
                # Create a test file
                with open(test_file_path, 'w') as f:
                    f.write(f"R2 connection test file - {uuid.uuid4()}")
                
                logger.info(f"Created test file: {test_file_path}")
                
                # Upload the file
                object_key = f"test/{os.path.basename(test_file_path)}"
                logger.info(f"Uploading to {bucket_name}/{object_key}...")
                
                s3.upload_file(test_file_path, bucket_name, object_key)
                logger.info("✅ File uploaded successfully")
                
                # Generate a presigned URL for the uploaded file
                url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': object_key},
                    ExpiresIn=3600
                )
                logger.info(f"✅ Presigned URL: {url}")
                
                # Clean up
                os.remove(test_file_path)
                logger.info(f"Removed local test file: {test_file_path}")
                
            except Exception as e:
                logger.error(f"❌ File upload test failed: {str(e)}")
            
            # Test 4: List objects in bucket
            try:
                logger.info(f"Test 4: Listing objects in bucket {bucket_name}...")
                response = s3.list_objects_v2(Bucket=bucket_name)
                object_count = response.get('KeyCount', 0)
                objects = [item.get('Key') for item in response.get('Contents', [])]
                
                logger.info(f"✅ Found {object_count} objects")
                if objects:
                    logger.info(f"Objects: {objects[:10]}")
                    if len(objects) > 10:
                        logger.info(f"... and {len(objects) - 10} more")
            except Exception as e:
                logger.error(f"❌ Failed to list objects: {str(e)}")
                
        except Exception as e:
            logger.error(f"❌ General error: {str(e)}")
    
    logger.info("R2 connection test complete")

if __name__ == "__main__":
    test_r2_connection()
