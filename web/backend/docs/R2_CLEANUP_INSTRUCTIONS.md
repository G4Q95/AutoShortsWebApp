# R2 Bucket Cleanup Instructions

This document provides instructions for clearing all content from the Cloudflare R2 bucket to start fresh with the new directory structure.

## Prerequisites

1. Ensure you have the proper environment variables set up:
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`

2. Verify that the Python environment is activated and all dependencies are installed.

## Steps to Clear R2 Bucket

### 1. Run the Script in Dry Run Mode

First, run the script in dry run mode to see what will be deleted without actually removing anything:

```bash
cd web/backend
python clear_r2_bucket.py --dry-run
```

This will list all objects in the bucket, organized by directory, and show the total number of objects and their combined size.

### 2. Verify the Output

Review the output to ensure:
- The total number of objects matches your expectations
- The data organization makes sense
- You understand what will be deleted

### 3. Run the Script to Delete Objects

Once you've verified everything looks correct, run the script without the dry run flag to actually delete the objects:

```bash
cd web/backend
python clear_r2_bucket.py
```

The script will:
1. List all objects in the bucket
2. Delete each object
3. Log the progress
4. Display a summary of objects deleted and total bytes removed

### 4. Verify Successful Deletion

Run the script again in dry run mode to confirm the bucket is empty:

```bash
cd web/backend
python clear_r2_bucket.py --dry-run
```

The output should show 0 objects in the bucket.

## What Happens Next

After clearing the bucket, all future operations will use the new directory structure as defined in the `R2_STORAGE_STRUCTURE.md` documentation. The new structure will organize files by:

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

This structure will provide better organization, easier cleanup, and proper isolation between users.

## Troubleshooting

If you encounter any issues:

1. **Permission Errors**: Verify your R2 credentials are correct and have the necessary permissions.
2. **Connection Issues**: Check your internet connection and Cloudflare R2 service status.
3. **Large Bucket Warning**: If your bucket contains thousands of objects, the deletion process may take some time. Consider running the script in a session that won't be interrupted.

## Warning

**This operation is irreversible.** Once objects are deleted from the R2 bucket, they cannot be recovered unless you have backups. Always run with `--dry-run` first to verify what will be deleted. 