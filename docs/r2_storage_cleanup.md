# R2 Storage Cleanup Implementation Plan

This document outlines the detailed implementation plan for proper Cloudflare R2 storage cleanup in the Auto Shorts Web App.

## Current Issue

When users delete projects from the Auto Shorts Web App:
- Project records are removed from the database/localStorage
- Associated media files remain in R2 storage indefinitely
- This leads to:
  - Increased storage costs
  - High Class A operations costs
  - Accumulation of orphaned files with no associated projects

Analysis of the R2 bucket shows approximately 2,000+ objects despite having "No projects" in the application UI, confirming that project deletion is not cleaning up associated storage.

## Implementation Strategy

We're adopting a phased approach to minimize risk while addressing immediate storage concerns:

### Phase 1: Project Deletion Cleanup

Immediate implementation to prevent creation of new orphaned files:

1. **Enhance R2Storage Class**
   - Add a `list_directory` method to list all objects with a given prefix
   - Create a `delete_directory` method to delete all files with a given prefix
   - Implement batch deletion to minimize API calls and reduce Class A operations

2. **Integrate with Project Deletion Flow**
   - Modify the `delete_project` endpoint to call the cleanup function as a background task
   - Ensure cleanup occurs after successful database deletion
   - Provide detailed result logging

### Phase 2: Orphaned Files Cleanup (Post-Authentication)

Once authentication is implemented:

1. **Create Cleanup Utility**
   - Develop a CLI script to identify and remove orphaned R2 files
   - Compare active projects in database with R2 storage contents
   - Run as a maintenance task by administrators

2. **Build with Safety Features**
   - Implement dry-run mode to preview deletions
   - Include confirmation requirements
   - Add detailed reporting and logging

## Technical Implementation Details

### File Naming Patterns

During storage cleanup, we must account for different file pattern variations found in the R2 bucket:

1. **Standard Pattern** - `proj_[project_id]_media.mp4`
2. **Indexed Pattern** - `proj_[project_id]_[index]_media.mp4`
3. **Scene Pattern** - `proj_[project_id]_scene_[number].mp4`
4. **Scene ID Pattern** - `proj_[project_id]_[scene_id]_media.mp4` (where scene_id is a unique identifier)

The newest pattern we've added to the cleanup routine is the Scene ID Pattern, which follows the format:
```
proj_[project_id]_[scene_id]_media.mp4
```

For example: `proj_m8t162ri_fs5rs83yh1mvf49m6cqcw_media.mp4`

This pattern was missing from previous cleanup implementations, which is why some files remained in the bucket after project deletion.

### Enhanced Cleanup Method

Our updated approach uses both pattern matching and direct S3 API listing to ensure all files are found:

1. Generate pattern variations (with and without proj_ prefix)
2. Use wildcards to match scene ID patterns (`proj_[project_id]_*_media.mp4`)
3. Use S3 API to list all objects with the project ID prefix and include their exact keys
4. Delete all matching patterns, including those found through direct listing

### Phase 1: R2Storage Class Enhancements

```python
# Add to web/backend/app/services/storage.py

async def list_directory(self, prefix: str) -> List[str]:
    """
    List all objects with the given prefix.
    
    Args:
        prefix: Directory prefix to list
        
    Returns:
        List of object keys
    """
    keys = []
    paginator = self.s3.get_paginator('list_objects_v2')
    
    try:
        for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
            if 'Contents' in page:
                for obj in page['Contents']:
                    keys.append(obj['Key'])
                    
        logger.info(f"Found {len(keys)} objects with prefix {prefix}")
        return keys
    except Exception as e:
        logger.error(f"Error listing directory {prefix}: {str(e)}")
        return []

async def delete_directory(self, directory_prefix: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Delete all objects with the given prefix (directory).
    
    Args:
        directory_prefix: The directory prefix to delete
        
    Returns:
        Tuple of (success, statistics)
    """
    logger.info(f"Attempting to delete directory {directory_prefix} from R2")
    
    # First list all objects to delete
    object_keys = await self.list_directory(directory_prefix)
    
    if not object_keys:
        logger.info(f"No objects found with prefix {directory_prefix}")
        return True, {"deleted": 0, "failed": 0, "objects": []}
    
    # Delete objects in batches (1000 is S3 API limit)
    batch_size = 1000
    deleted_count = 0
    failed_count = 0
    failed_objects = []
    
    for i in range(0, len(object_keys), batch_size):
        batch = object_keys[i:i+batch_size]
        
        try:
            # Create delete request
            delete_dict = {
                'Objects': [{'Key': key} for key in batch],
                'Quiet': True
            }
            
            # Execute batch delete
            response = self.s3.delete_objects(
                Bucket=self.bucket_name,
                Delete=delete_dict
            )
            
            # Count successful deletions
            deleted_count += len(batch) - len(response.get('Errors', []))
            
            # Log any errors
            if 'Errors' in response and response['Errors']:
                for error in response['Errors']:
                    key = error.get('Key', 'unknown')
                    failed_objects.append(key)
                    failed_count += 1
                    logger.error(f"Failed to delete {key}: {error.get('Message', 'unknown error')}")
                    
        except Exception as e:
            logger.error(f"Error in batch delete: {str(e)}")
            failed_count += len(batch)
            failed_objects.extend(batch)
    
    result = {
        "deleted": deleted_count,
        "failed": failed_count,
        "failed_objects": failed_objects[:10],  # Limit to avoid huge logs
        "directory": directory_prefix,
        "total_objects": len(object_keys)
    }
    
    logger.info(f"Directory deletion results: {result}")
    return deleted_count > 0 and failed_count == 0, result
```

### Project Deletion Integration

```python
# Add to web/backend/app/api/projects.py

@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_project(project_id: str, background_tasks: BackgroundTasks):
    """
    Delete a project by ID and clean up associated R2 storage.
    Returns no content on success.
    """
    # ... existing validation code ...

    # Delete from database
    result = await db.client[db.db_name].projects.delete_one({"_id": obj_id})
    
    # Add R2 cleanup to background task after successful DB deletion
    if result.deleted_count > 0:
        background_tasks.add_task(cleanup_project_storage, project_id)
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)

async def cleanup_project_storage(project_id: str):
    """
    Clean up all R2 storage for a deleted project.
    This runs as a background task after successful project deletion.
    
    Args:
        project_id: ID of the deleted project
    """
    logger.info(f"Starting R2 storage cleanup for deleted project: {project_id}")
    
    try:
        # Get storage service
        from app.services.storage import get_storage
        storage = get_storage()
        
        # Directory prefix for project
        project_prefix = f"projects/{project_id}/"
        
        # Delete all project files
        success, result = await storage.delete_directory(project_prefix)
        
        if success:
            logger.info(f"Successfully cleaned up R2 storage for project {project_id}: Deleted {result['deleted']} files")
        else:
            logger.warning(f"Partial cleanup of R2 storage for project {project_id}: Deleted {result['deleted']} files, failed to delete {result['failed']} files")
            
    except Exception as e:
        logger.error(f"Failed to clean up R2 storage for project {project_id}: {str(e)}")
```

## Testing Strategy

### Unit Tests

1. **Test R2Storage Directory Methods**
   - Test `list_directory` with various prefixes
   - Test `delete_directory` with both empty and populated directories
   - Verify batch deletion with large file counts
   - Test error handling scenarios

2. **Test Project Deletion Integration**
   - Verify background task is triggered after database deletion
   - Test error handling during cleanup
   - Verify cleanup results are properly logged

3. **Test Pattern Matching**
   - Verify all file naming patterns are correctly detected
   - Test with scene ID patterns specifically
   - Confirm direct API listing finds files that pattern matching might miss

### Manual Testing

1. **Project Deletion Flow**
   - Create test project with various media files
   - Delete project and verify database record is removed
   - Verify R2 storage is cleaned up via directory listing
   - Check logs for proper cleanup confirmation

2. **Edge Cases**
   - Test project with no media (empty project)
   - Test with large number of files
   - Test with invalid project IDs
   - Test with simulated network failures

## Orphaned Files Cleanup Utility (Phase 2)

To be implemented after authentication:

```python
# Outline of web/backend/scripts/cleanup_orphaned_r2_files.py

async def get_active_project_ids() -> Set[str]:
    """Get set of all active project IDs from database."""
    # Query database for all project IDs
    # Return as set for efficient comparison

async def get_r2_project_ids() -> Dict[str, List[str]]:
    """Get mapping of project IDs to their R2 file paths."""
    # List all files in the projects directory
    # Extract project IDs and organize files

async def delete_orphaned_files(dry_run: bool = True) -> Dict:
    """
    Identify and delete orphaned files in R2.
    
    Args:
        dry_run: If True, only report files without deleting
        
    Returns:
        Results statistics
    """
    # Get active project IDs from database
    # Get project files from R2
    # Find orphaned projects (in R2 but not in database)
    # If dry_run, just report findings
    # Otherwise, delete orphaned project files

async def main():
    """Main execution function."""
    # Parse command line arguments
    # Run in dry-run mode first
    # If not dry run, ask for confirmation
    # Execute the actual deletion
    # Report results
```

## Implementation Roadmap

1. **Phase 1 Implementation (Immediate)**
   - Enhance R2Storage class with directory methods (1 day)
   - Integrate with project deletion flow (1 day)
   - Implement unit tests (1 day)
   - Manual testing and validation (1 day)

2. **Phase 2 Implementation (After Authentication)**
   - Design cleanup utility (2 days)
   - Implement database-R2 comparison logic (2 days)
   - Add safety features and reporting (1 day)
   - Testing and validation (2 days)

## Benefits

This implementation will:
1. Prevent further accumulation of orphaned files
2. Reduce storage costs 
3. Reduce Class A operations costs
4. Provide greater visibility into storage usage
5. Enable proper cleanup of previously orphaned files

## Security Considerations

- The orphaned files cleanup utility will require administrator privileges
- Dry-run mode will be mandatory before actual deletion to prevent accidental data loss
- Detailed logging will ensure full auditability of all deletion operations
- Background tasks ensure deletion occurs after confirming database operation success 

## Update History

- **2025-03-28**: Updated file pattern matching to include scene ID pattern (`proj_[project_id]_[scene_id]_media.mp4`). Added direct S3 API listing to find files that pattern matching might miss. 