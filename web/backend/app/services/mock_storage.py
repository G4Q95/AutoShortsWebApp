import logging
import os
import shutil
from typing import Optional, Tuple, Any

logger = logging.getLogger(__name__)


class MockStorage:
    """
    Mock storage class that uses local filesystem instead of R2.
    Implements the same interface as R2Storage for testing.
    """

    def __init__(self):
        """Initialize the mock storage."""
        self.storage_dir = os.path.join(os.path.dirname(__file__), "../..", "temp_storage")
        os.makedirs(self.storage_dir, exist_ok=True)

    async def upload_file(
        self, file_path: str, object_name: Optional[str] = None
    ) -> Tuple[bool, str]:
        """Mock file upload that copies to local directory."""
        if not os.path.exists(file_path):
            return False, f"File {file_path} does not exist"

        if object_name is None:
            object_name = os.path.basename(file_path)

        try:
            # Create the full path for the destination file
            dest_path = os.path.join(self.storage_dir, object_name)
            
            # Create any necessary subdirectories
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)
            
            # Copy the file
            shutil.copy2(file_path, dest_path)
            return True, f"file://{dest_path}"
        except Exception as e:
            logger.error(f"Error in mock upload: {str(e)}")
            return False, str(e)

    async def download_file(self, object_name: str, file_path: str) -> Tuple[bool, str]:
        """Mock file download that copies from local directory."""
        try:
            source_path = os.path.join(self.storage_dir, object_name)
            shutil.copy2(source_path, file_path)
            return True, f"File downloaded to {file_path}"
        except Exception as e:
            logger.error(f"Error in mock download: {str(e)}")
            return False, str(e)

    async def delete_file(self, object_name: str) -> Tuple[bool, str]:
        """Mock file deletion from local directory."""
        try:
            file_path = os.path.join(self.storage_dir, object_name)
            if os.path.exists(file_path):
                os.remove(file_path)
                return True, f"Deleted {object_name}"
            return False, f"File {object_name} does not exist"
        except Exception as e:
            logger.error(f"Error in mock delete: {str(e)}")
            return False, str(e)

    async def get_file_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate a mock URL for an object.

        Args:
            object_name: The object name
            expiration: Ignored in mock implementation

        Returns:
            A file:// URL to the local file or None if error
        """
        logger.info(f"Generating mock URL for {object_name}")
        
        try:
            file_path = os.path.join(self.storage_dir, object_name)
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return None
                
            # Create a file:// URL
            return f"file://{file_path}"
        except Exception as e:
            logger.error(f"Error generating mock URL: {str(e)}")
            return None

    async def check_files_exist(self, prefix: str) -> Any:
        """
        Check if any files exist with the given prefix in the mock storage.
        
        Args:
            prefix: The prefix to check
            
        Returns:
            A mock response mimicking the S3 list_objects_v2 response
        """
        try:
            import glob
            from dataclasses import dataclass
            from datetime import datetime
            
            @dataclass
            class MockS3Object:
                key: str
                last_modified: datetime
                size: int
            
            # Get the full path in the local file system
            full_prefix = os.path.join(self.storage_dir, prefix)
            # Add wildcard to find all files with the prefix
            pattern = f"{full_prefix}*"
            
            logger.info(f"Checking for files with pattern: {pattern}")
            matching_files = glob.glob(pattern)
            logger.info(f"Found {len(matching_files)} files matching the pattern")
            
            # Create a list of mock S3 objects
            contents = []
            for file_path in matching_files:
                relative_path = os.path.relpath(file_path, self.storage_dir)
                stat = os.stat(file_path)
                contents.append(
                    MockS3Object(
                        key=relative_path,
                        last_modified=datetime.fromtimestamp(stat.st_mtime),
                        size=stat.st_size
                    )
                )
            
            # Create a mock response object
            class MockListResponse:
                def __init__(self, contents):
                    self.contents = contents
                    self.key_count = len(contents)
            
            return MockListResponse(contents)
        except Exception as e:
            logger.error(f"Error checking files with prefix {prefix}: {str(e)}")
            return None


# Create singleton instance
storage = MockStorage()
