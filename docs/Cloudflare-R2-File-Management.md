# Cloudflare R2 File Management Guide

## Table of Contents
1. [Current Status](#current-status)
2. [File Naming Convention](#file-naming-convention)
3. [Key Findings](#key-findings)
4. [Implemented Solutions](#implemented-solutions)
5. [File Operations](#file-operations)
6. [Deletion Process](#deletion-process)
7. [Next Steps](#next-steps)
8. [Troubleshooting](#troubleshooting)

## Current Status

The Auto Shorts Web App uses Cloudflare R2 for storing media files, including videos, images, audio clips, and thumbnails. We have identified and addressed several issues related to file naming inconsistencies and deletion challenges.

**Main Accomplishments**:
- Created reliable scripts for cleaning up R2 storage
- Identified root cause of deletion problems (inconsistent file naming patterns)
- Implemented solution for better file management
- Created documentation and guidelines for R2 operations

**Current Challenges**:
- Historical files use multiple naming patterns
- Deletion process needs improvement for reliability
- Need better tracking of file paths during creation

## File Naming Convention

### Current Implementation (Simplified)

We're implementing a simplified file naming approach:
```
proj_{project_id}_{file_type}.{extension}
```

Examples:
- `proj_m8rzcejd_media.mp4` - Project media file
- `proj_m8rzcejd_audio.mp3` - Project audio file
- `proj_m8rzcejd_thumbnail.jpg` - Project thumbnail

### Historical Patterns

Previous implementations used various patterns:
1. **Double Prefix**: `proj_proj_{project_id}_{scene_id}_media.mp4`
2. **Hierarchical Paths**: `projects/proj_{project_id}/scenes/{scene_id}/media/{filename}.ext`
3. **Content-Type Structure**: `audio/proj_{project_id}/{scene_id}/{filename}.ext`

These inconsistent patterns made reliable deletion difficult.

## Key Findings

1. **The Missing Link**: We weren't tracking which files were being created in R2. If we control the naming during file writing, we should track these names for deletion.

2. **The `--remote` Flag**: Critical discovery - all Wrangler CLI commands must use the `--remote` flag to affect the actual cloud bucket:
   ```bash
   # This affects the actual cloud bucket:
   wrangler r2 object delete autoshorts-media/test_file.txt --remote
   ```

3. **No Real Directories**: R2 doesn't have directories - just keys with slashes, making "deleting a directory" more complex.

4. **Silent Failures**: Many R2 operations fail silently, requiring explicit verification.

## Implemented Solutions

### 1. Simplified File Naming

The root solution focuses on simplifying file naming by:
- Modifying `get_file_path` in `storage.py` to use consistent naming patterns
- Making file names predictable based on project ID
- Reducing reliance on scene IDs in file paths

### 2. Storage Service Improvements

Our storage service now:
- Uses a centralized path generation function
- Ensures consistent naming across all upload points
- Provides better error handling and reporting

### 3. Cleanup Scripts

We've created multiple scripts for R2 management:
- `clear_all_r2_files.py` - Delete all files in bucket
- `manual_deletion.sh` - Command-line tool for specific deletions

## File Operations

### Uploading Files

When uploading files to R2, we now use a consistent approach:

```python
# In storage.py
def get_file_path(project_id, file_type, filename=None):
    """Generate consistent file path for R2 storage."""
    # Ensure project_id has proj_ prefix only once
    if not project_id.startswith("proj_"):
        project_id = f"proj_{project_id}"
    
    if filename:
        return f"{project_id}_{file_type}_{filename}"
    else:
        return f"{project_id}_{file_type}"

# Usage in upload function
success, url = await storage.upload_file(
    file_path=temp_path,
    object_name=filename,
    project_id=project_id,
    file_type="media"
)
```

### File Path Tracking

**Critical Insight**: We should be tracking file paths at creation time for reliable deletion.

Proposed implementation:
```python
async def upload_file(self, file_path, object_name, project_id, file_type, **kwargs):
    """Upload file to R2 storage and track its path."""
    # Generate storage key
    storage_key = self.get_file_path(project_id, file_type, object_name)
    
    # Upload file
    success, url = await self._upload_to_r2(file_path, storage_key)
    
    if success:
        # Track file path in database or project metadata
        await self.add_file_to_project_record(project_id, storage_key)
        
    return success, url
```

## Deletion Process

### Current Process

When a project is deleted, we attempt to clean up associated R2 files:

1. User triggers project deletion in UI
2. Backend endpoint processes deletion request
3. Storage cleanup runs as background task
4. Cleanup attempts to find all files associated with project
5. Files are deleted using direct R2 API calls

### Improved Deletion Approach

Our new approach focuses on:

1. **Direct Pattern Matching**: Using the simplified naming scheme makes it easier to match files
2. **File Path Tracking**: Storing paths when files are created ensures we know what to delete
3. **Verification**: Checking that files were actually deleted
4. **Detailed Logging**: Recording each step of the deletion process

## Next Steps

1. **Implement File Path Tracking**:
   - Store R2 file paths in project metadata or a dedicated table
   - Update the project deletion process to use these exact paths

2. **Complete Simplified Naming**:
   - Ensure all new file uploads use the simplified scheme
   - Remove redundant scene IDs from paths where not needed

3. **Migration Strategy**:
   - Develop a plan for handling historical files 
   - Consider migration scripts for standardizing older files

4. **Enhanced Verification**:
   - Add explicit verification steps in the deletion process
   - Implement retry logic for failed deletions

## Troubleshooting

### Common Issues

1. **Files Not Deleting**:
   - Check if the correct file pattern is being used
   - Verify the `--remote` flag is included in Wrangler commands
   - Check authentication status with Cloudflare

2. **Can't Find Files**:
   - Use S3 API listing to see all objects in the bucket
   - Try case-insensitive searching if file names have mixed case
   - Check for special characters in file names

3. **Authentication Errors**:
   - Verify Cloudflare API token has correct permissions
   - Check that environment variables are properly set

4. **Wrangler Commands Failing**:
   - Ensure Wrangler is installed and in PATH
   - Verify proper command syntax
   - Check Wrangler authentication

### Debugging Tips

1. Use the dry-run option to see what would be deleted:
   ```bash
   python scripts/clear_all_r2_files.py --dry-run
   ```

2. List all objects in the bucket to verify content:
   ```bash
   wrangler r2 object list autoshorts-media --remote
   ```

3. Test deletion of a specific file:
   ```bash
   wrangler r2 object delete autoshorts-media/test_file.txt --remote
   ``` 