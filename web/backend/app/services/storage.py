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
            s3_client = await self.get_s3_client()
            
            # First, check if directory exists by listing objects
            list_response = await s3_client.list_objects_v2(
                Bucket=self.bucket_name,
                Prefix=prefix,
                MaxKeys=1
            )
            
            # If no contents found, try with delimiter to check if it's an empty folder
            if "Contents" not in list_response or len(list_response.get("Contents", [])) == 0:
                delimiter_response = await s3_client.list_objects_v2(
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
                    await s3_client.put_object(
                        Bucket=self.bucket_name,
                        Key=marker_key,
                        Body=b''
                    )
                    
                    await s3_client.delete_object(
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
            async for page in page_iterator:
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
            async for page in page_iterator:
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
                        delete_response = await s3_client.delete_objects(
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
        Upload file content directly to R2 storage.
        
        Args:
            file_content: Content bytes to upload
            object_name: S3 object name or filename
            user_id: Optional user ID for structured storage path (default: "default")
            project_id: Optional project ID for structured storage path
            scene_id: Optional scene ID for structured storage path
            file_type: Optional file type category for structured storage path
            
        Returns:
            Tuple of (success, url or error message)
        """
        # Log request info with clear separation
        logger.info("=" * 50)
        logger.info(f"UPLOAD REQUEST: object_name={object_name}, user_id={user_id}, project_id={project_id}, scene_id={scene_id}, file_type={file_type}")
        
        # Check if we have the parameters to use the new path structure
        using_new_structure = False
        original_object_name = object_name
        
        try:
            # If we have user_id and project_id, use structured paths
            if user_id and project_id:
                using_new_structure = True
                filename = object_name if '/' not in object_name else os.path.basename(object_name)
                
                # Generate structured path
                object_name = self.get_file_path(user_id, project_id, scene_id, file_type, filename)
                logger.info(f"UPLOAD PATH: Using new structure: {object_name}")
            
            # Handle backward compatibility with old path patterns
            elif object_name.startswith("projects/"):
                # This is an old format path (projects/{project_id}/scenes/{scene_id}/media/{filename})
                # We keep it as is for backward compatibility
                logger.info(f"UPLOAD PATH: Using legacy path format: {object_name}")
            
            elif object_name.startswith("scenes/"):
                # This is the original flat format (scenes/{scene_id}/media/{filename})
                # We keep it as is for backward compatibility
                logger.info(f"UPLOAD PATH: Using original flat path format: {object_name}")
            
            logger.info(f"UPLOAD PATH: Final object name: {object_name}")
            
            # Upload the file content directly
            self.s3.upload_fileobj(file_content, self.bucket_name, object_name)
            
            # NEW: Verify if the file exists in storage after upload
            try:
                head_response = self.s3.head_object(
                    Bucket=self.bucket_name,
                    Key=object_name
                )
                logger.info(f"UPLOAD VERIFICATION: File exists in R2. Size: {head_response.get('ContentLength', 'unknown')} bytes")
            except Exception as e:
                logger.warning(f"UPLOAD VERIFICATION: Could not verify file exists: {str(e)}")
                
            # Generate a URL for accessing the file
            url = self.s3.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': object_name},
                ExpiresIn=settings.R2_URL_EXPIRATION
            )
            
            logger.info(f"UPLOAD SUCCESS: {url}")
            logger.info("=" * 50)
            return True, url
        
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            error_msg = e.response.get('Error', {}).get('Message', str(e))
            logger.error(f"UPLOAD ERROR: R2 client error: {error_code} - {error_msg}")
            logger.error("=" * 50)
            return False, f"R2 error: {error_msg}"
            
        except Exception as e:
            logger.error(f"UPLOAD ERROR: General error: {str(e)}")
            logger.error(traceback.format_exc())
            logger.error("=" * 50)
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

    async def get_s3_client(self):
        """
        Get the boto3 S3 client for direct operations.
        
        Returns:
            The initialized S3 client
        """
        # Use the existing client from the instance
        return self.s3


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
