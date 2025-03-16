import boto3
import os
import tempfile
from botocore.exceptions import ClientError
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_r2_token():
    """Test if the R2 token is valid by creating a small test file in the bucket."""
    
    # R2 configuration
    account_id = "68b1765fe971ce074e1a3bad853b4031"
    access_key = "9d7d5a07297042b9b69d1b8680c3fa5f"
    secret_key = "42b1510d0a04c649a0d52de2e56e62c26a087efb90305f7d85e7a0887f20221"
    bucket_name = "autoshorts-media"
    endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
    
    logger.info(f"Testing R2 token with:")
    logger.info(f"Account ID: {account_id}")
    logger.info(f"Access Key: {access_key[:5]}...{access_key[-4:]}")
    logger.info(f"Endpoint URL: {endpoint_url}")
    logger.info(f"Bucket Name: {bucket_name}")
    
    # Create a temporary test file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp:
        temp_path = temp.name
        temp.write(b"This is a test file for R2 token validation.")
    
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
        
        # Try to upload the test file
        test_key = "test/token_validation_test.txt"
        logger.info(f"Attempting to upload test file to {test_key}...")
        
        try:
            s3.upload_file(temp_path, bucket_name, test_key)
            logger.info("✅ SUCCESS! File uploaded successfully.")
            
            # Generate a URL for the file
            try:
                url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': test_key},
                    ExpiresIn=3600
                )
                logger.info(f"✅ Generated URL: {url}")
                
                # Try to download the file to verify
                try:
                    download_path = f"{temp_path}_downloaded"
                    s3.download_file(bucket_name, test_key, download_path)
                    logger.info(f"✅ Successfully downloaded the file to {download_path}")
                    
                    # Clean up downloaded file
                    os.unlink(download_path)
                    logger.info(f"Removed downloaded test file")
                    
                except ClientError as e:
                    logger.error(f"❌ Error downloading file: {e}")
                
                # Clean up the test file from R2
                try:
                    s3.delete_object(Bucket=bucket_name, Key=test_key)
                    logger.info(f"✅ Successfully deleted test file from R2")
                except ClientError as e:
                    logger.error(f"❌ Error deleting test file from R2: {e}")
                
            except ClientError as e:
                logger.error(f"❌ Error generating URL: {e}")
            
        except ClientError as e:
            logger.error(f"❌ Error uploading file: {e}")
            logger.error(f"Error code: {e.response.get('Error', {}).get('Code', 'Unknown')}")
            logger.error(f"Error message: {e.response.get('Error', {}).get('Message', 'Unknown')}")
            
    except Exception as e:
        logger.error(f"❌ Error setting up S3 client: {e}")
    
    # Clean up the local temporary file
    try:
        os.unlink(temp_path)
        logger.info(f"Removed local test file")
    except Exception as e:
        logger.error(f"Error removing temporary file: {e}")
    
    logger.info("R2 token test completed.")

if __name__ == "__main__":
    test_r2_token() 