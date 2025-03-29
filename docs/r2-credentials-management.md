# R2 Credentials Management

This document outlines best practices for managing Cloudflare R2 credentials in the Auto Shorts Web App.

## Current Credentials Structure

The application uses the following environment variables for R2 access:

### In Root `.env` File
```
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_ENDPOINT=your_endpoint_url
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_ENDPOINT_URL=your_endpoint_url
R2_BUCKET_NAME=autoshorts-media
```

### In Backend `.env` File
```
# Cloudflare R2
R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_ACCOUNT_ID=your_account_id
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_ENDPOINT=your_endpoint_url
R2_BUCKET_NAME=autoshorts-media
```

## API Token Management

Cloudflare R2 uses S3-compatible API credentials (Access Key ID and Secret Access Key) for direct bucket operations. These are different from Cloudflare API Tokens used for management operations.

### Types of Credentials

1. **R2 API Credentials (S3-compatible)**
   - Used for direct bucket operations (upload, download, delete)
   - Consists of Access Key ID and Secret Access Key
   - Created in Cloudflare Dashboard under R2 → Manage API Tokens

2. **Cloudflare API Token**
   - Used for management operations via Cloudflare API
   - Created in Cloudflare Dashboard under My Profile → API Tokens
   - Needs appropriate R2 permissions based on intended use

### Creating New API Tokens

When creating a new token in the Cloudflare dashboard:

1. **For R2 Full Access**
   - Go to R2 → Manage API Tokens → Create API Token
   - Select "Full Access" permission for complete bucket management
   - Note both the Access Key ID and Secret Access Key
   
2. **For R2 Read-Only Access**
   - Select "Read Only" permission if only read operations are needed
   
3. **For Wrangler/Worker Access**
   - Go to My Profile → API Tokens → Create Token
   - Use the "Edit Cloudflare Workers" template
   - Add R2 Storage Edit permissions
   - Add Account Resources if needed

## Credential Rotation Best Practices

To ensure security and prevent authentication failures:

1. **Regular Rotation Schedule**
   - Rotate R2 credentials every 90-180 days
   - Document each rotation in the project management system
   
2. **Rotation Process**
   - Create new credentials before invalidating old ones
   - Update all environment files simultaneously
   - Test functionality after updating credentials
   - Only then delete old credentials

3. **Environment Update Checklist**
   - Root `.env` file
   - Backend `.env` file
   - Docker environment variables
   - CI/CD pipeline variables (if applicable)
   - Development team's local environments

## Troubleshooting Authentication Issues

If experiencing 401 Unauthorized errors when accessing R2:

1. **Verify Credentials Validity**
   - Check if the API token is still active in Cloudflare Dashboard
   - Confirm the Access Key ID and Secret Access Key are correct
   - Verify endpoint URL format is correct

2. **Check Environment Variables**
   - Ensure variables are properly loaded in the application
   - Rebuild Docker containers after updating env files
   - Check for typos or trailing spaces in credentials

3. **Review Permissions**
   - Confirm the token has appropriate permissions for the bucket
   - Verify bucket name is correctly specified
   - Check if the bucket exists in the Cloudflare account

4. **Test with CLI Tools**
   - Use AWS CLI with S3 compatibility to test credentials:
     ```bash
     aws s3 ls s3://autoshorts-media --endpoint-url https://your-account-id.r2.cloudflarestorage.com --profile r2
     ```

## Recent Changes (June 2024)

- Created a dedicated API token with "Full Access" permissions named "PermanentR2fulldelete"
- Updated both root and backend `.env` files with new credentials
- Verified successful operations through backend logs
- Created standalone `r2_purger.py` script for bulk bucket cleaning

## Best Practices for Development

1. **Never commit credentials** to version control
2. **Use .env files** for local development
3. **Maintain a single source of truth** for credentials when possible
4. **Document all credential changes** in the project management system
5. **Test thoroughly after any credential updates** 