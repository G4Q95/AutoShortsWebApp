import boto3
import os
import tempfile
from botocore.exceptions import ClientError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_r2_connection():
    """Test if the R2 connection is working with the new credentials."""
    
    # Get R2 credentials from environment or prompt the user
    account_id = input("Enter your R2 Account ID: ") or "68b1765fe971ce074e1a3bad853b4031"
    access_key = input("Enter your NEW Access Key ID: ")
    secret_key = input("Enter your NEW Secret Access Key: ")
    bucket_name = input("Enter your bucket name (default: autoshorts-media): ") or "autoshorts-media"
    
    if not access_key or not secret_key:
        logger.error("Access Key ID and Secret Access Key are required!")
        return
    
    # Construct the endpoint URL
    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    
    logger.info("=============== R2 CONNECTION TEST ===============")
    logger.info(f"Account ID: {account_id}")
    logger.info(f"Access Key: {access_key[:4]}...{access_key[-4:]}")
    logger.info(f"Endpoint URL: {endpoint_url}")
    logger.info(f"Bucket Name: {bucket_name}")
    
    # Create a temporary test file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
        temp_path = temp.name
        temp.write(b"This is a test file for R2 connection verification.")
    
    logger.info(f"Created temporary test file: {temp_path}")
    
    # Create S3 client
    try:
        logger.info("Creating S3 client...")
        s3 = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name='auto',
        )
        
        # Test 1: Check if we can access the bucket
        logger.info("\n--- Test 1: Checking bucket access ---")
        try:
            s3.head_bucket(Bucket=bucket_name)
            logger.info("✅ SUCCESS! Bucket access verified.")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message')
            logger.error(f"❌ ERROR accessing bucket: {error_code} - {error_msg}")
            logger.error("This suggests an authentication or permission issue.")
            if error_code == '403':
                logger.error("The token doesn't have permission to access this bucket.")
            elif error_code == '404':
                logger.error("The bucket doesn't exist or you don't have permission to see it.")
            return
        
        # Test 2: Try to upload a file
        logger.info("\n--- Test 2: Uploading test file ---")
        test_key = "test/connection_verification.txt"
        try:
            s3.upload_file(temp_path, bucket_name, test_key)
            logger.info("✅ SUCCESS! File uploaded successfully.")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message')
            logger.error(f"❌ ERROR uploading file: {error_code} - {error_msg}")
            return
            
        # Test 3: Generate a URL
        logger.info("\n--- Test 3: Generating presigned URL ---")
        try:
            url = s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket_name, 'Key': test_key},
                ExpiresIn=3600
            )
            logger.info(f"✅ SUCCESS! Generated URL: {url}")
        except ClientError as e:
            logger.error(f"❌ ERROR generating URL: {e}")
        
        # Test 4: Download the file
        logger.info("\n--- Test 4: Downloading test file ---")
        try:
            download_path = f"{temp_path}_downloaded"
            s3.download_file(bucket_name, test_key, download_path)
            logger.info(f"✅ SUCCESS! File downloaded to {download_path}")
            
            # Clean up downloaded file
            os.unlink(download_path)
            logger.info(f"Removed downloaded test file")
        except ClientError as e:
            logger.error(f"❌ ERROR downloading file: {e}")
        
        # Clean up - delete the test file from R2
        logger.info("\n--- Cleaning up ---")
        try:
            s3.delete_object(Bucket=bucket_name, Key=test_key)
            logger.info(f"✅ SUCCESS! Test file deleted from R2")
        except ClientError as e:
            logger.error(f"❌ ERROR deleting test file: {e}")
        
    except Exception as e:
        logger.error(f"❌ ERROR setting up S3 client: {e}")
    
    # Clean up the local temporary file
    try:
        os.unlink(temp_path)
        logger.info(f"Removed local test file")
    except Exception as e:
        logger.error(f"Error removing temporary file: {e}")
    
    logger.info("\n===============================================")
    logger.info("R2 connection test completed.")

if __name__ == "__main__":
    test_r2_connection() 