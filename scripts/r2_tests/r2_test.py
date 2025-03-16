import boto3
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger()

# Set up different credential combinations to try
credentials = [
    {
        "name": "New API Credentials (from screenshot)",
        "access_key": "ad3517467c634ecf33f723cd19b25d01",
        "secret_key": "179247cd0a61bed35d62efeb4d729ae5be3b281b18f8cb33ebcf804c0c61771a" 
    },
    {
        "name": "Old Credentials (from docker-compose.yml)",
        "access_key": "ad35174d76588bef33f723cd19b25e01",
        "secret_key": "179247cd061bed35d62efeb4d729ae5be3b281b18f8cb33ebcf804c0c6177115"
    },
    {
        "name": "Variant 1: Screenshot Access Key + Docker Secret Key",
        "access_key": "ad3517467c634ecf33f723cd19b25d01",
        "secret_key": "179247cd061bed35d62efeb4d729ae5be3b281b18f8cb33ebcf804c0c6177115"
    },
    {
        "name": "Variant 2: Docker Access Key + Screenshot Secret Key",
        "access_key": "ad35174d76588bef33f723cd19b25e01",
        "secret_key": "179247cd0a61bed35d62efeb4d729ae5be3b281b18f8cb33ebcf804c0c61771a"
    }
]

# Common settings
r2_account_id = "68b1765fe971ce074e1a3bad853b4031"
bucket_name = "autoshorts-media"
endpoint_url = f"https://{r2_account_id}.r2.cloudflarestorage.com"

def test_credentials():
    """Test R2 connection with different credential combinations"""
    logger.info("Starting R2 credentials test...")
    
    for cred in credentials:
        logger.info("\n" + "="*80)
        logger.info(f"Testing: {cred['name']}")
        logger.info(f"Access Key: {cred['access_key'][:4]}...{cred['access_key'][-4:]}")
        logger.info(f"Secret Key: {cred['secret_key'][:4]}...{cred['secret_key'][-4:]}")
        logger.info(f"Endpoint: {endpoint_url}")
        
        try:
            # Create S3 client with these credentials
            s3 = boto3.client(
                's3',
                endpoint_url=endpoint_url,
                aws_access_key_id=cred['access_key'],
                aws_secret_access_key=cred['secret_key'],
                region_name="weur"  # Try explicit WEUR region
            )
            
            try:
                # Basic operation: list buckets
                logger.info("Attempting to list buckets...")
                response = s3.list_buckets()
                buckets = [bucket['Name'] for bucket in response.get('Buckets', [])]
                logger.info(f"✅ SUCCESS! Found buckets: {buckets}")
                
                # Try bucket-specific operation
                logger.info(f"Checking bucket '{bucket_name}'...")
                response = s3.head_bucket(Bucket=bucket_name)
                logger.info(f"✅ Bucket exists! Response: {response}")
                
                # Success - record which credentials worked
                logger.info(f"✅ CREDENTIALS VERIFIED: {cred['name']} WORKS!")
                
            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code')
                logger.error(f"❌ Operation failed. Error code: {error_code}")
                logger.error(f"Error message: {str(e)}")
                
        except Exception as e:
            logger.error(f"❌ Client creation failed: {str(e)}")
    
    logger.info("\nCredential testing complete.")

if __name__ == "__main__":
    test_credentials() 