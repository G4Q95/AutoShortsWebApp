import logging
import os
import traceback
import asyncio
import uuid
import time
from typing import BinaryIO, Optional, Tuple, Any, List, Dict, Union

import boto3
from botocore.exceptions import ClientError, NoCredentialsError, EndpointConnectionError

from app.core.config import settings
from app.models.storage import R2FilePathCreate
from app.services.r2_file_tracking import r2_file_tracking
from app.services.worker_client import worker_client

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

    def get_file_path(
        self, 
        user_id: str, 
        project_id: str, 
        scene_id: Optional[str] = None, 
        file_type: Optional[str] = None, 
        filename: Optional[str] = None,
        use_simplified_structure: bool = True
    ) -> str:
        """
        Generate a structured file path for storage.
        
        Args:
            user_id: User ID for the file owner
            project_id: Project ID the file belongs to
            scene_id: Optional scene ID
            file_type: Optional file type (e.g., 'video', 'audio', 'image')
            filename: Optional filename
            use_simplified_structure: Whether to use the new simplified flat structure
            
        Returns:
            Structured file path
        """
        # Log input parameters for debugging
        logger.info(f"[STORAGE-PATH-DEBUG] Called with: user_id={user_id}, project_id={project_id}, scene_id={scene_id}, file_type={file_type}, filename={filename}, use_simplified={use_simplified_structure}")
        
        # Simplified flat structure
        if use_simplified_structure:
            # Ensure we have the basic components needed
            if not project_id:
                logger.warning(f"[STORAGE-PATH] Missing project_id, falling back to hierarchical structure")
                use_simplified_structure = False
            else:
                # Check if project_id already starts with "proj_" to avoid double prefix
                prefix = ""
                if not project_id.startswith("proj_"):
                    prefix = "proj_"
                    logger.info(f"[STORAGE-PATH-DEBUG] Adding 'proj_' prefix to project_id")
                else:
                    logger.info(f"[STORAGE-PATH-DEBUG] Project ID already has 'proj_' prefix, not adding again")
                
                # Build simplified path with conditional prefix
                path_components = [f"{prefix}{project_id}"]
                logger.info(f"[STORAGE-PATH-DEBUG] First path component: {path_components[0]}")
                
                # Add scene component if available
                if scene_id:
                    path_components.append(scene_id)
                else:
                    path_components.append("general")
                    
                # Add file type component if available
                if file_type:
                    path_components.append(file_type)
                else:
                    path_components.append("media")
                
                # Process filename
                if filename:
                    # Extract extension if present
                    if '.' in filename:
                        name_part, ext = os.path.splitext(filename)
                    else:
                        name_part, ext = filename, ''
                        
                    # Combine all components with the filename
                    final_filename = f"{'_'.join(path_components)}{ext}"
                    
                    logger.info(f"[STORAGE-PATH] Using simplified path: {final_filename}")
                    return final_filename
                    
                # If we don't have a filename, we can't use the simplified structure
                logger.warning(f"[STORAGE-PATH] Missing filename for simplified structure, falling back to hierarchical")
                use_simplified_structure = False
                
        # Traditional hierarchical structure (fallback)
        if not use_simplified_structure:
            # Default user ID if not provided
            if not user_id:
                user_id = "default"
                
            # Build hierarchical path components
            path_parts = ["users", user_id, "projects", project_id]
            
            # Add scene component if available
            if scene_id:
                path_parts.extend(["scenes", scene_id])
                
            # Add file type component if available
            if file_type:
                path_parts.append(file_type)
                
            # Add filename component if available
            if filename:
                path_parts.append(filename)
                
            # Join path components with forward slashes
            path = '/'.join(path_parts)
            logger.info(f"[STORAGE-PATH] Using hierarchical path: {path}")
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
        file_size = 0
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
            
            # Track the file in the database if project_id is provided
            if project_id:
                # Create file tracking record
                file_data = R2FilePathCreate(
                    project_id=project_id,
                    object_key=object_name,
                    scene_id=scene_id,
                    file_type=file_type, 
                    user_id=user_id,
                    size_bytes=file_size,
                    content_type=None,  # We don't have this information yet
                    metadata={"url": url}
                )
                
                # Create record asynchronously - needs its own event loop when called from sync context
                try:
                    # await r2_file_tracking.create_file_record(file_data)
                    # Run the async tracking function in its own event loop
                    asyncio.run(r2_file_tracking.create_file_record(file_data))
                    logger.info(f"Successfully tracked file path for {object_name}")
                except Exception as e:
                    # Don't fail the upload if tracking fails
                    logger.error(f"Failed to track file path for {object_name}: {str(e)}")
            
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
        # Generate a unique ID for tracking this specific deletion
        delete_id = str(uuid.uuid4())[:6]
        logger.info(f"[DELETE-{delete_id}] Starting deletion for {object_name} from R2")
        
        try:
            logger.info(f"[DELETE-{delete_id}] Sending delete request to R2 for {object_name}")
            
            # Measure performance for diagnostics
            start_time = time.time()
            
            # Make the actual delete call - without await since boto3 is not async
            self.s3.delete_object(Bucket=self.bucket_name, Key=object_name)
            
            # Get elapsed time
            elapsed = time.time() - start_time
            logger.info(f"[DELETE-{delete_id}] Delete operation took {elapsed:.2f}s for {object_name}")
            
            # Verify deletion by attempting to check if the object still exists
            try:
                logger.info(f"[DELETE-{delete_id}] Verifying deletion of {object_name}")
                head_start = time.time()
                # Don't use await here either
                self.s3.head_object(Bucket=self.bucket_name, Key=object_name)
                # If we reach here, the object still exists
                verify_elapsed = time.time() - head_start
                logger.warning(f"[DELETE-{delete_id}] Object still exists after deletion: {object_name} (check took {verify_elapsed:.2f}s)")
                return False, f"Delete operation completed but object still exists"
            except ClientError as e:
                # If we get a 404, that means the deletion worked
                if e.response.get('Error', {}).get('Code') == '404':
                    verify_elapsed = time.time() - head_start
                    logger.info(f"[DELETE-{delete_id}] Successfully verified deletion of {object_name} (verification took {verify_elapsed:.2f}s)")
                    return True, f"Deleted and verified {object_name}"
                else:
                    # Some other error occurred
                    logger.warning(f"[DELETE-{delete_id}] Error verifying deletion: {str(e)}")
                    # But we'll still consider it a success since the delete operation didn't throw an error
                    return True, f"Deleted {object_name} but could not verify deletion"
            
            logger.info(f"[DELETE-{delete_id}] Successfully deleted file from R2: {object_name}")
            return True, f"Deleted {object_name}"
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"[DELETE-{delete_id}] R2 client error during deletion: {error_code} - {error_msg}")
            return False, f"R2 error: {error_msg}"
        except Exception as e:
            logger.error(f"[DELETE-{delete_id}] Error deleting file from R2: {str(e)}")
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

    async def delete_directory(self, prefix: str) -> Dict[str, Any]:
        """
        Delete all objects with the given prefix, simulating directory deletion.
        
        Args:
            prefix: The prefix to delete (e.g., 'users/123/projects/456/')
            
        Returns:
            Dict containing deletion results and stats
        """
        # Check if this is a flat structure pattern (without trailing slash)
        is_flat_pattern = prefix.startswith("proj_") and not prefix.endswith("/")
        
        # Original prefix for logging
        original_prefix = prefix
        
        # Add trailing slash for directory-style prefixes if not a flat pattern
        if not is_flat_pattern and not prefix.endswith('/'):
            prefix = f"{prefix}/"
            logger.info(f"[DELETE-DIR] Added trailing slash to directory prefix: {original_prefix} -> {prefix}")
        
        logger.info(f"[DELETE-DIR] Starting deletion with prefix pattern: '{prefix}'")
        logger.info(f"[DELETE-DIR] Is flat pattern: {is_flat_pattern}")
        
        result = {
            "prefix": prefix,
            "success": False,
            "deleted_count": 0,
            "failed_count": 0,
            "total_bytes": 0,
            "errors": [],
            "empty_directory": False,
            "matched_objects": []  # Track the specific object names that matched
        }
        
        try:
            s3_client = self.get_s3_client()
            
            # First, check if directory exists by listing objects - remove await
            list_response = s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=1
            )
            
            # If no contents found, try with delimiter to check if it's an empty folder
            if "Contents" not in list_response or len(list_response.get("Contents", [])) == 0:
                # Remove await
                delimiter_response = s3_client.list_objects_v2(
                    Bucket=self.bucket_name,
                    Prefix=prefix,
                    Delimiter='/',
                    MaxKeys=1
                )
                
                # Check if it has common prefixes (subfolders)
                if "CommonPrefixes" in delimiter_response and len(delimiter_response["CommonPrefixes"]) > 0:
                    result["empty_directory"] = True
                    logger.info(f"[DELETE-DIR] Directory {prefix} exists but appears empty (has subfolders only)")
                else:
                    logger.info(f"[DELETE-DIR] No objects found with prefix: {prefix}")
                    return result
                    
                # If it's an empty directory, create and delete a marker object
                marker_key = f"{prefix}.empty_folder_marker"
                logger.info(f"[DELETE-DIR] Creating empty folder marker: {marker_key}")
                
                try:
                    # Remove await
                    s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=marker_key,
                        Body=b''
                    )
                    
                    # Remove await
                    s3_client.delete_object(
                        Bucket=self.bucket_name,
                        Key=marker_key
                    )
                    logger.info(f"[DELETE-DIR] Successfully created and deleted marker for empty directory: {prefix}")
                except Exception as e:
                    logger.error(f"[DELETE-DIR] Error handling empty directory marker: {str(e)}")
            
            # Get all objects with the prefix
            paginator = s3_client.get_paginator('list_objects_v2')
            page_iterator = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            # Collect all matching objects for logging first
            all_matching_objects = []
            
            logger.info(f"[DELETE-DIR] Searching for objects with prefix: '{prefix}'")
            
            # First pass to collect and log matching objects
            for page in page_iterator:
                if "Contents" in page:
                    # Log each object found for detailed troubleshooting
                    for obj in page["Contents"]:
                        obj_key = obj["Key"]
                        obj_size = obj.get("Size", 0)
                        all_matching_objects.append(obj)
                        result["matched_objects"].append(obj_key)  # Track matched object
                        logger.info(f"[DELETE-DIR] Found matching object: '{obj_key}' ({obj_size} bytes)")
                else:
                    logger.info(f"[DELETE-DIR] No objects found in this page for prefix: '{prefix}'")
            
            # If no objects found, log and exit early
            if not all_matching_objects:
                logger.info(f"[DELETE-DIR] No objects found with prefix: '{prefix}'")
                return result
            
            # Log summary of found objects
            logger.info(f"[DELETE-DIR] Found total of {len(all_matching_objects)} objects " +
                        f"with prefix '{prefix}' to delete")
            
            # Reset paginator for actual deletion
            page_iterator = paginator.paginate(
                Bucket=self.bucket_name,
                Prefix=prefix
            )
            
            # Delete each object
            for page in page_iterator:
                if "Contents" not in page:
                    continue
                    
                objects_to_delete = [{"Key": obj["Key"]} for obj in page["Contents"]]
                
                if objects_to_delete:
                    logger.info(f"[DELETE-DIR] Deleting batch of {len(objects_to_delete)} objects with prefix: {prefix}")
                    
                    # Log all keys in this batch
                    for i, obj_to_delete in enumerate(objects_to_delete):
                        logger.info(f"[DELETE-DIR] Batch item {i+1}: Deleting '{obj_to_delete['Key']}'")
                    
                    # Collect size information before deleting
                    for obj in page["Contents"]:
                        result["total_bytes"] += obj.get("Size", 0)
                    
                    # Delete objects in batch
                    try:
                        # Remove await since boto3 is not async
                        delete_response = s3_client.delete_objects(
                            Bucket=self.bucket_name,
                            Delete={"Objects": objects_to_delete}
                        )
                        
                        # Record successful deletions
                        if "Deleted" in delete_response:
                            result["deleted_count"] += len(delete_response["Deleted"])
                            
                        # Record failed deletions
                        if "Errors" in delete_response:
                            result["failed_count"] += len(delete_response["Errors"])
                            for error in delete_response["Errors"]:
                                result["errors"].append({
                                    "key": error.get("Key", "unknown"),
                                    "code": error.get("Code", "unknown"),
                                    "message": error.get("Message", "unknown")
                                })
                                logger.error(f"[DELETE-DIR] Failed to delete object {error.get('Key')}: {error.get('Message')}")
                            
                    except Exception as e:
                        logger.error(f"[DELETE-DIR] Error during batch deletion: {str(e)}")
                        result["errors"].append({"message": str(e)})
            
            # Update success status based on deletion results
            result["success"] = result["failed_count"] == 0
            
            # Log summary of deletion
            logger.info(f"[DELETE-DIR] Directory deletion complete for {prefix}:")
            logger.info(f"[DELETE-DIR] - {result['deleted_count']} objects deleted successfully")
            logger.info(f"[DELETE-DIR] - {result['failed_count']} objects failed to delete")
            logger.info(f"[DELETE-DIR] - {result['total_bytes']/1024/1024:.2f} MB freed")
            
            return result
            
        except Exception as e:
            logger.error(f"[DELETE-DIR] Error deleting directory {prefix}: {str(e)}")
            result["errors"].append({"message": str(e)})
            return result

    async def upload_file_content(
        self, file_content: BinaryIO, object_name: str,
        user_id: Optional[str] = None, project_id: Optional[str] = None,
        scene_id: Optional[str] = None, file_type: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Upload binary content directly to R2 storage.

        Args:
            file_content: Binary content to upload
            object_name: S3 object name
            user_id: Optional user ID for structured storage path
            project_id: Optional project ID for structured storage path
            scene_id: Optional scene ID for structured storage path
            file_type: Optional file type category for structured storage path

        Returns:
            Tuple of (success, url or error message)
        """
        # Get structured path if we have user_id and project_id
        if user_id and project_id:
            object_name_structured = self.get_file_path(user_id, project_id, scene_id, file_type, object_name)
        else:
            object_name_structured = object_name
        
        logger.info(f"Attempting to upload content to R2 as {object_name_structured}")
        
        try:
            # Check file size 
            content_size = len(file_content.read())
            file_content.seek(0)  # Reset file pointer after reading
            logger.info(f"Content size: {content_size} bytes")

            # Upload the content
            self.s3.upload_fileobj(
                file_content, 
                self.bucket_name, 
                object_name_structured
            )
            
            # Create a proper URL for the uploaded file
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name_structured},
                ExpiresIn=settings.R2_URL_EXPIRATION
            )
            
            # Track the file in the database if project_id is provided
            if project_id:
                # Create file tracking record
                file_data = R2FilePathCreate(
                    project_id=project_id,
                    object_key=object_name_structured,
                    scene_id=scene_id,
                    file_type=file_type, 
                    user_id=user_id,
                    size_bytes=content_size,
                    content_type=None,  # We don't have this information yet
                    metadata={"url": url}
                )
                
                # Create record asynchronously - needs its own event loop when called from sync context
                try:
                    # await r2_file_tracking.create_file_record(file_data)
                    # Run the async tracking function in its own event loop
                    asyncio.run(r2_file_tracking.create_file_record(file_data))
                    logger.info(f"Successfully tracked file path for {object_name_structured}")
                except Exception as e:
                    # Don't fail the upload if tracking fails
                    logger.error(f"Failed to track file path for {object_name_structured}: {str(e)}")
            
            logger.info(f"Successfully uploaded content to R2: {url}")
            return True, url
            
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"UPLOAD ERROR: R2 client error: {error_code} - {error_msg}")
            return False, f"R2 error: {error_msg}"
            
        except Exception as e:
            logger.error(f"UPLOAD ERROR: General error: {str(e)}")
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

    def get_s3_client(self):
        """
        Get the S3 client for interacting with R2.
        
        Returns:
            boto3 S3 client
        """
        return self.s3

    async def list_project_files(self, project_id: str) -> List[Dict[str, Any]]:
        """
        List all files associated with a project in R2 storage.
        
        Args:
            project_id: The project ID to list files for
            
        Returns:
            List of files with their metadata
        """
        logger.info(f"[LIST-PROJECT] Listing files for project: {project_id}")
        
        # Ensure project ID has the correct format
        if not project_id.startswith("proj_"):
            project_id = f"proj_{project_id}"
            logger.info(f"[LIST-PROJECT] Added 'proj_' prefix to project ID: {project_id}")
        
        # Get an S3 client for listing objects
        s3_client = self.s3
        
        # Define patterns to search for based on known path structures
        search_patterns = []
        
        # Check if project_id already has the 'proj_' prefix
        project_id_clean = project_id
        if project_id.startswith("proj_"):
            project_id_clean = project_id[5:]  # Remove 'proj_' prefix
            # Add pattern with double prefix (known issue)
            search_patterns.append(f"proj_proj_{project_id_clean}")
        
        # Add standard patterns
        search_patterns.append(project_id)  # Original form
        search_patterns.append(f"proj_{project_id_clean}")  # With prefix
        
        # Add hierarchical path patterns
        search_patterns.append(f"projects/{project_id}/")  # Traditional hierarchical
        search_patterns.append(f"users/default/projects/{project_id}/")  # Full hierarchical
        
        # Add content-specific paths
        search_patterns.append(f"audio/{project_id}/")  # Audio content
        search_patterns.append(f"video/{project_id}/")  # Video content
        search_patterns.append(f"media/{project_id}/")  # Media content
        search_patterns.append(f"thumbnails/{project_id}/")  # Thumbnail content
        
        logger.info(f"[LIST-PROJECT] Searching with patterns: {search_patterns}")
        
        # Initialize result
        matching_files = []
        
        try:
            # List all objects in the bucket with pagination
            paginator = s3_client.get_paginator('list_objects_v2')
            
            # Check each pattern
            for pattern in search_patterns:
                logger.info(f"[LIST-PROJECT] Checking pattern: {pattern}")
                
                try:
                    # List objects with this prefix
                    page_iterator = paginator.paginate(
                        Bucket=self.bucket_name,
                        Prefix=pattern
                    )
                    
                    # Process each page of results - use regular for loop not async for
                    for page in page_iterator:
                        if "Contents" in page:
                            for obj in page["Contents"]:
                                # Create a simplified object representation
                                file_info = {
                                    "key": obj["Key"],
                                    "size": obj.get("Size", 0),
                                    "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else "",
                                    "etag": obj.get("ETag", "").strip('"'),
                                    "pattern": pattern
                                }
                                
                                # Add the file if not already in results
                                if not any(f["key"] == file_info["key"] for f in matching_files):
                                    matching_files.append(file_info)
                                    logger.info(f"[LIST-PROJECT] Found file: {file_info['key']}")
                
                except Exception as e:
                    logger.error(f"[LIST-PROJECT] Error listing objects with pattern {pattern}: {str(e)}")
            
            # Also search for files that contain the project ID anywhere in the key
            # This is a more comprehensive approach but might be slower
            try:
                # List all objects
                all_objects_iterator = paginator.paginate(
                    Bucket=self.bucket_name
                )
                
                # Look for project ID in any part of the key
                for page in all_objects_iterator:
                    if "Contents" in page:
                        for obj in page["Contents"]:
                            key = obj["Key"]
                            
                            # Check if this key contains any variant of the project ID
                            # but wasn't already found by the prefix searches
                            if (project_id in key or project_id_clean in key) and \
                               not any(f["key"] == key for f in matching_files):
                                
                                file_info = {
                                    "key": key,
                                    "size": obj.get("Size", 0),
                                    "last_modified": obj.get("LastModified", "").isoformat() if obj.get("LastModified") else "",
                                    "etag": obj.get("ETag", "").strip('"'),
                                    "pattern": "substring_match"
                                }
                                
                                matching_files.append(file_info)
                                logger.info(f"[LIST-PROJECT] Found file via substring match: {file_info['key']}")
            
            except Exception as e:
                logger.error(f"[LIST-PROJECT] Error during substring search: {str(e)}")
            
            # Log summary
            logger.info(f"[LIST-PROJECT] Found total of {len(matching_files)} files for project {project_id}")
            
            return matching_files
            
        except Exception as e:
            logger.error(f"[LIST-PROJECT] Error listing project files: {str(e)}")
            logger.error(traceback.format_exc())
            return []
            
    async def cleanup_project_storage(
        self, 
        project_id: str, 
        dry_run: bool = False,
        sequential: bool = False
    ) -> Dict[str, Any]:
        """
        Clean up all files associated with a project in R2 storage using S3 API.
        
        Args:
            project_id: The project ID to clean up files for
            dry_run: If True, only list what would be deleted without actually deleting
            sequential: If True, delete files sequentially instead of in parallel
            
        Returns:
            Dictionary with deletion results
        """
        logger.info(f"[CLEANUP] Starting storage cleanup for project: {project_id} (dry_run: {dry_run}, sequential: {sequential})")
        
        # Use S3 API for deletion
        try:
            # First list all files for this project
            files = await self.list_project_files(project_id)
            
            if not files:
                logger.info(f"[CLEANUP] No files found for project {project_id}")
                return {
                    "success": True,
                    "files_deleted": 0,
                    "message": "No files found"
                }
            
            logger.info(f"[CLEANUP] Found {len(files)} files to delete for project {project_id}")
            
            # If dry run, just return what would be deleted
            if dry_run:
                logger.info(f"[CLEANUP] DRY RUN - Would delete {len(files)} files")
                return {
                    "success": True,
                    "dry_run": True,
                    "files_to_delete": [f["key"] for f in files],
                    "file_count": len(files)
                }
            
            # Extract keys for deletion
            keys_to_delete = [f["key"] for f in files]
            
            # Process deletions
            if sequential:
                # Delete sequentially
                success_count = 0
                error_messages = []
                
                for key in keys_to_delete:
                    try:
                        # Remove await since boto3 is not async
                        self.s3.delete_object(
                            Bucket=self.bucket_name,
                            Key=key
                        )
                        logger.info(f"[CLEANUP] Deleted file: {key}")
                        success_count += 1
                    except Exception as e:
                        error_message = f"Error deleting {key}: {str(e)}"
                        logger.error(f"[CLEANUP] {error_message}")
                        error_messages.append(error_message)
                
                result = {
                    "success": len(error_messages) == 0,
                    "files_deleted": success_count,
                    "files_failed": len(keys_to_delete) - success_count,
                    "errors": error_messages
                }
            else:
                # Use batch delete for better performance
                try:
                    # Prepare objects for deletion
                    objects_to_delete = [{"Key": key} for key in keys_to_delete]
                    
                    # Execute batch delete - remove await since boto3 is not async
                    response = self.s3.delete_objects(
                        Bucket=self.bucket_name,
                        Delete={"Objects": objects_to_delete}
                    )
                    
                    # Parse response
                    deleted_count = len(response.get("Deleted", []))
                    errors = response.get("Errors", [])
                    
                    logger.info(f"[CLEANUP] Batch deletion results: {deleted_count} deleted, {len(errors)} errors")
                    
                    result = {
                        "success": len(errors) == 0,
                        "files_deleted": deleted_count,
                        "files_failed": len(errors),
                        "errors": [f"{e.get('Key', '')}: {e.get('Message', '')}" for e in errors]
                    }
                except Exception as e:
                    logger.error(f"[CLEANUP] Error during batch deletion: {str(e)}")
                    result = {
                        "success": False,
                        "error": str(e),
                        "files_deleted": 0,
                        "files_failed": len(keys_to_delete)
                    }
            
            logger.info(f"[CLEANUP] S3 API cleanup completed for {project_id}: {result}")
            return result
            
        except Exception as e:
            logger.error(f"[CLEANUP] Error during S3 API cleanup: {str(e)}")
            return {
                "error": str(e),
                "success": False
            }

    async def cleanup_project_storage_via_worker(self, project_id: str) -> Dict[str, Any]:
        """
        Clean up all files associated with a project using the Cloudflare Worker.

        Args:
            project_id: The project ID to clean up storage for

        Returns:
            Dict containing deletion results
        """
        if not settings.use_worker_for_deletion:
            logger.info(f"Worker deletion disabled, using fallback method for project {project_id}")
            return {
                "success": False,
                "message": "Worker deletion disabled",
                "worker_enabled": False
            }
        
        logger.info(f"Cleaning up R2 storage for project {project_id} via Worker")
        
        try:
            # Get file paths from database tracking
            file_records = await r2_file_tracking.get_project_files(project_id)
            
            if not file_records:
                logger.warning(f"No tracked file records found for project {project_id}")
                # Signal caller to use alternate deletion method
                return {
                    "success": False,
                    "message": "No tracked file records found",
                    "fallback_to_pattern": True
                }
            
            # Extract object keys from records
            object_keys = [record.get("object_key") for record in file_records if record.get("object_key")]
            
            if not object_keys:
                logger.warning(f"No valid object keys found in tracked files for project {project_id}")
                return {
                    "success": False, 
                    "message": "No valid object keys found",
                    "errors": ["No valid object keys found"]
                }
            
            logger.info(f"Found {len(object_keys)} tracked files to delete for project {project_id}")
            
            # Use Worker to delete files
            worker_result = await worker_client.delete_r2_objects(object_keys)
            
            # Delete tracking records regardless of deletion success
            # This ensures we don't leave orphaned tracking records
            deleted_count = await r2_file_tracking.delete_project_files(project_id)
            logger.info(f"Deleted {deleted_count} tracking records for project {project_id}")
            
            # Add tracking record count to worker result
            worker_result["tracking_records_deleted"] = deleted_count
            
            return worker_result
            
        except Exception as e:
            logger.error(f"Error cleaning up storage via Worker for project {project_id}: {str(e)}")
            # Return error rather than falling back, let caller decide what to do
            return {
                "success": False,
                "error": str(e),
                "message": "Error in worker deletion"
            }


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
