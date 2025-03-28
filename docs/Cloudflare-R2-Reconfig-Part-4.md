# Cloudflare R2 Reconfig - Part 4: Workers Approach

This document outlines our new strategy for solving the Cloudflare R2 file deletion issues using Cloudflare Workers. It builds on the findings and lessons from our previous attempts documented in Parts 1-3.

## Summary of Previous Approaches

Throughout our journey to solve the R2 file deletion issues, we've tried several approaches:

1. **Pattern-Based File Matching** (Part 1-2)
   - Attempted to match files based on various naming patterns
   - Struggled with inconsistent naming conventions and path structures
   - Resulted in unreliable deletion where some files were missed

2. **Wrangler CLI Integration** (Part 3)
   - Integrated Wrangler CLI into our Docker container
   - Required installing Node.js in our Python container
   - Faced authentication issues and environment variable challenges
   - Suffered from the complexities of subprocess execution
   - Required special `--remote` flag that was often missed
   - For more details, see [Cloudflare-R2-Reconfig-Part-3.md](Cloudflare-R2-Reconfig-Part-3.md)

3. **Database File Tracking** (Part 3)
   - Implemented tracking of R2 file paths in MongoDB
   - This approach has proven to be more reliable for knowing which files to delete
   - However, the execution of the deletion still faced challenges

## Core Issues Identified

Our extensive troubleshooting has identified several key issues:

1. **Environment Challenges**:
   - Running Wrangler CLI commands within a Python application is error-prone
   - Authentication context varies between direct CLI and application execution
   - Environment variables and paths need careful management

2. **Connection Reliability**:
   - S3 API connections to R2 have inconsistent behavior
   - Wrangler CLI commands require specific flags and syntax
   - Connection problems are difficult to diagnose

3. **File Pattern Inconsistencies**:
   - Files have been stored with multiple naming patterns
   - Hierarchical paths vs flat naming structures
   - Double prefixed files (`proj_proj_`) vs single prefix

## New Approach: Cloudflare Workers

After careful consideration, we're pivoting to a Cloudflare Workers approach. This leverages Cloudflare's purpose-built technology for interacting with R2 storage.

### Why Workers?

1. **Native R2 Integration**:
   - Workers have direct "bindings" to R2 storage
   - No need for authentication within commands or API calls
   - Execute within Cloudflare's infrastructure, close to the storage

2. **Simplified Architecture**:
   - Clean separation of concerns
   - Python application handles business logic
   - Worker handles Cloudflare-specific operations

3. **Reliability**:
   - Avoids environment and authentication issues
   - Uses Cloudflare's recommended approach
   - Direct connections rather than command-line tools

### Implementation Plan

We will implement "Alternative 2" from our evaluation: **Worker as an R2 Executor Proxy**

#### Step 1: Create and Test a Simple Worker (Proof of Concept)

1. **Create a Basic Worker**:
   ```javascript
   // R2 deletion worker
   export default {
     async fetch(request, env) {
       // Parse the request
       const { objectKeys } = await request.json();
       
       // Delete the objects from R2
       const results = await Promise.all(
         objectKeys.map(async (key) => {
           try {
             await env.MY_BUCKET.delete(key);
             return { key, success: true };
           } catch (error) {
             return { key, success: false, error: error.message };
           }
         })
       );
       
       // Return the results
       return new Response(JSON.stringify({ results }), {
         headers: { 'Content-Type': 'application/json' }
       });
     }
   };
   ```

2. **Configure R2 Binding**:
   - Connect the Worker to the R2 bucket in the Cloudflare dashboard
   - Create a new API token with Workers and R2 permissions
   - Test the Worker with a simple file deletion

#### Step 2: Build a Backend Integration Endpoint

1. **Create an API Client for the Worker**:
   ```python
   async def delete_files_via_worker(object_keys):
       """Delete files from R2 via Cloudflare Worker."""
       worker_url = settings.worker_url
       headers = {
           "Authorization": f"Bearer {settings.worker_api_token}",
           "Content-Type": "application/json"
       }
       payload = {"objectKeys": object_keys}
       
       async with httpx.AsyncClient() as client:
           response = await client.post(
               worker_url,
               headers=headers,
               json=payload
           )
           
           if response.status_code == 200:
               return response.json()
           else:
               logger.error(f"Worker deletion failed: {response.text}")
               return {"error": response.text}
   ```

2. **Integrate with Project Deletion**:
   ```python
   @router.delete("/projects/{project_id}")
   async def delete_project(project_id: str, background_tasks: BackgroundTasks):
       # Delete project from database
       await db.delete_project(project_id)
       
       # Get file paths from database
       file_paths = await db.get_project_file_paths(project_id)
       
       # Delete files via Worker
       background_tasks.add_task(delete_files_via_worker, file_paths)
       
       return {"message": "Project deleted"}
   ```

3. **Keep Wrangler as Fallback**:
   - Maintain the current Wrangler implementation as a fallback
   - Add a configuration flag to switch between approaches
   - This allows for testing and comparison

#### Step 3: Test the Full Flow

1. **End-to-End Testing**:
   - Create a test project with sample files
   - Delete the project through the frontend
   - Verify files are deleted from R2
   - Compare results with Wrangler approach

2. **Performance Analysis**:
   - Measure deletion time
   - Check for any errors or missed files
   - Monitor Worker execution in Cloudflare dashboard

#### Step 4: Clean Up After Confirmation

Once the Worker approach is proven successful:

1. **Docker Cleanup**:
   - Remove Node.js and Wrangler from the Docker image
   - Simplify the Docker setup
   - Update docker-compose.yml to remove Wrangler-specific configurations

2. **Code Cleanup**:
   - Remove Wrangler-specific implementation
   - Clean up test scripts and debug endpoints
   - Update documentation

3. **Configuration Updates**:
   - Update .env.example with new Worker-specific variables
   - Document the new API token requirements

### API Token Requirements

For the Workers approach, you'll need:

1. **New API Token with**:
   - Account > Workers Scripts > Edit
   - Account > Workers Routes > Edit
   - Account > R2 > Edit (for the specific bucket)

2. **Worker R2 Bucket Binding**:
   - Configure in the Cloudflare dashboard
   - Connect the Worker to your R2 bucket

## Cleanup Plan

To reduce technical debt and simplify our codebase, we'll clean up the following:

### Files to Remove

1. **Test Scripts**:
   - `test_tls.py`
   - `test_tls_connection.py`
   - `test_mongo.py`
   - `test_mongo_atlas.py`
   - `test_mongodb_ssl.py`
   - All other test_*.py files created for R2 troubleshooting

2. **Debug Scripts**:
   - `apply_db_fix.py`
   - `fix_database.py`
   - Other temporary debug scripts

3. **Wrangler-Specific Code**:
   - Remove Wrangler command execution from storage service
   - Remove Wrangler authentication functions

### Docker Changes

1. **Revert Docker Modifications**:
   - Remove Node.js installation
   - Remove Wrangler installation
   - Simplify the Dockerfile to focus on Python

2. **Environment Variables**:
   - Update to use Worker-specific variables
   - Remove Wrangler-specific variables

### Keep and Enhance

1. **File Path Tracking**:
   - Keep and enhance the database tracking of R2 file paths
   - This remains valuable regardless of deletion approach

2. **Documentation**:
   - Keep all documentation of file patterns and previous approaches
   - These provide valuable context and lessons learned

3. **Core Storage Fixes**:
   - Keep improvements to file path generation
   - Maintain consistent naming patterns for new files

## Timeline and Implementation Strategy

### Week 1: Worker Implementation

1. **Days 1-2: Create and Test Worker**
   - Develop basic Worker for R2 deletion
   - Test standalone functionality
   - Document the Worker implementation

2. **Days 3-5: Backend Integration**
   - Create API client for Worker communication
   - Update project deletion flow
   - Test integration with sample projects

### Week 2: Testing and Cleanup

1. **Days 1-3: Comprehensive Testing**
   - Test various project types and file patterns
   - Compare Worker and Wrangler approaches
   - Document results and performance metrics

2. **Days 4-5: Cleanup**
   - Remove test scripts and debug code
   - Update Docker configuration
   - Finalize documentation

## Success Criteria

The implementation will be considered successful when:

1. Projects deleted through the frontend UI have all their R2 files reliably removed
2. The solution works with all historical file patterns
3. The architecture is simplified, with clean separation of concerns
4. Technical debt is reduced through cleanup
5. The approach is well-documented for future maintenance

## References

For more detailed information on our journey and previous approaches:

- [Cloudflare-R2-Reconfig-Round-Two.md](Cloudflare-R2-Reconfig-Round-Two.md) - Initial problems and file pattern documentation
- [Cloudflare-R2-Reconfig-Part-3.md](Cloudflare-R2-Reconfig-Part-3.md) - Wrangler approach and authentication troubleshooting

## Conclusion

The Cloudflare Workers approach offers a clean, purpose-built solution to our R2 deletion challenges. By leveraging Cloudflare's native integration between Workers and R2, we can achieve more reliable file deletion while simplifying our architecture and reducing technical debt.

This approach allows us to build on the valuable lessons learned from our previous attempts while moving to a more sustainable and robust solution for the long term. 