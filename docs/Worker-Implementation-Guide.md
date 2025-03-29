# Cloudflare Worker Implementation Guide

This guide outlines the steps to deploy and configure the Cloudflare Worker for R2 file deletion.

## Overview

We've implemented a Cloudflare Worker-based approach to handle R2 file deletion, which offers:

- Native integration with R2 storage via Worker bindings
- Simplified architecture with clean separation of concerns
- Improved reliability for file deletion operations

## Implementation Steps

### 1. Deploy the Worker to Cloudflare

1. Ensure Wrangler CLI is installed globally:
   ```bash
   npm install -g wrangler
   ```

2. Log in to Cloudflare using Wrangler:
   ```bash
   wrangler login
   ```

3. Navigate to the Worker directory:
   ```bash
   cd workers/r2-delete
   ```

4. Deploy the Worker:
   ```bash
   wrangler deploy
   ```

5. Note the Worker URL provided after successful deployment (e.g., `https://r2-delete-worker.yourusername.workers.dev`).

### 2. Configure Worker in R2 Dashboard

1. Log in to the Cloudflare dashboard.
2. Navigate to R2 > Buckets > autoshorts-media.
3. Go to the "Settings" tab.
4. Under "Worker Bindings", create a new binding:
   - Binding name: `AUTO_SHORTS_BUCKET` (must match the name in the Worker code)
   - Service: Select your deployed r2-delete-worker

### 3. Create API Token for Worker Access

1. In Cloudflare dashboard, go to "My Profile" > "API Tokens".
2. Click "Create Token".
3. Select "Create Custom Token".
4. Name the token (e.g., "R2 Delete Worker Token").
5. Add the following permissions:
   - Account > Workers Scripts > Edit
   - Account > Workers Routes > Edit
   - Account > R2 > Edit (for the specific bucket)
   - User > User Details > Read (required for authentication)
6. Set appropriate account resources.
7. Create the token and copy it for the next step.

### 4. Configure Backend Environment

1. Update the `.env` file with the Worker URL and API token:
   ```
   CF_WORKER_URL=https://r2-delete-worker.yourusername.workers.dev
   CF_WORKER_API_TOKEN=your_worker_api_token
   USE_WORKER_FOR_DELETION=false  # Keep disabled until testing is complete
   ```

2. Restart the backend service to apply changes:
   ```bash
   docker-compose restart backend
   ```

### 5. Test the Worker

1. Use the debug endpoints to verify the Worker configuration:
   ```
   GET http://localhost:8000/api/v1/debug/worker-status
   ```

2. Test the Worker with some files:
   ```
   POST http://localhost:8000/api/v1/debug/test-worker
   {
     "object_keys": ["test_file1.txt", "test_file2.txt"],
     "dry_run": true
   }
   ```

3. Test with a real project (with dry run enabled):
   ```
   POST http://localhost:8000/api/v1/debug/cleanup-project/your_project_id?mode=worker&dry_run=true
   ```

4. Test with a real project (actual deletion):
   ```
   POST http://localhost:8000/api/v1/debug/cleanup-project/your_project_id?mode=worker&dry_run=false
   ```

### 6. Enable Worker for Production

Once testing confirms the Worker approach is reliable:

1. Update the `.env` file:
   ```
   USE_WORKER_FOR_DELETION=true
   ```

2. Restart the backend service:
   ```bash
   docker-compose restart backend
   ```

3. Verify production functionality by deleting a project through the frontend UI.

## Troubleshooting

If you encounter issues with the Worker:

1. **Worker Binding Issues**:
   - Verify the binding name in the Worker matches `AUTO_SHORTS_BUCKET`
   - Check that the binding is properly configured in the Cloudflare dashboard

2. **Authorization Issues**:
   - Ensure the API token has all required permissions
   - Verify the token is correctly set in the `.env` file
   - Check that the backend is properly loading the token

3. **Connection Issues**:
   - Check if the Worker URL is accessible directly
   - Verify there are no network restrictions blocking connections

4. **Debug Logs**:
   - Check the Worker logs in Cloudflare dashboard
   - Check the backend logs for any errors when calling the Worker

## Fallback Mechanism

The system is designed with multiple fallback layers:

1. If the Worker approach fails, it falls back to tracked files deletion
2. If tracked files deletion fails, it falls back to pattern-based deletion

This ensures robustness even if the primary deletion method encounters issues. 