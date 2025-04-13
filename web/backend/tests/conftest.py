import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
import boto3
from moto import mock_s3

# Move this import down into fixtures that need it
# from app.config import Settings, get_settings 
from app.services.storage import R2Storage
from app.db.mongodb import get_database, get_test_database, DatabaseSession

@pytest.fixture
def s3_test_bucket():
    """Fixture for mocked S3 bucket to test R2Storage."""
    # Import moved here if needed, but currently config is mocked
    # from app.config import Settings, get_settings 
    
    # Start moto server to mock S3
    mock = mock_s3()
    mock.start()
    
    # Create test bucket
    test_bucket_name = "test-bucket"
    region = "us-east-1"
    
    # Create test settings
    config = MagicMock()
    config.CLOUDFLARE_R2_BUCKET_NAME = test_bucket_name
    config.CLOUDFLARE_ACCOUNT_ID = "test-account"
    config.CLOUDFLARE_R2_ACCESS_KEY_ID = "test-key"
    config.CLOUDFLARE_R2_SECRET_ACCESS_KEY = "test-secret"
    
    # Create S3 client and bucket
    s3 = boto3.client('s3', region_name=region)
    s3.create_bucket(Bucket=test_bucket_name)
    
    # Create R2Storage instance with mocked settings
    storage = R2Storage(config)
    
    # Override client with our test client
    storage.s3 = s3
    
    yield storage
    
    # Clean up
    mock.stop() 