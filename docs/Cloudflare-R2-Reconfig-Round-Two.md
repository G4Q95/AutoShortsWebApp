# Cloudflare R2 Reconfig - Round Two

This document tracks our work on fixing Cloudflare R2 storage cleanup issues, specifically problems with project deletion not removing files from R2 storage.

## Initial Problem

Despite implementing the hierarchical path structure for media storage, deleted projects still left their associated files in Cloudflare R2 storage. The deletion process wasn't properly cleaning up files stored in R2.

## Path Structure Understanding

After investigation, we found several issues:

1. **Multiple Path Formats**: Files were being stored under various path structures:
   - `users/default/projects/proj_ID/scenes/SCENE_ID/TYPE/filename.ext` (new structure)
   - `projects/proj_ID/scenes/SCENE_ID/media/filename.ext` (old structure)
   - `audio/proj_ID/SCENE_ID/filename.ext` (content-type structure)
   - `proj_ID/...` (direct project structure)

2. **R2 Directory Limitations**: Cloudflare R2 doesn't have real "folders" - only objects with slashes in their keys. This makes "deleting a directory" more complex than it seems.

3. **Empty Directory Issue**: Empty "directories" in R2 don't actually exist but appear in the dashboard UI, causing confusion.

4. **Silent Failures**: When deletion failed, it often did so silently without clear error messages.

## R2 Storage Patterns Documentation

This section outlines the storage patterns used in the Auto Shorts Web App for Cloudflare R2 object storage.

### R2 Storage Pattern Evolution

#### Initial Implementation (January-February 2024)
- Files stored with pattern: `proj_proj_[projectId]_[sceneId]_media.mp4`
- Double "proj_" prefix caused by redundant prefixing in storage path generation
- Example: `proj_proj_m8rzcejd_8sw4kf9sgt61wshaam41gpj_media.mp4`
- No cleanup mechanism for old pattern files
- Primary issue: When project ID already contained the "proj_" prefix, it was added again

#### Current Implementation (March 2024)
- Files stored with pattern: `proj_[projectId]_[sceneId]_media.mp4`
- Single "proj_" prefix applied consistently
- Example: `proj_m8rzcejd_8sw4kf9sgt61wshaam41gpj_media.mp4`
- Cleanup function handles both patterns

### Directory-Style Access Patterns

For directory-style operations, the following patterns are supported:

#### Audio Files
- `audio/proj_[projectId]/[sceneId]/` - Current structure for audio content
- `audio/proj_[projectId]_[sceneId]/` - Alternative flat structure for audio

#### Video Files
- `video/proj_[projectId]/[sceneId]/` - Current structure for video content
- `video/proj_[projectId]_[sceneId]/` - Alternative flat structure for video

#### Media Files
- `media/proj_[projectId]/[sceneId]/` - Current structure for media content
- `media/proj_[projectId]_[sceneId]/` - Alternative flat structure for media

#### Thumbnails
- `thumbnails/proj_[projectId]/[sceneId]/` - Current structure for thumbnails
- `thumbnails/proj_[projectId]_[sceneId]/` - Alternative flat structure for thumbnails

### Cleanup Implementation Attempts

#### Initial Pattern-Based Approach (Unsuccessful)
Our first cleanup implementation attempted to use multiple pattern prefixes to handle all historical variations:

1. Standard prefixed patterns (`proj_[projectId]_...`)
2. Double-prefixed patterns (`proj_proj_[cleanProjectId]_...`)
3. Direct project ID patterns (`[projectId]_...`)
4. Various directory-style patterns with combinations of the above

However, this pattern-based deletion approach had several limitations:
- Prefix matching in S3/R2 is sensitive to exact string matching
- Some files remained in storage after deletion operations
- Complex edge cases (case sensitivity, special characters) made pattern matching unreliable

#### Direct File Listing Approach (Current Implementation)
The current implementation uses a more direct approach:

1. **Listing Phase**: First list all objects in the bucket
2. **Filtering Phase**: Filter objects that contain the project ID (regardless of prefixes)
3. **Deletion Phase**: Directly delete the specific files that match

This approach has several advantages:
- More reliable than prefix matching alone
- Catches edge cases even with unusual naming patterns
- Provides visibility into exactly which files will be deleted
- Supports a "dry run" mode to preview deletion without executing it

### Best Practices

1. Always use the current implementation pattern for new files
2. Use the standardized cleanup function for all deletions
3. Be aware of the historical patterns when debugging storage issues
4. When updating storage patterns, ensure the cleanup code is updated to handle both old and new patterns
5. Consider implementing lifecycle rules in R2 to automatically delete files older than a specified period 

## Fix Attempts

We've tried several approaches to fix the deletion issues:

1. **Enhanced Logging**: Added detailed logging to the upload and path generation processes to better understand how files were being stored.

2. **Updated `cleanup_project_storage`**: Modified this function to check multiple path formats when deleting project files, including:
   - `users/default/projects/proj_ID/`
   - `projects/proj_ID/`
   - `proj_ID/`
   - `audio/proj_ID/`, `video/proj_ID/`, `media/proj_ID/`, etc.

3. **Improved `delete_directory` Method**: Enhanced this method to:
   - Better handle empty directories
   - Check if directories exist before attempting deletion
   - Report comprehensive metrics on deletion results
   - Handle error cases gracefully

4. **Diagnostic Scripts**: Created several scripts to:
   - List all objects in a project (`list_project_files.py`)
   - Delete everything in the bucket (`cleanup_r2.py`)
   - List all objects with comprehensive details (`list_all_objects.py`)

5. **Complete Bucket Cleanup**: Successfully deleted all files in the bucket using our `cleanup_r2.py` script.

6. **Verified Deletion Works**: Confirmed that direct deletion using our script works, proving the issue isn't with R2 credentials or access.

7. **URL-Based Pattern Matching** (May 2024): Attempted to match the last 13 characters of project URLs with the first 13 characters of R2 filenames:
   - Project URLs: `https://autoshorts.app/projects/proj_m8rye3o8`
   - R2 filenames: `proj_m8rye3o8_scene123_media_file.mp4`
   - This approach showed promise but was complicated by inconsistent URL vs. filename formats

8. **Complete Bucket Clearing** (May 2024): Created a specialized script `clear_entire_bucket.py` that:
   - Lists all objects in the bucket with detailed reporting
   - Supports a dry-run mode to see what would be deleted
   - Groups files by prefix for better analysis
   - Successfully deleted all objects, proving permissions work correctly

## Key Learnings

1. **Path Complexity Causes Problems**: The multiple nested path structures make deletion complex and error-prone.

2. **No Real Directories**: R2 doesn't have directories - just keys with slashes, requiring special handling.

3. **Silent Failures**: Many R2 operations fail silently, requiring extensive logging and verification.

4. **Dashboard vs. Reality**: What appears in the Cloudflare dashboard doesn't always match what's in storage.

5. **Double Prefix Issue**: We discovered files were being stored with `proj_proj_{project_id}_` instead of just `proj_{project_id}_` because the project ID was already prefixed with "proj_" when passed to the path generation function.

## Cloudflare R2 Deletion Fix - Testing Instructions

We've implemented several fixes to address the issue where files stored in Cloudflare R2 are not properly deleted when a project is deleted from the web app.

### Key Changes Made

1. **Fixed Double Prefix Issue**:
   - Modified `get_file_path` to check if the project ID already starts with "proj_" to avoid adding it twice
   - Added comprehensive logging to track path construction

2. **Enhanced Deletion Pattern Matching**:
   - Updated `cleanup_project_storage` to handle both prefix formats:
     - Standard format: `proj_{project_id}_`
     - Double prefix format: `proj_proj_{clean_project_id}_`
   - Added support for multiple path variations

3. **Improved Deletion Logging**:
   - Enhanced `delete_directory` to provide detailed logs of:
     - Exact files found matching each prefix
     - Step-by-step deletion process
     - Clear success/failure reporting

4. **Added Diagnostic Tool**:
   - Created a script to easily check relevant logs: `scripts/check_deletion_logs.sh`

### Testing Instructions

#### 1. Create a New Project

1. Go to http://localhost:3000/
2. Create a new project
3. Save it to get a project ID (will be visible in the URL)
4. Note the project ID for later use

#### 2. Add Content to the Project

1. Add at least one scene with media (image or video)
2. Add audio to the scene if possible
3. Save the project

#### 3. Verify File Storage Format

1. Go to the Cloudflare R2 dashboard
2. Look for files with your project ID in the name
3. Note their exact format (particularly if they have `proj_proj_` or just `proj_` prefix)
4. Take note of some specific filenames for later verification

#### 4. Delete the Project

1. Return to the project list
2. Delete the project you just created
3. Confirm deletion in the UI

#### 5. Check Logs for Deletion Process

Run our diagnostic script with your project ID:

```bash
./scripts/check_deletion_logs.sh <your_project_id>
```

Examine the logs to see:
- What patterns were searched
- Which files were found
- Whether deletion was successful

#### 6. Verify Deletion in Cloudflare

1. Refresh the Cloudflare R2 dashboard
2. Verify that all files related to your project have been deleted
3. Check if any files with your project ID still remain

#### 7. Document Your Findings

Please document:
- Project ID used
- File format observed before deletion
- Results from log analysis
- Whether files were successfully deleted
- Any remaining issues observed

### Troubleshooting

If deletion still fails:

1. Check the log output for errors
2. Verify that the correct prefix patterns are being checked
3. Note any unexpected file naming patterns
4. Check if the `cleanup_project_storage` function is being called at all

### Reporting Results

Please share your test results, particularly:
1. Whether files were successfully deleted
2. Any error messages from the logs
3. Exact file patterns observed in R2
4. Suggestions for further improvements

## Current Focus

Our current focus is on addressing two key issues:

1. **Robust Deletion**: Implementing a more robust deletion process that can clean up all files associated with a project.
2. **Simplified Storage Structure**: Moving to a simplified flat storage structure to eliminate the issues with nested folders.

### Progress Update (May 14)

After implementing the simplified storage structure in `get_file_path`, we discovered that files were still being stored with the old nested path structure. Investigation revealed:

1. **Key Finding**: Found **multiple places** where code was **bypassing** our improved `get_file_path` function by directly hardcoding storage paths:

   * In `media_service.py`:
     ```python
     # This was hardcoding the old nested path structure
     storage_key = f"projects/{project_id}/scenes/{scene_id}/media/{filename}"
     ```

   * In `voice.py`:
     ```python
     # Another hardcoded path for audio files
     storage_key = f"audio/{request.project_id}/{request.scene_id}/{filename_timestamp}_{request.voice_id}.mp3"
     ```

2. **Fixes Applied**: 

   * Modified `store_media_content` to use the storage service's path generation:
     ```python
     # Now using the proper parameters to leverage our improved get_file_path
     success, url = await storage.upload_file(
         file_path=temp_path, 
         object_name=filename,
         user_id=user_id, 
         project_id=project_id, 
         scene_id=scene_id, 
         file_type=file_type
     )
     ```

   * Similarly updated the voice API's audio storage method:
     ```python
     success, url = await storage.upload_file(
         file_path=temp_path,
         object_name=filename,
         user_id=user_id,
         project_id=request.project_id,
         scene_id=request.scene_id,
         file_type="audio"
     )
     ```

3. **Expected Result**: All new uploads should now use the simplified flat structure with format:
   ```
   proj_{project_id}_{scene_id}_{file_type}_{filename}.ext
   ```
   
   For example:
   ```
   proj_m8rye3o8_scene123_media_20240514123456.jpg  # For media files
   proj_m8rye3o8_scene123_audio_20240514123456_adam.mp3  # For audio files
   ```

### Latest Progress Update (May 28)

Our ongoing testing revealed additional issues with file deletions related to naming patterns:

1. **Double Prefix Issue**: Files are being saved with `proj_proj_` prefix instead of just `proj_`. This occurs because:
   - The project ID already includes "proj_" when passed to path functions
   - The path generation function adds another "proj_" prefix
   - Result: Files with names like `proj_proj_m8rzzykl_y447co02zek7dghhjrqdr4_media.mp4`

2. **Mixed Path Structure**: Current R2 bucket contains files with multiple patterns:
   - `proj_{project_id}_{scene_id}_media_{filename}.ext` (intended format)
   - `proj_proj_{project_id}_{scene_id}_media_{filename}.ext` (double prefix)
   - `projects/proj_{project_id}/scenes/{scene_id}/media/{filename}.ext` (legacy hierarchical)

3. **Enhanced `cleanup_project_storage` Implementation**: We've updated the cleanup function to handle all known patterns:
   ```python
   patterns_to_check = [
       # Current flat pattern (introduced March 2024)
       f"proj_{project_id}_",  # This will match any scene or file starting with this pattern
       
       # Legacy flat pattern with double prefix (used in early 2024)
       f"proj_proj_{project_id}_",
       
       # Hierarchical folder pattern
       f"projects/proj_{project_id}/",
   ]
   ```

4. **Successful Bucket Cleanup**: We developed a robust script (`clear_entire_bucket.py`) that successfully:
   - Lists all objects in the bucket with detailed reporting
   - Provides insights into file naming patterns through prefix grouping
   - Safely deletes objects in batches with proper error handling
   - Verifies the bucket is empty after deletion

### Testing Plan
1. Create a new project and save it.
2. Add media to a scene (image or video).
3. Add voice audio to the scene.
4. Check Cloudflare R2 storage to verify:
   - Media is saved using the new flat structure: `proj_{project_id}_{scene_id}_media_{filename}.ext`
   - Audio is saved using the new flat structure: `proj_{project_id}_{scene_id}_audio_{filename}.mp3`
5. Delete the project from the web app.
6. Verify all files with the prefix `proj_{project_id}_` are properly removed from R2.

### Current Status

We've identified and fixed the following issues:

1. **Root Cause Found**: Files were still using nested paths because direct path construction was happening in multiple services instead of using our centralized `get_file_path` function:
   - `media_service.py` - Hardcoded media path: `projects/{project_id}/scenes/{scene_id}/media/{filename}`
   - `voice.py` - Hardcoded audio path: `audio/{project_id}/{scene_id}/{timestamp}_{voice_id}.mp3`

2. **Fixes Implemented**: 
   - Modified all upload functions to pass proper parameters to the storage service
   - Ensured the `get_file_path` method generates simplified flat paths for new uploads
   - Updated the `cleanup_project_storage` function to check for multiple file patterns including the double-prefixed format

3. **Direct Deletion Approach**:
   - We've updated the project deletion process to use direct S3 API calls for more reliable deletion
   - Improved error handling and reporting during the deletion process
   - Added comprehensive logging to track what's happening during deletion

### Action Plan

1. **Fix Prefix Generation**:
   - Modify the `get_file_path` function to check if project_id already starts with "proj_" and avoid adding it twice
   - Ensure consistent prefix generation across all code paths

2. **Update Deletion Patterns**:
   - Enhance the `cleanup_project_storage` function to handle both formats:
     - `proj_{project_id}_` (intended format)
     - `proj_proj_{project_id}_` (current format with double prefix)
     - Project hierarchical path formats

3. **Enhanced Deletion Logging**:
   - Add detailed logging to capture exactly what's happening during deletion
   - Log all R2 API calls with response status
   - Verify which patterns are being searched and what's being found

4. **Verify Deletion API Call**:
   - Confirm the frontend is correctly calling the deletion endpoint
   - Add logging to track deletion requests from the frontend

## Implementation Plans

1. **Immediate Fix**: Continue with the current path structures but ensure deletion works by checking all possible paths.

2. **Long-term Solution**: Transition to the simplified flat storage structure for all new uploads.

## Testing Process

To verify deletion is working:
1. Create a new project
2. Add scenes with media
3. Note the project ID
4. Delete the project from the UI
5. Check backend logs for deletion attempts
6. Verify in Cloudflare R2 that all associated files are removed

## Lessons Learned

1. **Consistent Path Generation**: Always use a centralized function for path generation, never hardcode paths.

2. **Simpler Structure Is Better**: Flat structures are easier to manage in object storage systems like R2.

3. **Plan for Multiple Patterns**: Cleanup functions should check multiple patterns to handle legacy files.

4. **Extensive Logging Is Essential**: Having detailed logs about what's being stored where and what's being deleted is critical.

5. **Verify Deletions**: Always verify that deletion operations succeed and handle errors appropriately.

6. **Never Trust Silent Failures**: R2 operations can fail silently; always verify results.

## Future Improvements

1. **Storage Pattern Standardization**:
   - Ensure all code paths use the centralized path generation function
   - Move all legacy data to the new flat structure

2. **Lifecycle Rules**:
   - Implement R2 lifecycle rules to automatically delete objects after a certain period
   - Particularly useful for temporary files and content from deleted projects

3. **Migration Script**:
   - Develop a script to migrate objects from old path structures to new ones
   - Eliminate duplicate patterns over time 