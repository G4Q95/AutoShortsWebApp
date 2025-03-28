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

4. **R2 Directory Browser Integration**:
   - Consider implementing [r2-dir-list](https://github.com/cmj2002/r2-dir-list) for better bucket navigation
   - Would provide web-based directory-style browsing of R2 storage
   - Useful for debugging and content management
   - No impact on normal bucket operations
   - Could help identify file pattern issues more easily

## Latest Attempts (June 2024)

After several rounds of testing different approaches, we've documented our most recent attempts to resolve the R2 storage cleanup issues:

### Attempt 1: URL-Based 13-Character Matching

We observed that project URLs and R2 filenames shared a common pattern:
- Project URLs: `localhost:3000/projects/proj_m8s1kqpq`
- R2 filenames: `proj_m8s1kqpq_sdwytmk4ys49dk7vu3dul_media.mp4`

We implemented a solution that:
1. Extracted the unique 13-character identifier from the project ID (e.g., `m8s1kqpq`)
2. Searched for files containing this unique ID anywhere in their name
3. Added these matches to the files found by the standard prefix matching

Implementation:
```python
# Extract the unique identifier (without proj_ prefix)
project_id_clean = project_id_with_prefix.replace("proj_", "")
unique_id = project_id_clean[:13] if len(project_id_clean) >= 13 else project_id_clean

# Find objects containing our unique ID
unique_id_matches = []
for obj in all_objects:
    if unique_id in obj_key and not already_matched(obj_key):
        unique_id_matches.append(obj)
```

**Results**: Despite the visual match between URLs and filenames, this approach did not successfully identify and delete the expected files.

### Attempt 2: Aggressive Multi-Strategy Pattern Matching (June 2024)

After the 13-character matching approach failed, we implemented a much more aggressive pattern matching strategy that:

1. Created multiple variations of the project ID to handle different formats:
   - Original ID (as provided)
   - With "proj_" prefix
   - Without "proj_" prefix
   - Clean version (alphanumeric only, lowercase)

2. Used three different matching strategies:
   - Strategy 1: Direct prefix matching (standard format)
   - Strategy 2: Pattern variations based on common known formats (6 different patterns)
   - Strategy 3: Complete bucket scan with case-sensitive and case-insensitive matching

Implementation:
```python
# Create variations of the project ID
project_id_variations = {
    "original": project_id,
    "with_prefix": f"proj_{project_id}" if not project_id.startswith("proj_") else project_id,
    "clean": re.sub(r'[^a-zA-Z0-9]', '', project_id.replace("proj_", "")).lower()
}
if project_id.startswith("proj_"):
    project_id_variations["without_prefix"] = project_id.replace("proj_", "")

# Define common pattern variations
patterns = [
    f"proj_{project_id_variations['without_prefix']}",  # Standard pattern
    f"proj_proj_{project_id_variations['without_prefix']}",  # Double prefix
    f"{project_id_variations['without_prefix']}_",  # Direct ID with underscore
    f"projects/{project_id_variations['with_prefix']}/",  # Hierarchical paths
    f"audio/{project_id_variations['with_prefix']}/",
    f"media/{project_id_variations['with_prefix']}/"
]

# Complete scan with case-insensitive matching
for variant_name, variant_value in project_id_variations.items():
    if variant_value in obj_key:  # Case-sensitive
        # Match found
    elif variant_value.lower() in obj_key.lower():  # Case-insensitive
        # Match found
```

**Results**: Despite the comprehensive approach testing multiple pattern variations, this aggressive matching strategy also failed to identify and delete the expected files.

### Attempt 3: Alternative S3/R2 Deletion Methods (June 2024)

After our custom pattern matching strategies failed, we investigated standard AWS S3 methods for deletion that work with Cloudflare R2, as R2 is compatible with the S3 API:

1. **Direct Object Deletion**:
   ```python
   response = await s3_client.delete_object(
       Bucket=bucket_name,
       Key=object_key
   )
   ```

2. **Batch Object Deletion**:
   ```python
   response = await s3_client.delete_objects(
       Bucket=bucket_name,
       Delete={
           "Objects": [{"Key": key1}, {"Key": key2}]
       }
   )
   ```

3. **Lifecycle Rules**: Configured with R2 dashboard.

4. **Tag-Based Deletion**: We explored adding metadata tags to files during upload:
   ```python
   # During upload:
   await s3_client.put_object(
       Bucket=bucket_name,
       Key=object_key,
       Body=file_content,
       Tagging=f"project_id={project_id}"
   )
   
   # During deletion:
   response = await s3_client.list_objects_v2(
       Bucket=bucket_name,
       # List objects with specific tags
   )
   ```

We also researched standard methods for R2 deletion:

1. **Using the Cloudflare Dashboard**: Manual deletion through the web interface
2. **Using r2.delete function**: For code-based deletion
3. **Using AWS CLI**: Configured with R2 credentials
4. **Using Wrangler**: Cloudflare's command-line tool
5. **Using Object Lifecycles**: For automatic deletion

**Results**: Our implementation is already using the S3-compatible API methods (specifically `delete_objects` for batch deletion). The tagging-based approach may warrant further investigation as it doesn't rely on filename patterns.

### Attempt 4: Wrangler-Based Direct Deletion (June 2024)

After multiple attempts with the S3-compatible API, we've decided to try using Cloudflare's official CLI tool, Wrangler, which provides direct access to R2 storage. Wrangler is purpose-built for Cloudflare and should avoid the compatibility issues we've encountered with the S3 API.

### Background

Wrangler is Cloudflare's official command-line tool for managing Cloudflare Workers and R2 storage. It provides direct commands for working with R2 buckets, making it a more reliable option than going through the S3-compatible API.

Key advantages of using Wrangler:
- Direct integration with Cloudflare's APIs
- Purpose-built commands for R2 management
- Avoids compatibility issues with the S3 API
- Better error reporting and debugging

### Implementation

We've created a Python wrapper around the Wrangler CLI commands to enable seamless integration with our backend. This implementation includes:

1. A `WranglerR2Client` class that interfaces with the Wrangler CLI
2. Support for listing, searching, and deleting R2 objects
3. Enhanced logging for all operations
4. Retry mechanisms for failed operations
5. Integration with our existing project cleanup flow

#### Key Components

**WranglerR2Client Class:**
The core component of our implementation is the `WranglerR2Client` class, which provides a Python interface to the Wrangler CLI. This class includes methods for listing objects, finding objects containing specific strings, and deleting objects.

```python
class WranglerR2Client:
    def __init__(self, bucket_name: str, retry_attempts: int = 3):
        self.bucket_name = bucket_name
        self.retry_attempts = retry_attempts
        
    def list_objects(self, prefix: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        # List objects in the bucket with optional prefix and limit
        
    def find_objects_containing(self, substring: str, case_sensitive: bool = True) -> List[Dict[str, Any]]:
        # Find all objects containing a specific substring in their key
        
    def delete_object(self, object_key: str) -> bool:
        # Delete a single object from the bucket
        
    def batch_delete_objects(self, object_keys: List[str]) -> Tuple[int, int, List[str]]:
        # Delete multiple objects in sequence
        
    def delete_objects_by_project_id(self, project_id: str, dry_run: bool = False) -> Dict[str, Any]:
        # Delete all objects associated with a project ID
```

**Integration with Project Deletion:**
We've updated the `cleanup_project_storage` function to use the Wrangler client for finding and deleting files associated with a project:

```python
async def cleanup_project_storage(project_id: str, dry_run: bool = False) -> dict:
    # Ensure project ID has the correct format
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    # Initialize the Wrangler R2 client
    settings = get_settings()
    bucket_name = settings.r2_bucket_name
    wrangler_client = WranglerR2Client(bucket_name)
    
    # Use the Wrangler client to find and delete files
    results = wrangler_client.delete_objects_by_project_id(project_id, dry_run=dry_run)
    
    # Log summary
    if dry_run:
        logger.info(f"[CLEANUP] DRY RUN completed for {project_id}")
    else:
        logger.info(f"[CLEANUP] Completed for {project_id}: Deleted {results['total_deleted']} files")
    
    return results
```

**CLI Scripts for Testing and Debugging:**
We've also created several CLI scripts to facilitate testing and debugging:

1. `test_wrangler.py` - Verifies Wrangler installation and bucket access
2. `list_r2_objects.py` - Lists objects in the bucket with filtering options
3. `cleanup_project_files.py` - Command-line interface for project cleanup

### Advantages of This Approach

1. **Direct Access**: Using Wrangler provides direct access to Cloudflare's R2 API, avoiding any compatibility issues with the S3 API.
2. **Simplified Logic**: The implementation doesn't rely on complex pattern matching for finding files, instead using a more reliable search approach.
3. **Better Error Reporting**: Wrangler provides more detailed error messages, making it easier to diagnose issues.
4. **Thorough Deletion**: By searching for variations of the project ID, we can ensure that all associated files are deleted.
5. **Dry Run Support**: The implementation includes a dry run option for testing deletion without actually removing files.

### Potential Challenges

1. **Performance**: The current implementation deletes files one at a time, which could be slow for projects with many files.
2. **Dependency Management**: The solution requires Wrangler to be installed on the server, adding an external dependency.
3. **Authentication**: Wrangler needs to be properly authenticated with Cloudflare, which requires setup on the server.

### Testing Plan

We'll test this approach thoroughly across different types of projects:

1. **Verify Identification**: Ensure all files associated with a project are correctly identified
2. **Test Dry Run Mode**: Confirm the dry run mode correctly identifies files without deleting them
3. **Validate Deletion**: Verify that files are successfully deleted
4. **Testing with Edge Cases**:
   - Projects with unusual naming patterns
   - Projects with a large number of files
   - Projects with files that have been modified by other processes

### Next Steps

1. Complete the implementation of the Wrangler-based approach
2. Test thoroughly with both dry runs and actual deletions
3. Monitor performance and make optimizations if needed
4. Update documentation with findings and results

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

4. **R2 Directory Browser Integration**:
   - Consider implementing [r2-dir-list](https://github.com/cmj2002/r2-dir-list) for better bucket navigation
   - Would provide web-based directory-style browsing of R2 storage
   - Useful for debugging and content management
   - No impact on normal bucket operations
   - Could help identify file pattern issues more easily

### Helper Scripts

To make it easier to work with Wrangler and R2, we've created several helper scripts:

#### 1. `setup_wrangler.py`

This script guides you through the process of setting up Wrangler authentication and testing your R2 access.

```bash
# Run the setup script
cd web/backend/scripts
./setup_wrangler.py
```

The script will:
- Check if Wrangler is installed
- Verify Wrangler authentication status
- Guide you through the login process if needed
- Test access to your R2 buckets
- Help you set up the required environment variables

#### 2. `test_wrangler.py`

This script verifies that Wrangler is correctly configured to access your R2 bucket.

```bash
# Run the test script
cd web/backend/scripts
./test_wrangler.py
```

The script will:
- Check if Wrangler is installed
- Test listing objects in your R2 bucket
- Verify permissions for deletion operations

#### 3. `list_r2_objects.py`

This script lets you list and search for objects in your R2 bucket.

```bash
# List all objects in the bucket (up to 100)
cd web/backend/scripts
./list_r2_objects.py

# List objects with a specific prefix
./list_r2_objects.py --prefix proj_abc123

# Search for objects containing a string
./list_r2_objects.py --search "video"

# Case-insensitive search
./list_r2_objects.py --search "audio" --case-insensitive

# Limit the number of results
./list_r2_objects.py --limit 50
```

The script provides detailed information about the objects in your bucket, including:
- Object keys
- Sizes
- ETags
- Upload timestamps
- Summary statistics by prefix

#### 4. `cleanup_project_files.py`

This script provides a command-line interface for cleaning up files associated with a specific project.

```bash
# Clean up files for a project (dry run)
cd web/backend/scripts
./cleanup_project_files.py proj_abc123 --dry-run

# Perform actual deletion
./cleanup_project_files.py proj_abc123
```

The script will:
- Find all files associated with the specified project ID
- List files that would be deleted in dry run mode
- Delete files and report results in normal mode 

# Hybrid Approach Implementation Results (March 2025)

After implementing the Wrangler-based direct deletion, we've successfully tested the hybrid approach for R2 operations. Here are the key findings and implementation details:

## Hybrid Approach Implementation

The hybrid approach successfully combines:
1. **S3 API** - For comprehensive object listing and filtering
2. **Wrangler CLI** - For reliable object operations (upload/delete)

### Key Implementation Components

1. **WranglerR2Client Class**:
   - Successfully integrated with Wrangler CLI
   - Fixed `--remote` flag requirement for all operations
   - Corrected command syntax using `bucket-name/object-key` format
   - Added retry mechanisms for resilience
   - Implemented proper object existence checking

2. **S3 API Integration**:
   - Used for comprehensive object listing when available
   - Implemented pagination for handling large datasets
   - Added error handling for authentication issues

3. **Fallback Mechanism**:
   - System detects when S3 API fails (e.g., 401 Unauthorized)
   - Automatically falls back to Wrangler for basic operations
   - Logs appropriate warnings and continues operations

4. **Project ID Normalization**:
   - Handles various project ID formats:
     - With "proj_" prefix
     - Without prefix
     - Double-prefixed formats
   - Ensures all variations are properly cleaned up

## Testing Results

We've validated the hybrid approach with comprehensive tests:

1. **Object Listing**: S3 API successfully lists objects when authorized
2. **Object Upload**: Wrangler reliably uploads files with `--remote` flag
3. **Object Existence**: Wrangler correctly checks if objects exist
4. **Object Deletion**: Wrangler successfully deletes objects
5. **Project Cleanup**: Successfully identifies and cleans up project files

## Implementation Details

The hybrid approach is implemented in the following components:

1. **Scripts**:
   - `

# Critical R2 Findings - March 2025

After extensive testing, we've identified several key findings for working with Cloudflare R2 storage:

## The `--remote` Flag is Essential

The most important discovery is that **all Wrangler R2 commands must use the `--remote` flag** to access the actual cloud bucket. Without this flag, commands will only affect a local simulator of the bucket:

```bash
# This only affects the local simulator (NOT the actual cloud bucket):
wrangler r2 object delete autoshorts-media/test.txt

# This affects the actual cloud bucket:
wrangler r2 object delete autoshorts-media/test.txt --remote
```

This explains why our previous deletion attempts appeared to succeed but didn't actually remove files from R2.

## Direct Command Approach

Our updated implementation uses direct Wrangler commands for R2 operations. The correct syntax for key operations is:

1. **Delete Object**:
   ```bash
   wrangler r2 object delete bucket-name/object-key --remote
   ```

2. **Upload Object**:
   ```bash
   wrangler r2 object put bucket-name/object-key --file local-path --remote
   ```

3. **Get Object**:
   ```bash
   wrangler r2 object get bucket-name/object-key --remote
   ```

## Command Limitations

Some R2 operations are limited with the Wrangler CLI:

1. **No Native Object Listing**: Wrangler doesn't provide a direct command to list objects in a bucket. Our implementation uses alternatives:
   - Direct deletion of known objects
   - Pattern-based searching
   - Integrating with AWS S3 API for listing when possible

2. **No Advanced Filtering**: Unlike the S3 API, Wrangler doesn't support prefix filtering, pagination, or other advanced querying features.

## Debugging Tools

We've created several scripts to help diagnose and fix R2-related issues:

1. **Fast Deletion Script**: `web/backend/scripts/test_fast_deletion.py`
   - Deletes all files associated with a specific project ID
   - Uses pattern-based matching to find related files
   - Includes dry-run mode for testing

2. **File Checker Script**: `web/backend/scripts/check_exact_file.py`
   - Verifies if specific files exist in R2 storage
   - Useful for debugging deletion issues

3. **File Deletion Script**: `web/backend/scripts/delete_files.py`
   - Deletes specific files from R2 storage
   - Useful for manual cleanup

## Known Issues and Troubleshooting

### 1. Scene Cards Not Loading

Some users have reported issues with scene cards not loading properly in the video editor (appearing empty as in the screenshot). This appears to be a separate issue from R2 storage deletion, and may be related to:

- Media URLs not resolving correctly
- Frontend not receiving proper scene data
- Rendering issues in the scene components

Troubleshooting steps:
1. Check browser console for errors when scenes fail to load
2. Inspect network requests to see if media files are being fetched correctly
3. Check if scene data includes proper media paths

### 2. Cloudflare Dashboard Caching

The Cloudflare R2 dashboard may show cached or stale data. Files that appear in the dashboard might have already been deleted or might not reflect recent changes. Always refresh the dashboard before concluding that deletion failed.

### 3. Project Deletion Delay

When a project is deleted through the web interface, the backend initiates an asynchronous background task to clean up storage. This means there may be a delay between when a project is deleted in the UI and when its files are removed from R2 storage.

## Implementation Details

Our solution implements a fast, pattern-based deletion approach that:

1. Generates multiple file patterns based on the project ID
2. Uses direct wrangler commands with the `--remote` flag
3. Runs deletion operations in parallel without waiting for completion
4. Handles various naming patterns and edge cases

The implementation successfully addresses the most common deletion scenarios while improving performance by avoiding expensive list operations.