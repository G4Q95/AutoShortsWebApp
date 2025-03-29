# R2 Deletion Fix: Fixing Asynchronous Boto3 Client Usage

## Problem Summary

We identified a critical issue in the R2 file deletion process: files weren't being properly deleted when a project was removed. The root cause was improper usage of the boto3 S3 client in async code.

## Technical Details

The core issue was that our code was incorrectly using `await` with the boto3 S3 client methods, which are synchronous functions and not coroutines. This led to the error:

```
ERROR:app.services.storage:[DELETE-0fc2a5] Error deleting file from R2: object dict can't be used in 'await' expression
```

Specifically:

1. The `delete_file`, `check_files_exist`, and other methods in `R2Storage` class were calling the S3 client methods with `await`
2. The paginator in `list_directory` and `delete_directory` was being used with `async for` loops
3. The `get_s3_client` method was declared as async but was returning a synchronous boto3 client

## Changes Made

We fixed the issue by:

1. Removing `await` from all boto3 S3 client method calls:
   - `self.s3.delete_object()`
   - `self.s3.head_object()`
   - `self.s3.delete_objects()`
   - etc.

2. Changing `async for` loops to regular `for` loops when iterating over paginators

3. Making `get_s3_client` a regular method instead of an async one

4. Removing `await` from all calls to `get_s3_client()`

5. Updated project deletion to run the cleanup synchronously, ensuring files are deleted before the API call returns

## Files Modified

1. `web/backend/app/services/storage.py`
   - Fixed S3 client method calls
   - Changed `get_s3_client` to a regular method

2. `web/backend/app/api/projects.py`
   - Fixed S3 client usage in `cleanup_project_storage`
   - Changed paginator iteration from `async for` to regular `for`
   - Made `delete_project` run cleanup synchronously

## Testing

We verified the fix by:

1. Running a test endpoint that creates and deletes files
2. Checking the logs to confirm deletions are successful
3. Verifying file deletion in R2 storage

## Lessons Learned

1. Boto3's S3 client is synchronous, not asynchronous, and should not be used with `await`
2. When combining async frameworks (like FastAPI) with synchronous libraries (like boto3), make sure to use them correctly
3. Always check the logs for errors when operations silently fail
4. Consider running critical operations synchronously when their completion is essential

## Future Improvements

Consider one of these options for long-term improvement:

1. Use a fully async S3 client like aioboto3 if async operation is required
2. Run synchronous boto3 operations in a thread pool to avoid blocking the event loop
3. Continue using synchronous calls but ensure proper error handling and verification

## Final Resolution: Settings Attribute Typo

After extensive debugging and fixing issues related to `async`/`await` usage with the synchronous boto3 library and ensuring correct handling of return types from storage methods, the final blocking issue was identified on 2025-03-29.

The `cleanup_project_storage` function in `web/backend/app/services/project.py`, specifically within the pattern-based fallback logic, was referencing the R2 bucket name using the incorrect attribute `settings.r2_bucket_name` (lowercase `r`). The correct attribute defined in the configuration (`web/backend/app/core/config.py`) is `settings.R2_BUCKET_NAME` (uppercase `R`).

**File Modified:**
- `web/backend/app/services/project.py` (Line ~179)

**Change Made:**
- Corrected `Bucket=settings.r2_bucket_name` to `Bucket=settings.R2_BUCKET_NAME` within the `s3_client.delete_objects` call.

**Verification:**
- After applying this fix and restarting the backend, triggering the cleanup for a project with remaining R2 files (using the `debug/cleanup-project/` endpoint) resulted in the successful deletion of the files via the pattern-based strategy.
- A full end-to-end test (create project -> upload file -> delete project via UI) confirmed that files are now correctly deleted from R2 upon project deletion.

This typo was the root cause of the pattern-based deletion failing silently after the initial API/database deletion succeeded. 