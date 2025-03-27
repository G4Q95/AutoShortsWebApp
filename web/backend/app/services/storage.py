import logging
import os
import traceback
from typing import BinaryIO, Optional, Tuple, Any, List, Dict, Union

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError

from app.core.config import settings

logger = logging.getLogger(__name__)


class R2Storage:
    """
    Class for interacting with Cloudflare R2 Storage.
    Uses S3-compatible API.
    """

    def __init__(self):
        """Initialize the R2 client."""
        # Use the endpoint URL from settings if available, otherwise construct it
        self.endpoint_url = settings.R2_ENDPOINT or f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        self.bucket_name = settings.R2_BUCKET_NAME
        
        # Log configuration details (with sensitive parts masked)
        logger.info(f"Initializing R2Storage with endpoint: {self.endpoint_url}")
        logger.info(f"Using bucket: {self.bucket_name}")
        logger.info(f"Access Key ID: {settings.R2_ACCESS_KEY_ID[:4]}...{settings.R2_ACCESS_KEY_ID[-4:]}")
        
        # Validate settings
        if not settings.R2_ENDPOINT and not settings.R2_ACCOUNT_ID:
            logger.error("Neither R2_ENDPOINT nor R2_ACCOUNT_ID is set")
        if not settings.R2_ACCESS_KEY_ID:
            logger.error("R2_ACCESS_KEY_ID is not set or empty")
        if not settings.R2_SECRET_ACCESS_KEY:
            logger.error("R2_SECRET_ACCESS_KEY is not set or empty")
        if not settings.R2_BUCKET_NAME:
            logger.error("R2_BUCKET_NAME is not set or empty")

        # Create session with error handling
        try:
            self.s3 = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",  # Cloudflare R2 requires a specific region: auto, wnam, enam, weur, eeur, apac
            )
            
            # Test connection during initialization
            self._test_connection()
            
        except Exception as e:
            logger.error(f"Failed to initialize S3 client: {str(e)}")
            logger.error(traceback.format_exc())
            # Still create the client, but log the error
            self.s3 = boto3.client(
                "s3",
                endpoint_url=self.endpoint_url,
                aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                region_name="auto",  # Cloudflare R2 requires a specific region: auto, wnam, enam, weur, eeur, apac
            )
    
    def _test_connection(self):
        """Test connection to R2 by listing buckets."""
        try:
            # First check if our bucket exists
            self.s3.head_bucket(Bucket=self.bucket_name)
            logger.info(f"Successfully connected to R2 bucket: {self.bucket_name}")
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code == '403':
                logger.error(f"Access denied to bucket {self.bucket_name}. Check your credentials.")
            elif error_code == '404':
                logger.error(f"Bucket {self.bucket_name} does not exist.")
            else:
                logger.error(f"Error checking bucket: {str(e)}")
        except NoCredentialsError:
            logger.error("Credentials not available or incorrect")
        except EndpointConnectionError:
            logger.error(f"Could not connect to endpoint: {self.endpoint_url}")
        except Exception as e:
            logger.error(f"Error testing R2 connection: {str(e)}")
            logger.error(traceback.format_exc())

    def get_file_path(self, user_id: str, project_id: str, scene_id: str = None, 
                     file_type: str = None, filename: str = None) -> str:
        """
        Generate a consistent file path for storage using the standard structure.
        
        Args:
            user_id: The user's unique identifier
            project_id: The project's unique identifier
            scene_id: Optional scene identifier within the project
            file_type: Optional file type (e.g., "audio", "image", "video")
            filename: Optional filename
            
        Returns:
            Structured path string for R2 storage
        """
        path = f"users/{user_id}/projects/{project_id}/"
        
        if scene_id:
            path += f"scenes/{scene_id}/"
            
            if file_type:
                path += f"{file_type}/"
                
                if filename:
                    path += filename
        
        return path

    async def upload_file(
        self, file_path: str, object_name: Optional[str] = None,
        user_id: Optional[str] = None, project_id: Optional[str] = None,
        scene_id: Optional[str] = None, file_type: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Upload a file to R2 storage.

        Args:
            file_path: Path to the file to upload
            object_name: S3 object name (if not specified, file_path's basename is used)
            user_id: Optional user ID for structured storage path
            project_id: Optional project ID for structured storage path
            scene_id: Optional scene ID for structured storage path
            file_type: Optional file type category for structured storage path

        Returns:
            Tuple of (success, url or error message)
        """
        if not os.path.exists(file_path):
            logger.error(f"File not found during upload: {file_path}")
            return False, f"File {file_path} does not exist"

        # If we have user_id and project_id, use structured paths
        if user_id and project_id:
            filename = os.path.basename(file_path) if object_name is None else object_name
            object_name = self.get_file_path(user_id, project_id, scene_id, file_type, filename)
        elif object_name is None:
            # Fall back to simple object name if not using structured paths
            object_name = os.path.basename(file_path)
        
        logger.info(f"Attempting to upload file {file_path} to R2 as {object_name}")
        
        # Add file size info for debugging
        try:
            file_size = os.path.getsize(file_path)
            logger.info(f"File size: {file_size} bytes")
        except Exception as e:
            logger.warning(f"Could not get file size: {str(e)}")

        try:
            # Open and read the file to ensure it's valid
            with open(file_path, 'rb') as f:
                file_content = f.read()
                logger.info(f"Successfully read {len(file_content)} bytes from file")
            
            # Upload the file
            self.s3.upload_file(file_path, self.bucket_name, object_name)
            
            # Create a proper URL for the uploaded file
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=settings.R2_URL_EXPIRATION  # Use the expiration setting from config
            )
            
            logger.info(f"Successfully uploaded file to R2: {url}")
            return True, url
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"R2 client error during upload: {error_code} - {error_msg}")
            # Try to fall back to mock storage
            logger.warning("R2 upload failed, attempting to fall back to local storage")
            from app.services.mock_storage import MockStorage
            mock_storage = MockStorage()
            success, mock_url = await mock_storage.upload_file(file_path, object_name)
            if success:
                logger.info(f"Successfully fell back to mock storage: {mock_url}")
                return True, mock_url
            return False, f"R2 error: {error_msg}, Mock storage fallback also failed"
            
        except NoCredentialsError:
            logger.error("Failed to upload file due to invalid credentials")
            return False, "Invalid credentials for R2 storage"
            
        except EndpointConnectionError:
            logger.error(f"Could not connect to endpoint: {self.endpoint_url}")
            return False, f"Could not connect to R2 endpoint: {self.endpoint_url}"
            
        except Exception as e:
            logger.error(f"Unexpected error uploading file to R2: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e)

    async def download_file(self, object_name: str, file_path: str) -> Tuple[bool, str]:
        """
        Download a file from R2 storage.

        Args:
            object_name: The S3 object name to download
            file_path: Local path to save the file

        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Attempting to download file {object_name} from R2 to {file_path}")
        
        try:
            self.s3.download_file(self.bucket_name, object_name, file_path)
            logger.info(f"Successfully downloaded file from R2: {object_name}")
            return True, f"File downloaded to {file_path}"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"R2 client error during download: {error_code} - {error_msg}")
            return False, f"R2 error: {error_msg}"
        except Exception as e:
            logger.error(f"Error downloading file from R2: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e)

    async def delete_file(self, object_name: str) -> Tuple[bool, str]:
        """
        Delete a file from R2 storage.

        Args:
            object_name: The S3 object name to delete

        Returns:
            Tuple of (success, message)
        """
        logger.info(f"Attempting to delete file {object_name} from R2")
        
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=object_name)
            logger.info(f"Successfully deleted file from R2: {object_name}")
            return True, f"Deleted {object_name}"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"R2 client error during deletion: {error_code} - {error_msg}")
            return False, f"R2 error: {error_msg}"
        except Exception as e:
            logger.error(f"Error deleting file from R2: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e)

    async def get_file_url(self, object_name: str, expiration: int = None) -> Optional[str]:
        """
        Generate a presigned URL for an object.

        Args:
            object_name: The S3 object name
            expiration: URL expiration in seconds (defaults to R2_URL_EXPIRATION from settings)

        Returns:
            The presigned URL or None if error
        """
        if expiration is None:
            expiration = settings.R2_URL_EXPIRATION
            
        logger.info(f"Generating presigned URL for {object_name} (expires in {expiration}s)")
        
        try:
            url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": object_name},
                ExpiresIn=expiration,
            )
            logger.info(f"Generated presigned URL: {url[:50]}...")
            return url
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"R2 client error generating URL: {error_code} - {error_msg}")
            return None
        except Exception as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    async def check_files_exist(self, prefix: str) -> Any:
        """
        Check if any files exist with the given prefix in the bucket.
        
        Args:
            prefix: The prefix to check
            
        Returns:
            The ListObjectsV2 response or None if error
        """
        logger.info(f"Checking for files with prefix: {prefix}")
        
        try:
            response = self.s3.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=10
            )
            # Log the result
            if 'Contents' in response and len(response['Contents']) > 0:
                logger.info(f"Found {len(response['Contents'])} files with prefix {prefix}")
                for item in response['Contents']:
                    logger.info(f"- {item.get('Key')} ({item.get('Size')} bytes)")
            else:
                logger.info(f"No files found with prefix {prefix}")
            
            return response
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"R2 client error checking files: {error_code} - {error_msg}")
            return None
        except Exception as e:
            logger.error(f"Error checking files with prefix {prefix}: {str(e)}")
            logger.error(traceback.format_exc())
            return None

    async def list_directory(self, prefix: str) -> Tuple[bool, Union[List[Dict[str, Any]], str]]:
        """
        List all objects with the given prefix (simulating a directory).
        
        Args:
            prefix: The prefix/directory to list
            
        Returns:
            Tuple containing (success, result)
                - If success is True, result is a list of objects
                - If success is False, result is an error message
        """
        logger.info(f"Listing objects with prefix: {prefix}")
        
        try:
            all_objects = []
            continuation_token = None
            
            # Use pagination to handle large directories
            while True:
                # Prepare list_objects_v2 parameters with pagination
                params = {
                    'Bucket': self.bucket_name,
                    'Prefix': prefix
                }
                
                if continuation_token:
                    params['ContinuationToken'] = continuation_token
                
                # List objects with prefix
                response = self.s3.list_objects_v2(**params)
                
                # Add found objects to list
                if 'Contents' in response:
                    all_objects.extend(response['Contents'])
                
                # Check if there are more objects to fetch
                if not response.get('IsTruncated'):
                    break
                
                continuation_token = response.get('NextContinuationToken')
            
            logger.info(f"Found {len(all_objects)} objects with prefix: {prefix}")
            return True, all_objects
            
        except Exception as e:
            error_msg = f"Error listing objects with prefix {prefix}: {str(e)}"
            logger.error(error_msg)
            return False, error_msg

    async def delete_directory(self, prefix: str) -> Tuple[bool, Dict[str, int]]:
        """
        Delete all objects with the given prefix (simulating a directory).
        Uses batch deletion to minimize API calls.
        
        Args:
            prefix: The prefix/directory to delete
            
        Returns:
            Tuple containing (success, result_dict)
                - success: Whether all objects were deleted successfully
                - result_dict: Dictionary with counts of deleted and failed objects
        """
        logger.info(f"Deleting all objects with prefix: {prefix}")
        
        # First, list all objects with this prefix
        success, objects_or_error = await self.list_directory(prefix)
        
        if not success:
            return False, {"deleted": 0, "failed": 0, "error": objects_or_error}
        
        objects = objects_or_error
        
        if not objects:
            logger.info(f"No objects found with prefix {prefix}")
            return True, {"deleted": 0, "failed": 0}
        
        deleted_count = 0
        failed_count = 0
        
        try:
            # Process in batches of 1000 (S3 API limit)
            batch_size = 1000
            
            for i in range(0, len(objects), batch_size):
                batch = objects[i:i + batch_size]
                
                # Prepare delete objects request
                delete_dict = {
                    'Objects': [{'Key': obj['Key']} for obj in batch]
                }
                
                # Delete the batch
                logger.info(f"Deleting batch of {len(batch)} objects")
                response = self.s3.delete_objects(
                    Bucket=self.bucket_name,
                    Delete=delete_dict
                )
                
                # Count successful deletions
                if 'Deleted' in response:
                    deleted_count += len(response['Deleted'])
                
                # Count and log errors
                if 'Errors' in response and response['Errors']:
                    for error in response['Errors']:
                        logger.error(f"Failed to delete {error.get('Key')}: {error.get('Code')} - {error.get('Message')}")
                    
                    failed_count += len(response['Errors'])
            
            success = failed_count == 0
            result = {"deleted": deleted_count, "failed": failed_count}
            
            logger.info(f"Deletion results for prefix {prefix}: {result}")
            return success, result
            
        except Exception as e:
            error_msg = f"Error during batch deletion for prefix {prefix}: {str(e)}"
            logger.error(error_msg)
            return False, {"deleted": deleted_count, "failed": len(objects) - deleted_count, "error": str(e)}

    async def upload_file_content(
        self, file_content: BinaryIO, object_name: str,
        user_id: Optional[str] = None, project_id: Optional[str] = None,
        scene_id: Optional[str] = None, file_type: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Upload a file from its content to R2 storage.

        Args:
            file_content: Binary content of the file to upload
            object_name: S3 object name (required)
            user_id: Optional user ID for structured storage path
            project_id: Optional project ID for structured storage path
            scene_id: Optional scene ID for structured storage path
            file_type: Optional file type category for structured storage path

        Returns:
            Tuple of (success, url or error message)
        """
        # If we have user_id and project_id, use structured paths
        if user_id and project_id:
            object_name = self.get_file_path(user_id, project_id, scene_id, file_type, object_name)

        logger.info(f"Attempting to upload file content to R2 as {object_name}")
        
        try:
            # Upload the file directly from content
            self.s3.upload_fileobj(file_content, self.bucket_name, object_name)
            
            # Create a proper URL for the uploaded file
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=settings.R2_URL_EXPIRATION
            )
            
            logger.info(f"Successfully uploaded file content to R2: {url}")
            return True, url
            
        except Exception as e:
            logger.error(f"Error uploading file content to R2: {str(e)}")
            logger.error(traceback.format_exc())
            return False, str(e)

    async def delete_project_files(self, user_id: str, project_id: str) -> Dict[str, Any]:
        """
        Delete all files associated with a specific project.
        
        Args:
            user_id: The user's unique identifier
            project_id: The project's unique identifier
            
        Returns:
            Dictionary with deletion results
        """
        prefix = self.get_file_path(user_id, project_id)
        result = await self.delete_directory(prefix)
        return result

    async def delete_scene_files(self, user_id: str, project_id: str, scene_id: str) -> Dict[str, Any]:
        """
        Delete all files associated with a specific scene.
        
        Args:
            user_id: The user's unique identifier
            project_id: The project's unique identifier
            scene_id: The scene's unique identifier
            
        Returns:
            Dictionary with deletion results
        """
        prefix = self.get_file_path(user_id, project_id, scene_id)
        result = await self.delete_directory(prefix)
        return result


# Create a singleton storage instance
_storage: Optional[R2Storage] = None

def get_storage():
    """
    Get a singleton instance of the storage service.
    Returns R2Storage or MockStorage based on USE_MOCK_STORAGE setting.
    
    Returns:
        Storage service instance
    """
    global _storage
    if _storage is None:
        if settings.USE_MOCK_STORAGE:
            # Import here to avoid circular imports
            from app.services.mock_storage import MockStorage
            _storage = MockStorage()
            logger.info("Created MockStorage instance for local file storage")
        else:
            _storage = R2Storage()
            logger.info(f"Created R2Storage instance with endpoint: {_storage.endpoint_url}")
    return _storage


# Legacy code for backward compatibility - should be removed in future
# This causes two instances to be created which could cause issues
storage = R2Storage()
