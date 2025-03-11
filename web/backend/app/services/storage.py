import logging
import os
from typing import BinaryIO, Optional, Tuple

import boto3

from app.core.config import settings

logger = logging.getLogger(__name__)


class R2Storage:
    """
    Class for interacting with Cloudflare R2 Storage.
    Uses S3-compatible API.
    """

    def __init__(self):
        """Initialize the R2 client."""
        self.endpoint_url = f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
        self.bucket_name = settings.R2_BUCKET_NAME

        # Create session
        self.s3 = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        )

    async def upload_file(
        self, file_path: str, object_name: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Upload a file to R2 storage.

        Args:
            file_path: Path to the file to upload
            object_name: S3 object name (if not specified, file_path's basename is used)

        Returns:
            Tuple of (success, url or error message)
        """
        if not os.path.exists(file_path):
            return False, f"File {file_path} does not exist"

        if object_name is None:
            object_name = os.path.basename(file_path)

        try:
            self.s3.upload_file(file_path, self.bucket_name, object_name)
            url = f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
            return True, url
        except Exception as e:
            logger.error(f"Error uploading file to R2: {str(e)}")
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
        try:
            self.s3.download_file(self.bucket_name, object_name, file_path)
            return True, f"File downloaded to {file_path}"
        except Exception as e:
            logger.error(f"Error downloading file from R2: {str(e)}")
            return False, str(e)

    async def delete_file(self, object_name: str) -> Tuple[bool, str]:
        """
        Delete a file from R2 storage.

        Args:
            object_name: The S3 object name to delete

        Returns:
            Tuple of (success, message)
        """
        try:
            self.s3.delete_object(Bucket=self.bucket_name, Key=object_name)
            return True, f"Deleted {object_name}"
        except Exception as e:
            logger.error(f"Error deleting file from R2: {str(e)}")
            return False, str(e)

    async def get_file_url(self, object_name: str, expiration: int = 3600) -> Optional[str]:
        """
        Generate a presigned URL for an object.

        Args:
            object_name: The S3 object name
            expiration: URL expiration in seconds

        Returns:
            The presigned URL or None if error
        """
        try:
            url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": object_name},
                ExpiresIn=expiration,
            )
            return url
        except Exception as e:
            logger.error(f"Error generating presigned URL: {str(e)}")
            return None


# Create singleton instance
storage = R2Storage()
