import logging
import traceback
import os
import boto3
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import APIRouter, HTTPException

from app.core.config import settings

router = APIRouter(prefix="/test", tags=["test"])
logger = logging.getLogger(__name__)

@router.get("/r2-connection")
async def test_r2_connection():
    """Test connection to R2 storage and provide diagnostic information."""
    
    # Check if we're using mock storage
    using_mock_storage = settings.USE_MOCK_STORAGE
    
    # Prepare response
    response = {
        "success": True,
        "using_mock_storage": using_mock_storage,
        "storage_type": "MockStorage" if using_mock_storage else "R2Storage",
        "use_mock_storage_setting": settings.USE_MOCK_STORAGE,
    }
    
    # If using mock storage, return early
    if using_mock_storage:
        return response
    
    # Add R2 settings to response (masking sensitive info)
    response["r2_settings"] = {
        "R2_ACCOUNT_ID": settings.R2_ACCOUNT_ID,
        "R2_ACCESS_KEY_ID_masked": f"{settings.R2_ACCESS_KEY_ID[:4]}...{settings.R2_ACCESS_KEY_ID[-4:]}" if settings.R2_ACCESS_KEY_ID else "Not set",
        "R2_SECRET_ACCESS_KEY_set": bool(settings.R2_SECRET_ACCESS_KEY),
        "R2_BUCKET_NAME": settings.R2_BUCKET_NAME
    }
    
    # Log environment variables for debugging
    logger.info(f"R2_ACCOUNT_ID: {settings.R2_ACCOUNT_ID}")
    logger.info(f"R2_ACCESS_KEY_ID: {settings.R2_ACCESS_KEY_ID[:4]}...{settings.R2_ACCESS_KEY_ID[-4:] if len(settings.R2_ACCESS_KEY_ID) > 8 else ''}")
    logger.info(f"R2_SECRET_ACCESS_KEY: {'[SET]' if settings.R2_SECRET_ACCESS_KEY else '[NOT SET]'}")
    logger.info(f"R2_BUCKET_NAME: {settings.R2_BUCKET_NAME}")
    
    # Construct endpoint URL
    endpoint_url = settings.R2_ENDPOINT or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    response["endpoint_url"] = endpoint_url
    response["bucket_name"] = settings.R2_BUCKET_NAME
    
    # Add environment variables to response
    response["environment_variables"] = {
        "R2_BUCKET_NAME": os.getenv("R2_BUCKET_NAME", "Not set"),
        "R2_ACCOUNT_ID": os.getenv("R2_ACCOUNT_ID", "Not set"),
        "CLOUDFLARE_R2_ACCESS_KEY_ID": os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "Not set"),
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY": "[MASKED]" if os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY") else "Not set",
        "CLOUDFLARE_R2_ENDPOINT": os.getenv("CLOUDFLARE_R2_ENDPOINT", "Not set")
    }
    
    try:
        # Create S3 client
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",  # Cloudflare R2 requires a specific region: auto, wnam, enam, weur, eeur, apac
        )
        
        # Check if bucket exists
        try:
            s3.head_bucket(Bucket=settings.R2_BUCKET_NAME)
            response["bucket_exists"] = True
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_message = str(e)
            response["bucket_exists"] = False
            response["bucket_error"] = error_message
            
            # If bucket doesn't exist, try to create it
            if error_code == '404':
                try:
                    logger.info(f"Bucket {settings.R2_BUCKET_NAME} does not exist. Attempting to create it.")
                    s3.create_bucket(Bucket=settings.R2_BUCKET_NAME)
                    response["bucket_created"] = True
                    response["bucket_exists"] = True
                except Exception as create_error:
                    response["bucket_created"] = False
                    response["bucket_creation_error"] = str(create_error)
        
        # Try to list buckets
        try:
            buckets = s3.list_buckets()
            response["available_buckets"] = [bucket['Name'] for bucket in buckets.get('Buckets', [])]
        except Exception as list_error:
            response["list_buckets_error"] = str(list_error)
        
        # Try to upload a test file
        if response.get("bucket_exists", False) or response.get("bucket_created", False):
            try:
                # Create a temporary test file
                test_file_path = "/tmp/r2_test_file.txt"
                with open(test_file_path, "w") as f:
                    f.write("This is a test file for R2 connection.")
                
                # Upload the test file
                test_object_name = "test/r2_connection_test.txt"
                s3.upload_file(test_file_path, settings.R2_BUCKET_NAME, test_object_name)
                
                # Generate a presigned URL
                url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': settings.R2_BUCKET_NAME, 'Key': test_object_name},
                    ExpiresIn=3600
                )
                
                response["test_file_uploaded"] = True
                response["test_file_url"] = url
                
                # Clean up
                os.remove(test_file_path)
            except Exception as upload_error:
                response["test_file_uploaded"] = False
                response["test_file_error"] = str(upload_error)
    
    except NoCredentialsError:
        response["success"] = False
        response["error"] = "No credentials provided for R2"
    except Exception as e:
        response["success"] = False
        response["error"] = str(e)
        response["traceback"] = traceback.format_exc()
    
    return response 