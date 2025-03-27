# R2 Storage Structure Implementation Plan

## Overview
This document outlines the plan for implementing a structured hierarchical storage system in Cloudflare R2 for the Auto Shorts Web App. The goal is to organize files in a logical, consistent manner that facilitates easier management, cleanup, and multi-tenant support.

## Current Status

### Completed
- Added `get_file_path()` method to `R2Storage` class in `storage.py`
- Enhanced `upload_file()` method to support structured paths
- Added `upload_file_content()` method for direct content uploads
- Added `delete_project_files()` and `delete_scene_files()` methods
- Cleaned up temporary testing files

### Pending
- Create script to clear existing R2 bucket
- Modify `cleanup_project_storage` function in `projects.py`
- Create migration script for existing files
- Update frontend components to reference correct paths
- Test new structure with uploads and retrievals

## Directory Structure
All files in R2 storage will follow this hierarchical structure:
```
users/[user_id]/projects/[project_id]/scenes/[scene_id]/[file_type]/[filename]
```

Example paths:
```
users/user123/projects/proj456/scenes/scene789/audio/narration.mp3
users/user123/projects/proj456/scenes/scene789/image/background.jpg
users/user123/projects/proj456/output/final_video.mp4
```

## Benefits
- **User Isolation**: Clear separation of files by user for multi-tenant environment
- **Project Organization**: All project files grouped together
- **Clean Scene Separation**: Media for each scene kept separate
- **Media Type Classification**: Different types of media (audio, images, videos) organized in separate folders
- **Simplified Cleanup**: Easy deletion of all files related to a project or scene
- **Better Permissions Management**: Path structure allows for granular access control
- **Enhanced Organization**: Logical structure makes file management more intuitive

## Implementation Details

### 1. Storage Service Updates
The `R2Storage` class in `storage.py` has been updated with the following methods:

```python
def get_file_path(self, user_id: str, project_id: str, scene_id: str = None, 
                 file_type: str = None, filename: str = None) -> str:
    """
    Generate a consistent file path for storage using the standard structure.
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
    Upload a file to R2 storage with optional structured path.
    """
    # If we have user_id and project_id, use structured paths
    if user_id and project_id:
        filename = os.path.basename(file_path) if object_name is None else object_name
        object_name = self.get_file_path(user_id, project_id, scene_id, file_type, filename)
    elif object_name is None:
        # Fall back to simple object name if not using structured paths
        object_name = os.path.basename(file_path)
    
    # Rest of the upload logic...

async def delete_project_files(self, user_id: str, project_id: str) -> Dict[str, Any]:
    """
    Delete all files associated with a specific project.
    """
    prefix = self.get_file_path(user_id, project_id)
    result = await self.delete_directory(prefix)
    return result

async def delete_scene_files(self, user_id: str, project_id: str, scene_id: str) -> Dict[str, Any]:
    """
    Delete all files associated with a specific scene.
    """
    prefix = self.get_file_path(user_id, project_id, scene_id)
    result = await self.delete_directory(prefix)
    return result
```

### 2. Bucket Cleanup Script
Before implementing the new structure, we'll clean the existing R2 bucket:

```python
# clear_r2_bucket.py
import asyncio
import os
from app.services.storage import R2Storage

async def clear_all_r2_storage():
    print("Initializing R2 bucket clearing...")
    storage = R2Storage()
    
    # Delete everything with an empty prefix (root of bucket)
    result = await storage.delete_directory("")
    
    print(f"Deletion results:")
    print(f"  - Deleted: {result['deleted_count']} objects")
    print(f"  - Failed: {result['failed_count']} objects")
    print(f"  - Total bytes removed: {result['total_bytes']/1024/1024:.2f} MB")
    
    if result['failed_count'] > 0:
        print("Some deletions failed. See errors:")
        for error in result['errors'][:5]:  # Show first 5 errors
            print(f"  - {error}")

if __name__ == "__main__":
    asyncio.run(clear_all_r2_storage())
```

### 3. Project Cleanup Update
We need to modify the `cleanup_project_storage` function in `projects.py` to use the new structure:

```python
async def cleanup_project_storage(project_id: str, user_id: str = "default"):
    """
    Clean up all R2 storage for a deleted project.
    This runs as a background task after successful project deletion.
    
    Args:
        project_id: ID of the deleted project
        user_id: ID of the user who owns the project
    """
    logger.info(f"Starting R2 storage cleanup for deleted project: {project_id}")
    
    try:
        # Get storage service
        from app.services.storage import get_storage
        storage = get_storage()
        
        # Delete all project files using new method
        result = await storage.delete_project_files(user_id, project_id)
        
        if result["failed_count"] == 0:
            logger.info(f"Successfully cleaned up R2 storage for project {project_id}: Deleted {result['deleted_count']} files")
        else:
            logger.warning(f"Partial cleanup of R2 storage for project {project_id}: Deleted {result['deleted_count']} files, failed to delete {result['failed_count']} files")
            for error in result["errors"][:5]:  # Log first 5 errors
                logger.warning(f"Error during cleanup: {error}")
            
    except Exception as e:
        logger.error(f"Failed to clean up R2 storage for project {project_id}: {str(e)}")
        logger.exception("Full traceback:")
```

### 4. Migration Strategy
To migrate existing files to the new structure:

```python
# migrate_r2_structure.py
import asyncio
import os
from app.services.storage import R2Storage
from app.db.mongodb import get_database

async def migrate_r2_structure():
    print("Initializing R2 storage migration...")
    storage = R2Storage()
    db = await get_database()
    
    # Get all projects
    projects = await db.projects.find({}).to_list(length=None)
    
    for project in projects:
        project_id = str(project["_id"])
        user_id = project.get("user_id", "default")
        
        print(f"Migrating project {project_id} for user {user_id}...")
        
        # Get all scenes for this project
        scenes = await db.scenes.find({"project_id": project_id}).to_list(length=None)
        
        for scene in scenes:
            scene_id = str(scene["_id"])
            
            # Handle media files
            if scene.get("media") and scene["media"].get("storageKey"):
                old_key = scene["media"]["storageKey"]
                media_type = scene["media"].get("type", "image")
                filename = os.path.basename(old_key)
                
                # Create new key path
                new_key = storage.get_file_path(
                    user_id, 
                    project_id,
                    scene_id,
                    media_type,
                    filename
                )
                
                # Copy to new location
                await copy_r2_object(storage, old_key, new_key)
                
                # Update database
                await db.scenes.update_one(
                    {"_id": scene["_id"]},
                    {"$set": {"media.storageKey": new_key}}
                )
                
            # Handle audio files
            if scene.get("audio") and scene["audio"].get("storageKey"):
                old_key = scene["audio"]["storageKey"]
                filename = os.path.basename(old_key)
                
                # Create new key path
                new_key = storage.get_file_path(
                    user_id, 
                    project_id,
                    scene_id,
                    "audio",
                    filename
                )
                
                # Copy to new location
                await copy_r2_object(storage, old_key, new_key)
                
                # Update database
                await db.scenes.update_one(
                    {"_id": scene["_id"]},
                    {"$set": {"audio.storageKey": new_key}}
                )
    
    print("Migration completed!")

async def copy_r2_object(storage, old_key, new_key):
    """Copy an R2 object from old path to new path"""
    try:
        # Download to temp file
        temp_path = f"/tmp/{os.path.basename(old_key)}"
        success, _ = await storage.download_file(old_key, temp_path)
        
        if success:
            # Upload to new location
            success, url = await storage.upload_file(temp_path, new_key)
            
            if success:
                print(f"  Migrated {old_key} → {new_key}")
                # Delete old file
                await storage.delete_file(old_key)
                # Delete temp file
                os.remove(temp_path)
            else:
                print(f"  Failed to upload to new location: {new_key}")
        else:
            print(f"  Failed to download original file: {old_key}")
    except Exception as e:
        print(f"  Error migrating {old_key}: {str(e)}")

if __name__ == "__main__":
    asyncio.run(migrate_r2_structure())
```

## API Endpoints Update
We'll need to update all API endpoints that handle file uploads to use the new structured paths:

1. **Scene Media Upload Endpoint**: Use the new structure for uploaded media files
2. **Scene Audio Upload Endpoint**: Use the new structure for uploaded audio files
3. **Project Video Export Endpoint**: Store exported videos in the new structure

## Frontend URL Construction Update
Frontend components need to be updated to construct URLs for the new file paths:

```typescript
// Before:
const constructStorageUrl = (key: string) => {
  return `${API_BASE_URL}/storage/${encodeURIComponent(key)}`;
};

// After:
const constructStorageUrl = (key: string, userId: string, projectId: string, sceneId?: string) => {
  if (key.startsWith('users/')) {
    // Key already has the new structure
    return `${API_BASE_URL}/storage/${encodeURIComponent(key)}`;
  }
  
  // Construct new key structure
  const filename = key.split('/').pop() || key;
  const mediaType = determineMediaType(filename);
  const newKey = `users/${userId}/projects/${projectId}` + 
                 (sceneId ? `/scenes/${sceneId}/${mediaType}/${filename}` : `/output/${filename}`);
  
  return `${API_BASE_URL}/storage/${encodeURIComponent(newKey)}`;
};
```

## Testing Plan
1. **Clear Bucket**: Run the cleanup script to start with a clean slate
2. **Upload Testing**: Test uploading files with the new structure
   - Test media uploads for scenes
   - Test audio uploads for scenes
   - Test project output video storage
3. **Retrieval Testing**: Test retrieving files from the new structure
   - Test media retrieval for playback
   - Test audio retrieval for playback
4. **Cleanup Testing**: Test deletion functions
   - Test scene cleanup
   - Test project cleanup
5. **Migration Testing**: Test migration script with sample data

## Implementation Timeline
1. **Phase 1 (1-2 days)**: Clear bucket and update backend code
   - Implement bucket cleanup script
   - Update `cleanup_project_storage` function
   - Test basic functionality
2. **Phase 2 (2-3 days)**: Update API endpoints
   - Modify upload endpoints to use new structure
   - Test with sample uploads
3. **Phase 3 (1-2 days)**: Update frontend code
   - Update URL construction for the new structure
   - Test with sample projects
4. **Phase 4 (1-2 days)**: Create and run migration script
   - Test on staging environment first
   - Run on production after verification

## Implementation Challenges and Lessons Learned

### Failed Implementation Attempt
Our initial attempt to implement the hierarchical storage structure encountered several challenges that caused application breakage:

1. **Multiple Interconnected Components**: The media storage flow involves several interconnected components:
   - Frontend URL construction (`constructStorageUrl`)
   - Backend storage service (`storage.py`)
   - Media upload logic (`storeSceneMedia`, `storeMediaContent`)
   - Scene display components (`SceneMediaPlayer`)

2. **Import Structure Conflicts**: 
   - We created a new file `utils/scene.ts` that conflicted with the existing import from `utils/scene/scene-utils.ts`
   - Components importing from `@/utils/scene` expected functions like `getSceneContainerClassName` but our new file didn't provide them
   - This caused runtime errors: `TypeError: _utils_scene__WEBPACK_IMPORTED_MODULE_7__.getSceneContainerClassName is not a function`

3. **Changes Persisting After Git Revert**:
   - After the implementation failed, we tried reverting to a previous git commit
   - However, some files like `web/frontend/src/utils/scene.ts` were untracked, so they remained after the revert
   - This caused lingering issues even after returning to the previous code state

4. **Function Interface Mismatches**:
   - Some functions like `addScene` had their parameters changed, breaking existing code
   - Storage functions expected different parameters between frontend and backend

### Working Solution
The solution to make the R2 storage structure changes without breaking functionality:

1. **Maintain Import Compatibility**:
   ```typescript
   // In web/frontend/src/utils/scene.ts
   // Re-export all existing functions from the original file
   export * from './scene/scene-utils';
   
   // Then define new or modified functions
   export const constructStorageUrl = (/* modified parameters */) => {
     // Enhanced implementation
   };
   ```

2. **Backwards Compatibility for Paths**:
   - All path construction must handle both old and new formats
   - Detection logic to identify path format and process accordingly
   - Fallback to old format when information for new format is missing

3. **Extensive Logging**:
   - Add detailed logging at all key points in the storage flow
   - Log input parameters, constructed paths, and operation results

### Incremental Approach
Based on these lessons, we've developed an incremental approach:

1. Update one component at a time, starting with the backend storage service
2. Test thoroughly after each change
3. Maintain backward compatibility throughout
4. Add detailed logging to identify issues early

This approach will allow us to safely migrate to the new storage structure without breaking existing functionality.

## Conclusion
This structured approach to R2 storage will significantly improve organization, multi-tenant support, and cleanup processes for the Auto Shorts Web App.

## References
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [S3 SDK Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html) 