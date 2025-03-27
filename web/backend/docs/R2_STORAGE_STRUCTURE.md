# R2 Storage Structure Implementation Plan

## Overview

This document outlines the plan to restructure the Cloudflare R2 storage system for better organization, scalability, and management. The new structure implements a hierarchical folder system that isolates user data, organizes project assets, and separates media types.

## New Directory Structure

```
users/
  ├── {user_id}/
  │     ├── projects/
  │     │     ├── {project_id}/
  │     │     │     ├── scenes/
  │     │     │     │     ├── {scene_id}/
  │     │     │     │     │     ├── audio/
  │     │     │     │     │     │     ├── {audio_files.mp3}
  │     │     │     │     │     ├── media/
  │     │     │     │     │     │     ├── {image_files.jpg}
  │     │     │     │     │     │     ├── {video_files.mp4}
```

## Benefits of the New Structure

1. **User Isolation**: Each user's data is stored in a separate top-level directory, providing natural isolation.
2. **Clean Project Organization**: All files related to a project are grouped together.
3. **Permissions Management**: Easier to implement access control based on user ID.
4. **Simplified Cleanup**: Deleting a project or user data becomes trivial with prefix-based operations.
5. **Clear Media Separation**: Audio files are stored separately from visual media.
6. **Future Scalability**: Structure supports additional file types and categorization.

## Implementation Status

### Completed Tasks

1. ✅ Removed temporary debug files (`.env.r2fix`, `async_r2_list.py`, etc.)
2. ✅ Created a script (`clear_r2_bucket.py`) to clear the R2 bucket
3. ✅ Updated the `cleanup_project_storage` function to use the new path structure
4. ✅ Created a migration script (`migrate_r2_structure.py`) to move existing files
5. ✅ Added `get_object_info` method to the `R2Storage` class
6. ✅ Updated the frontend `constructStorageUrl` function to support the new structure

### Pending Tasks

1. ⬜ Update the `R2Storage` class in `storage.py` to implement the new structure:
   - Add `get_file_path` method
   - Update all upload methods to use the new path structure
   - Modify download methods to support the new structure
   - Implement user-specific directory operations

2. ⬜ Update media endpoints in API routes to handle the new path structure
   - Modify `/api/v1/media` endpoints to understand the new path or create a new endpoint

3. ⬜ Run the migration script to transfer existing files 

4. ⬜ Update frontend components that interact with media:
   - Scene viewer components
   - Media uploader components
   - Audio generation components

5. ⬜ Create and run tests to verify the new structure works correctly

## Implementation Details

### Backend Changes

#### 1. R2Storage Class Updates

The `R2Storage` class needs the following new methods:

```python
def get_file_path(self, user_id, project_id, scene_id, file_type, filename):
    """Generate a consistent file path for storage."""
    return f"users/{user_id}/projects/{project_id}/scenes/{scene_id}/{file_type}/{filename}"

async def upload_file(self, file_data, user_id, project_id, scene_id, file_type, filename):
    """Upload a file to the storage system using the structured path."""
    path = self.get_file_path(user_id, project_id, scene_id, file_type, filename)
    # Upload logic here
    
async def delete_project_files(self, user_id, project_id):
    """Delete all files related to a project."""
    prefix = f"users/{user_id}/projects/{project_id}/"
    return await self.delete_directory(prefix)
```

#### 2. API Endpoints Updates

The backend API needs a new endpoint structure:

```python
@router.get("/storage/{path:path}")
async def get_storage_object(path: str):
    """Get a file from storage using the full structured path."""
    # Logic to serve file
```

### Frontend Changes

#### 1. Storage URL Construction

The `constructStorageUrl` function has been updated to support both old and new URL structures:

```typescript
export const constructStorageUrl = (
  storageKey: string,
  projectId: string,
  sceneId: string,
  userId: string = "default",
  fileType?: string
): string => {
  if (!projectId || !sceneId || !storageKey) return '';
  
  // If the storage key already has the new structure (starts with "users/")
  if (storageKey.startsWith('users/')) {
    return `/api/v1/storage/${encodeURIComponent(storageKey)}`;
  }
  
  // If it's just a filename and we have file type, construct new path
  if (fileType && !storageKey.includes('/')) {
    const newPath = `users/${userId}/projects/${projectId}/scenes/${sceneId}/${fileType}/${storageKey}`;
    return `/api/v1/storage/${encodeURIComponent(newPath)}`;
  }
  
  // Otherwise, use the old path format
  return `/api/v1/media/${projectId}/${sceneId}/${storageKey}`;
};
```

#### 2. Media Upload Functions

The media upload functions need to be updated to provide file type information:

```typescript
export const uploadMedia = async (file: File, projectId: string, sceneId: string) => {
  // Determine file type (audio, image, video)
  const fileType = file.type.startsWith('audio') ? 'audio' : 'media';
  
  // Use the new path structure
  // Implementation details...
}
```

## Migration Process

The migration process will:

1. List all projects and their scenes from the MongoDB database
2. For each scene, identify media and audio files
3. For each file:
   - Determine the appropriate new path based on the file type
   - Copy the file to the new location
   - Update the database references
   - Delete the old file

The implementation is in the `migrate_r2_structure.py` script.

## Cleanup Process

The cleanup process will:

1. Clear the entire R2 bucket (optional, using `clear_r2_bucket.py`)
2. Start fresh with the new structure for all new uploads

## Next Steps

1. Complete the R2Storage class updates
2. Create the new storage endpoint
3. Run the migration script
4. Update frontend components
5. Test the system thoroughly

## Conclusion

This restructuring of the R2 storage system will provide better organization, scalability, and management capabilities. The hierarchical structure allows for clean separation of user data and provides a foundation for future features like user access control and selective sharing. 