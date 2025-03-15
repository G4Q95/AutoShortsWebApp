# Cloudflare R2 Setup Documentation

## Overview
This document tracks the setup process for Cloudflare R2 integration with the Auto Shorts Web App.

## Problem
Previous R2 integration attempts were failing with 401 Unauthorized errors, indicating issues with:
- API credentials
- Bucket permissions
- CORS configuration

## Solution Steps

### 1. Create Proper API Token ✅
- Navigated to Cloudflare Dashboard > R2 > API Tokens
- Created a new API token with:
  - Permission: "Object Read & Write"
  - Resource: Specific bucket "autoshorts-media"
  - TTL: Forever (no expiration)
- Successfully generated new token and credentials on [DATE]

### 2. Update docker-compose.yml with New Credentials ✅
- Updated the following environment variables in docker-compose.yml:
  ```yaml
  - CLOUDFLARE_R2_ACCESS_KEY_ID=da9b059548252aba175a3464f1f3926a
  - AWS_ACCESS_KEY_ID=da9b059548252aba175a3464f1f3926a
  - USE_MOCK_STORAGE=false
  ```
- Secret keys were also updated but not shown here for security

### 3. Set Up CORS Policy for R2 Bucket ✅
- Navigated to Cloudflare R2 Dashboard > autoshorts-media bucket > Settings > CORS
- Added CORS configuration:
  ```json
  [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```
- Successfully saved the CORS policy to the bucket

### 4. Restart Docker Containers ✅
- Ran the following commands to restart the Docker containers:
  ```bash
  docker-compose down
  docker-compose up -d
  ```
- Successfully restarted all containers with the new configuration

### 5. Verify R2 Connection ✅
- Created and ran the verification script `verify_r2.py`
- Successfully tested all core operations:
  - Bucket access ✅
  - File upload ✅
  - URL generation ✅
  - Object listing ✅
  - File download ✅
  - File deletion ✅
- **Note**: The "List buckets" operation failed with "Access Denied", but this is expected as the token has permissions only for the specific bucket, not for listing all buckets.

## Test Results
The verification script confirmed that our R2 integration is now working correctly! Here's a summary of the test results:

| Test | Result | Details |
|------|--------|---------|
| Bucket Access | ✅ Success | The bucket exists and is accessible |
| List Buckets | ❌ Failed (Expected) | This is expected because our token has permissions only for the specific bucket |
| File Upload | ✅ Success | Successfully uploaded a test file |
| URL Generation | ✅ Success | Generated a working presigned URL |
| Object Listing | ✅ Success | Could list objects in the bucket |
| File Download | ✅ Success | Successfully downloaded the test file |
| File Deletion | ✅ Success | Successfully deleted the test file |

## Troubleshooting Notes
- 401 Unauthorized typically means an authentication issue with credentials
- 403 Forbidden typically means the token doesn't have permission for a bucket
- CORS errors will appear in browser console when frontend tries to access R2 resources

## Common Issues and Solutions

### Token Issues
- Make sure token has "Object Read & Write" permission
- Token should be scoped to specific bucket "autoshorts-media"
- Verify token is not expired

### CORS Issues
- Must configure CORS to allow browser access
- AllowedOrigins should include frontend URL (or use "*" for development)
- AllowedMethods should include all required HTTP methods

### Configuration Issues
- Double-check environment variables in docker-compose.yml
- Set USE_MOCK_STORAGE=false when using R2
- Set AWS_DEFAULT_REGION=auto for Cloudflare R2
- Keep your credentials secret and never commit them to Git

## Next Steps
Now that R2 integration is complete:
1. Test file uploads through the application UI
2. Test video generation with R2 storage
3. Consider adding more specific origins to CORS policy for production 