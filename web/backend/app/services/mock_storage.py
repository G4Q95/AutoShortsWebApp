import logging
import os
import shutil
from typing import Optional, Tuple

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
            dest_path = os.path.join(self.storage_dir, object_name)
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
        """Mock URL generation that returns local file path."""
        try:
            file_path = os.path.join(self.storage_dir, object_name)
            if os.path.exists(file_path):
                return f"file://{file_path}"
            return None
        except Exception as e:
            logger.error(f"Error generating mock URL: {str(e)}")
            return None


# Create singleton instance
storage = MockStorage()
