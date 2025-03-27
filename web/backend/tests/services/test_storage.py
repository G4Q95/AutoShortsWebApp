import os
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import boto3
from moto import mock_s3
import io

from app.services.storage import R2Storage, LocalStorage, get_storage
from app.config import get_settings

@pytest.mark.asyncio
async def test_r2_list_directory(s3_test_bucket):
    """Test listing objects with a prefix in R2 storage."""
    storage = s3_test_bucket
    bucket_name = storage.bucket_name
    
    # Create test objects
    storage.s3.put_object(Bucket=bucket_name, Key="test_dir/file1.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="test_dir/file2.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="test_dir/subdir/file3.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="other_dir/file4.txt", Body="test content")
    
    # Test list_directory
    success, objects = await storage.list_directory("test_dir/")
    
    # Verify
    assert success is True
    assert len(objects) == 3
    assert any(obj["Key"] == "test_dir/file1.txt" for obj in objects)
    assert any(obj["Key"] == "test_dir/file2.txt" for obj in objects)
    assert any(obj["Key"] == "test_dir/subdir/file3.txt" for obj in objects)
    assert not any(obj["Key"] == "other_dir/file4.txt" for obj in objects)

@pytest.mark.asyncio
async def test_r2_delete_directory(s3_test_bucket):
    """Test deleting objects with a prefix in R2 storage."""
    storage = s3_test_bucket
    bucket_name = storage.bucket_name
    
    # Create test objects
    storage.s3.put_object(Bucket=bucket_name, Key="test_delete/file1.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="test_delete/file2.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="test_delete/subdir/file3.txt", Body="test content")
    storage.s3.put_object(Bucket=bucket_name, Key="other_dir/file4.txt", Body="test content")
    
    # Test delete_directory
    success, result = await storage.delete_directory("test_delete/")
    
    # Verify deletion was successful
    assert success is True
    assert result["deleted"] == 3
    assert result["failed"] == 0
    
    # Verify objects were deleted
    success, objects = await storage.list_directory("test_delete/")
    assert success is True
    assert len(objects) == 0
    
    # Verify other objects remain
    success, objects = await storage.list_directory("other_dir/")
    assert success is True
    assert len(objects) == 1

@pytest.mark.asyncio
async def test_r2_delete_directory_empty(s3_test_bucket):
    """Test deleting an empty directory in R2 storage."""
    storage = s3_test_bucket
    
    # Test delete_directory on empty directory
    success, result = await storage.delete_directory("nonexistent/")
    
    # Verify
    assert success is True
    assert result["deleted"] == 0
    assert result["failed"] == 0

@pytest.mark.asyncio
async def test_r2_delete_directory_error(s3_test_bucket):
    """Test error handling when deleting objects in R2 storage."""
    storage = s3_test_bucket
    bucket_name = storage.bucket_name
    
    # Create test objects
    storage.s3.put_object(Bucket=bucket_name, Key="test_error/file1.txt", Body="test content")
    
    # Mock delete_objects to simulate an error
    with patch.object(storage.s3, 'delete_objects', side_effect=Exception("Test error")):
        success, result = await storage.delete_directory("test_error/")
        
        # Verify
        assert success is False
        assert "deleted" in result
        assert "failed" in result
        assert "error" in result
        assert result["deleted"] == 0
        assert result["failed"] > 0 