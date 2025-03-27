# R2 Storage Operations Guide

This guide explains the Cloudflare R2 storage operations, costs, and cleanup procedures for the Auto Shorts Web App.

## Storage Structure

The application uses the following storage structure in R2:

```
bucket/
├── projects/
│   ├── {project_id}/
│   │   ├── audio/
│   │   ├── images/
│   │   ├── video/
│   │   └── thumbnails/
│   └── ...
├── temp/
└── uploads/
```

- `projects/` - Contains all project data organized by project ID
- `temp/` - Contains temporary files that should be automatically cleaned up
- `uploads/` - Contains uploaded files before they are processed

## R2 Operation Types and Costs

Cloudflare R2 has two types of operations with different pricing models:

### Class A Operations

Class A operations include `PUT`, `COPY`, `POST`, and `LIST` requests. These operations are more expensive:

- **PUT/COPY/POST**: Used when uploading or copying files to R2
- **LIST**: Used when listing objects in a directory

Every `delete_directory` operation includes one LIST request to get the objects to delete. This is a Class A operation.

### Class B Operations

Class B operations include `GET`, `SELECT`, and `HEAD` requests. These operations are less expensive:

- **GET**: Used when downloading files from R2
- **HEAD**: Used to get metadata about objects without downloading content

### Pricing (as of implementation date)

- First 1 million Class A operations per month: Free
- Additional Class A operations: $4.50 per million
- First 10 million Class B operations per month: Free
- Additional Class B operations: $0.36 per million

## Automatic Cleanup

The application now includes automatic cleanup of R2 storage when projects are deleted:

1. When a project is deleted, the database record is removed first
2. Then a background task runs to delete all associated files in R2 storage
3. All files with the prefix `projects/{project_id}/` are deleted

This automatic cleanup ensures that:
- Storage costs are minimized by removing unused files
- No orphaned files are left in storage when projects are deleted
- The number of objects in the bucket doesn't grow indefinitely

## Manual Cleanup Utility

A command-line utility is available for cleaning up orphaned files that may have been left behind before the automatic cleanup was implemented:

```bash
# Run in dry-run mode (doesn't delete anything, just shows what would be deleted)
python -m app.scripts.cleanup_r2_storage --prefix projects/ --dry-run

# Run with force flag to actually delete orphaned files
python -m app.scripts.cleanup_r2_storage --prefix projects/ --force
```

### How the Cleanup Utility Works

1. Connects to the MongoDB database to get all active project IDs
2. Lists all objects in R2 storage with the specified prefix
3. Identifies orphaned files (files belonging to projects that no longer exist)
4. In dry-run mode: Shows what would be deleted
5. In force mode: Deletes the orphaned files

### When to Run Manual Cleanup

- After implementing the automatic cleanup feature to clear existing orphaned files
- Periodically (e.g., monthly) to check for any orphaned files
- When storage costs seem higher than expected

## Optimizing R2 Operations

To minimize costs associated with R2 operations:

1. **Batch Operations**: The implementation uses batch deletion (up to 1000 objects per API call) to minimize the number of API calls
2. **Limit LIST Operations**: Only call list_directory when absolutely necessary
3. **Directory Structure**: Group files logically to make cleanup operations more efficient
4. **Background Processing**: Perform cleanup in background tasks to avoid impacting user experience

## Monitoring Storage Usage

You can monitor your R2 storage usage in the Cloudflare dashboard:

1. Log in to your Cloudflare account
2. Navigate to R2 section
3. Select your bucket
4. Check the "Usage" tab to see:
   - Total storage used
   - Number of objects
   - Operation counts by type (Class A vs Class B)

## Troubleshooting

### High Class A Operations

If you notice a high number of Class A operations:

1. Check if your application is making frequent LIST calls
2. Consider optimizing directory listing operations
3. Use the provided cleanup utility to reduce the number of objects

### Storage Not Decreasing After Deletions

If storage usage doesn't decrease after project deletion:

1. Check that the automatic cleanup is working (look for log messages)
2. Run the manual cleanup utility in dry-run mode to check for orphaned files
3. Verify that all file paths follow the expected structure pattern 