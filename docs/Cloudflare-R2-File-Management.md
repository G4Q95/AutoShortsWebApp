# Cloudflare R2 File Management

This document provides an overview of how files are managed in Cloudflare R2 storage within the Auto Shorts Web App.

## Background

Previously, the application experienced several issues with Cloudflare R2 storage:

1. **Inconsistent File Naming**: Files were stored with multiple formats:
   - `proj_proj_{project_id}_{scene_id}_media.mp4` (double prefix)
   - `projects/proj_{project_id}/scenes/{scene_id}/media/{filename}.ext` (hierarchical paths)
   - `audio/proj_{project_id}/{scene_id}/{filename}.ext` (content-specific paths)

2. **No Path Tracking**: We didn't track which files were created in R2, making it impossible to reliably delete them later.

This resulted in orphaned files when projects were deleted, consuming storage and causing potential data privacy issues.

## Solution

We've implemented a comprehensive R2 file path tracking system that:

1. **Stores File Paths During Upload**: When files are uploaded to R2, we record their exact paths in MongoDB
2. **Associates Paths with Projects**: Each file path is linked to a specific project ID
3. **Uses These Paths for Deletion**: When a project is deleted, we use the stored paths for reliable deletion
4. **Fallback Mechanism**: If no tracked paths exist, we use pattern-based discovery as a fallback

### Implementation Details

#### 1. Database Model

We created a new MongoDB collection called `r2_file_paths` with the following schema:

```
R2FilePath {
    id: ObjectId,                   // MongoDB ID
    project_id: string,             // Project ID this file belongs to
    object_key: string,             // Exact path in R2 storage
    scene_id: string (optional),    // Scene ID if applicable
    file_type: string (optional),   // File type (media, audio, etc.)
    user_id: string (optional),     // User ID if applicable
    size_bytes: number (optional),  // File size in bytes
    content_type: string (optional),// MIME type
    metadata: object (optional),    // Additional metadata
    created_at: datetime,           // Record creation time
    updated_at: datetime (optional) // Record update time
}
```

#### 2. File Path Tracking Service

We implemented a service (`r2_file_tracking.py`) that provides:

- **Creating file records**: When files are uploaded, their paths are stored
- **Retrieving project files**: Get all files associated with a project
- **Deleting project files**: Remove tracking records when projects are deleted

#### 3. Storage Service Integration

We modified the `upload_file` and `upload_file_content` methods in the storage service to:

- Use a consistent file naming strategy
- Track the file paths in MongoDB after successful upload
- Handle tracking failures gracefully without affecting the upload process

#### 4. Two-Phased Cleanup

When a project is deleted, the cleanup process now:

1. First tries to use tracked file paths from the database for exact deletion
2. Falls back to pattern-based discovery if no tracked paths exist or if an error occurs
3. Reports comprehensive statistics about the cleanup process

### Usage

#### Uploading Files

When uploading files to R2, the system automatically tracks the file paths:

```python
# Upload a file - path tracking is handled automatically
success, url = await storage.upload_file(
    file_path=temp_path,
    object_name=filename,
    user_id=user_id,
    project_id=project_id,
    scene_id=scene_id,
    file_type=file_type
)
```

#### Project Deletion

When a project is deleted through the API, the system:

1. Deletes the project from MongoDB
2. Retrieves tracked file paths for the project
3. Deletes the files from R2 storage
4. Removes the tracking records

```python
# Delete project endpoint
@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(project_id: str, background_tasks: BackgroundTasks):
    # Delete project from database
    # ...
    
    # Add R2 cleanup to background task
    background_tasks.add_task(cleanup_project_storage, storage_project_id)
    
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

## Debug Endpoints

For testing and verification, we've added debug endpoints:

### List Tracked File Paths

```
GET /api/v1/debug/r2-file-paths/{project_id}
```

Returns all tracked file paths for a specific project.

### Test Project Cleanup

```
POST /api/v1/debug/cleanup-project/{project_id}?dry_run=true&delete_records_only=false
```

Parameters:
- `dry_run`: If true, only show what would be deleted without actually deleting (default: true)
- `delete_records_only`: If true, only delete tracking records without touching R2 files (default: false)

This endpoint allows testing the cleanup process without affecting real data.

## Benefits

This implementation provides several benefits:

1. **Reliable Deletion**: Files are consistently deleted when projects are removed
2. **Reduced Storage Costs**: No more orphaned files consuming storage
3. **Enhanced Tracking**: Better visibility into storage usage
4. **Backward Compatibility**: Still works with existing files through pattern-based fallback
5. **Simplified Debugging**: Clear logs and debug endpoints for troubleshooting

## Future Improvements

Potential future enhancements:

1. **Migration Tool**: A tool to scan R2 storage and create tracking records for existing files
2. **Storage Analytics**: Enhanced reporting on storage usage by project/user
3. **File Deduplication**: Identify and remove duplicate files
4. **Lifecycle Rules**: Implement automatic cleanup of temporary files
5. **User Storage Quotas**: Track and enforce storage limits per user 