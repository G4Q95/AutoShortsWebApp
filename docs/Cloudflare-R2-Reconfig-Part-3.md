# Cloudflare R2 Reconfig - Part 3

This document continues our work on fixing Cloudflare R2 storage cleanup issues, with a focus on synchronizing frontend project deletion with R2 file removal.

## Summary of Previous Findings (Part 2)

### Key Challenges Identified

1. **Inconsistent Storage Paths**: Files stored using multiple formats:
   - Hierarchical paths: `projects/proj_ID/scenes/SCENE_ID/media/filename.ext`
   - Flat paths with double prefixes: `proj_proj_{id}_{scene}_media.mp4`
   - Content-specific paths: `audio/proj_ID/SCENE_ID/filename.ext`

2. **Double Prefix Problem**: Files saved with `proj_proj_` prefix when project IDs already contained "proj_"

3. **R2 Directory Structure**: R2 doesn't use real folders, only keys with slashes

4. **Silent Failures**: Deletion operations failing without clear error messages

### Recent Breakthroughs

1. **The `--remote` Flag**: Critical discovery that all Wrangler CLI commands must use the `--remote` flag to affect the actual cloud bucket
   ```bash
   # This only affects the local simulator (NOT the actual cloud bucket):
   wrangler r2 object delete autoshorts-media/test.txt

   # This affects the actual cloud bucket:
   wrangler r2 object delete autoshorts-media/test.txt --remote
   ```

2. **Hybrid Approach**: Using S3 API for listing and filtering objects, combined with Wrangler CLI for reliable deletion

3. **Working Scripts**: Successfully created and tested scripts for manual R2 cleanup

### Current Status

Despite these advances, we're still encountering inconsistent results when deleting projects from the web application. Files are sometimes left behind in R2 even though deletion appears successful in the UI.

## Diagnostic Framework: Application vs Scripts

The core issue appears to be a discrepancy between manual script execution (which works) and application-triggered deletion (which sometimes fails). This suggests several potential problem areas:

### 1. Execution Context & Permissions

Manual scripts run in a different environment than the application, with potentially different:
- Authentication credentials
- Environment variables
- Path configurations
- Permission contexts

### 2. File Discovery Logic

The application's method for identifying files to delete might differ from our successful scripts:
- Pattern matching variations
- Pagination handling for large buckets
- Error handling differences

### 3. Deletion Process

How deletion commands are executed could vary:
- Parallel vs sequential execution
- Subprocess handling
- Error capturing and reporting

### 4. Application Flow & Background Tasks

The overall deletion flow might have weaknesses:
- Background task reliability
- Error propagation
- Completion verification

## Comprehensive Action Plan

We will implement a systematic approach to diagnose and resolve these issues:

### Phase 1: Execution Context Verification

1. **Authentication Verification**
   - Add a debug endpoint that runs `wrangler whoami` from the application context
   - Verify that Wrangler is correctly authenticated within the application
   ```python
   @router.get("/debug/wrangler-auth", response_model=Dict[str, Any])
   async def verify_wrangler_auth():
       """Verify Wrangler authentication status from application context."""
       result = subprocess.run(["wrangler", "whoami"], capture_output=True, text=True)
       return {
           "stdout": result.stdout,
           "stderr": result.stderr,
           "exit_code": result.returncode,
           "is_authenticated": "You are logged in" in result.stdout
       }
   ```

2. **R2 Access Check**
   - Add a debug endpoint to list R2 buckets
   - Confirm application can access R2 using the same credentials as scripts
   ```python
   @router.get("/debug/r2-access", response_model=Dict[str, Any])
   async def verify_r2_access():
       """Verify R2 bucket access from application context."""
       result = subprocess.run(["wrangler", "r2", "bucket", "list", "--remote"], 
                               capture_output=True, text=True)
       return {
           "stdout": result.stdout,
           "stderr": result.stderr,
           "exit_code": result.returncode,
           "buckets": [line.strip() for line in result.stdout.splitlines() if line.strip()]
       }
   ```

3. **Environment Variable Audit**
   - Add a debug endpoint to report relevant environment variables
   - Compare with script execution environment
   ```python
   @router.get("/debug/env-vars", response_model=Dict[str, str])
   async def get_r2_env_vars():
       """Return R2-related environment variables (redacted for security)."""
       env_vars = {
           "CLOUDFLARE_ACCOUNT_ID": "✓ Set" if os.environ.get("CLOUDFLARE_ACCOUNT_ID") else "❌ Not Set",
           "CLOUDFLARE_API_TOKEN": "✓ Set" if os.environ.get("CLOUDFLARE_API_TOKEN") else "❌ Not Set",
           "R2_BUCKET_NAME": os.environ.get("R2_BUCKET_NAME", "Not Set"),
           "WRANGLER_PATH": os.environ.get("PATH", "Not Set")
       }
       return env_vars
   ```

### Phase 2: Enhance Discovery & Deletion Logging

1. **Comprehensive Logging System**
   - Implement detailed logging at each step of the deletion process
   - Create a unique deletion ID for tracking each deletion operation
   ```python
   @router.delete("/projects/{project_id}", response_model=Dict[str, Any])
   async def delete_project(project_id: str):
       deletion_id = uuid.uuid4()
       logger.info(f"[{deletion_id}] Starting deletion for project {project_id}")
       
       # Project deletion logic...
       
       # Trigger storage cleanup with deletion ID for tracking
       background_tasks.add_task(cleanup_project_storage, project_id, deletion_id)
       
       logger.info(f"[{deletion_id}] Project deletion request completed, cleanup scheduled")
       return {"message": f"Project {project_id} deleted"}
   ```

2. **File Discovery Comparison**
   - Add a debug endpoint to list files that would be deleted
   - Compare with script results for the same project ID
   ```python
   @router.get("/debug/list-project-files/{project_id}", response_model=Dict[str, Any])
   async def list_project_files(project_id: str):
       """List all files associated with a project."""
       # Using application's normal discovery logic
       files = await discover_project_files(project_id)
       
       # Using script's discovery logic for comparison
       script_files = await script_discover_project_files(project_id)
       
       # Find differences
       only_in_app = [f for f in files if f not in script_files]
       only_in_script = [f for f in script_files if f not in files]
       
       return {
           "project_id": project_id,
           "files_found_by_app": files,
           "files_found_by_script": script_files,
           "differences": {
               "only_in_app": only_in_app,
               "only_in_script": only_in_script
           }
       }
   ```

3. **Command Execution Logging**
   - Log exact Wrangler commands being executed
   - Capture and log all subprocess output
   ```python
   def run_wrangler_command(command):
       logger.info(f"Executing Wrangler command: {' '.join(command)}")
       result = subprocess.run(command, capture_output=True, text=True)
       logger.info(f"Exit code: {result.returncode}")
       logger.info(f"Stdout: {result.stdout}")
       logger.info(f"Stderr: {result.stderr}")
       return result
   ```

### Phase 3: Testing Sequential vs Parallel Deletion

1. **Sequential Deletion Mode**
   - Implement a flag to switch between sequential and parallel deletion
   - Test if reliability improves with sequential execution
   ```python
   async def cleanup_project_storage(project_id: str, deletion_id: str, use_sequential: bool = False):
       """Clean up all files associated with a project."""
       logger.info(f"[{deletion_id}] Starting storage cleanup for {project_id}")
       
       # Discover files...
       
       if use_sequential:
           # Sequential deletion
           results = []
           for file_key in files_to_delete:
               result = await delete_single_object(bucket_name, file_key)
               results.append(result)
               logger.info(f"[{deletion_id}] Deleted {file_key}: {result}")
       else:
           # Parallel deletion
           tasks = [delete_single_object(bucket_name, file_key) for file_key in files_to_delete]
           results = await asyncio.gather(*tasks)
           
       logger.info(f"[{deletion_id}] Completed storage cleanup: {sum(results)} files deleted")
   ```

2. **S3 API Batch Delete Fallback**
   - Implement an alternative deletion mode using S3 API's batch delete
   - Test if this provides more reliable results
   ```python
   async def s3_batch_delete(bucket_name: str, keys: List[str], deletion_id: str):
       """Delete multiple objects using S3 API batch delete."""
       logger.info(f"[{deletion_id}] Using S3 batch delete for {len(keys)} objects")
       
       try:
           # Prepare for batch delete
           objects_to_delete = [{"Key": key} for key in keys]
           
           # Execute batch delete
           response = await s3_client.delete_objects(
               Bucket=bucket_name,
               Delete={"Objects": objects_to_delete}
           )
           
           # Log results
           deleted = len(response.get("Deleted", []))
           errors = response.get("Errors", [])
           logger.info(f"[{deletion_id}] S3 batch delete results: {deleted} deleted, {len(errors)} errors")
           
           if errors:
               logger.error(f"[{deletion_id}] S3 batch delete errors: {errors}")
               
           return deleted, errors
           
       except Exception as e:
           logger.error(f"[{deletion_id}] S3 batch delete failed: {str(e)}")
           return 0, [str(e)]
   ```

### Phase 4: Database Mapping Implementation

1. **R2 Object Tracking Table**
   - Create a database table to track R2 object keys by project
   ```sql
   CREATE TABLE r2_objects (
       id SERIAL PRIMARY KEY,
       project_id TEXT NOT NULL,
       scene_id TEXT,
       object_key TEXT NOT NULL,
       file_type TEXT,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX idx_r2_objects_project_id ON r2_objects(project_id);
   ```

2. **Record Object Keys During Upload**
   - Update upload functions to record object keys in the database
   ```python
   async def upload_file(...):
       # Existing upload logic...
       
       # Record object key in database
       query = """
       INSERT INTO r2_objects (project_id, scene_id, object_key, file_type)
       VALUES ($1, $2, $3, $4)
       """
       await database.execute(query, project_id, scene_id, object_key, file_type)
       
       return success, url
   ```

3. **Use Database for Deletion**
   - Retrieve exact object keys from database during deletion
   ```python
   async def cleanup_project_storage(project_id: str, deletion_id: str):
       """Clean up all files associated with a project using database records."""
       logger.info(f"[{deletion_id}] Starting storage cleanup for {project_id}")
       
       # Get object keys from database
       query = "SELECT object_key FROM r2_objects WHERE project_id = $1"
       object_keys = await database.fetch_all(query, project_id)
       object_keys = [row["object_key"] for row in object_keys]
       
       logger.info(f"[{deletion_id}] Found {len(object_keys)} objects in database for project {project_id}")
       
       # Delete objects
       deleted, errors = await delete_objects(bucket_name, object_keys)
       
       # Clean up database records
       if deleted:
           cleanup_query = "DELETE FROM r2_objects WHERE project_id = $1"
           await database.execute(cleanup_query, project_id)
       
       return {"deleted": deleted, "errors": errors}
   ```

### Phase 5: Debug Endpoint Implementation

1. **Direct Cleanup Endpoint**
   - Create a dedicated endpoint for directly testing cleanup
   ```python
   @router.post("/debug/cleanup/{project_id}", response_model=Dict[str, Any])
   async def debug_cleanup(project_id: str, 
                           mode: str = Query("wrangler", enum=["wrangler", "s3", "database", "sequential"]),
                           dry_run: bool = Query(False)):
       """Debug endpoint for testing different cleanup strategies."""
       deletion_id = uuid.uuid4()
       logger.info(f"[{deletion_id}] Debug cleanup for project {project_id} using {mode} mode")
       
       if mode == "wrangler":
           result = await cleanup_with_wrangler(project_id, deletion_id, dry_run)
       elif mode == "s3":
           result = await cleanup_with_s3api(project_id, deletion_id, dry_run)
       elif mode == "database":
           result = await cleanup_with_database(project_id, deletion_id, dry_run)
       elif mode == "sequential":
           result = await cleanup_with_wrangler(project_id, deletion_id, dry_run, sequential=True)
       
       return {
           "deletion_id": str(deletion_id),
           "project_id": project_id,
           "mode": mode,
           "dry_run": dry_run,
           "result": result
       }
   ```

2. **Verification Endpoint**
   - Create an endpoint to verify if cleanup was successful
   ```python
   @router.get("/debug/verify-cleanup/{project_id}", response_model=Dict[str, Any])
   async def verify_cleanup(project_id: str):
       """Check if any files remain for a project after cleanup."""
       # List remaining files using both Wrangler and S3 API
       wrangler_files = await list_files_with_wrangler(project_id)
       s3_files = await list_files_with_s3api(project_id)
       
       return {
           "project_id": project_id,
           "files_remaining_wrangler": wrangler_files,
           "files_remaining_s3": s3_files,
           "is_clean_wrangler": len(wrangler_files) == 0,
           "is_clean_s3": len(s3_files) == 0
       }
   ```

## Implementation Timeline

1. **Week 1: Diagnostic Setup**
   - Implement all debug endpoints
   - Enhance logging throughout the deletion process
   - Verify execution context differences

2. **Week 2: Testing Alternative Approaches**
   - Test sequential vs parallel deletion
   - Implement and test S3 API batch delete
   - Compare results across methods

3. **Week 3: Database Integration**
   - Implement R2 object tracking table
   - Modify upload process to record object keys
   - Update deletion process to use database records

4. **Week 4: Final Implementation**
   - Select most reliable approach based on testing
   - Implement comprehensive solution
   - Create monitoring dashboard for deletion operations

## Troubleshooting Guide

If deletion continues to fail despite these efforts:

1. **Check Logs**: Look for execution context differences, command failures, or permission issues
2. **Verify Authentication**: Ensure the application has the correct Wrangler and R2 credentials
3. **Examine File Patterns**: Check if new file patterns have emerged that aren't being matched
4. **Test With Small Projects**: Create test projects with few files to simplify debugging
5. **Consider Direct Execution**: Temporarily bypass background tasks for direct execution
6. **Monitor Resource Usage**: Check if resource constraints are affecting deletion operations

## Success Criteria

The implementation will be considered successful when:

1. Deletion from the UI consistently removes all associated files from R2
2. The process works for all file patterns (historical and current)
3. Cleanup operations are properly logged and traceable
4. Failed deletions provide clear error messages
5. The system can handle edge cases gracefully

Through this comprehensive approach, we aim to solve the persistent R2 cleanup issues once and for all while establishing robust patterns for future object storage operations. 