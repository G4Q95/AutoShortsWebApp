# Cloudflare R2 Setup Guide

## Step 1: Add CORS Policy to Your Bucket

1. Go to your Cloudflare Dashboard
2. Click on "R2" in the left sidebar
3. Click on your `autoshorts-media` bucket
4. Click on the "Settings" tab
5. Scroll down to find the "CORS policy" section
6. Click "Add CORS policy"
7. Paste this CORS policy:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000", 
      "http://frontend:3000",
      "http://localhost:8000"
    ],
    "AllowedMethods": [
      "GET", 
      "PUT", 
      "POST", 
      "DELETE", 
      "HEAD"
    ],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

8. Click "Save"

## Step 2: Check Your Token Permissions

1. Go to the "API Tokens" tab (you can access this from R2 page)
2. Find the token you just created
3. Click "Edit" (if available)
4. Make sure it has:
   - **Permission**: Object Read & Write
   - **Resources**: Specifically includes `autoshorts-media` bucket
   - If you can't edit the token, create a new one with these permissions

## Step 3: Create a New Token (if needed)

If the existing token doesn't work, create a new one:

1. Click "Create API Token"
2. Name: "AutoShorts Media Access"
3. Set these options:
   - Permission: Select "Object Read & Write"
   - Resources: Select ONLY the "autoshorts-media" bucket
   - TTL: "No expiration" (or choose a duration)
4. Click "Create Token"
5. Copy both the Access Key ID and Secret Access Key

## Step 4: Update docker-compose.yml

After getting the new token, update your docker-compose.yml:

```yaml
- CLOUDFLARE_R2_ACCESS_KEY_ID=[new-access-key]
- CLOUDFLARE_R2_SECRET_ACCESS_KEY=[new-secret-key]
- AWS_ACCESS_KEY_ID=[same-as-above]
- AWS_SECRET_ACCESS_KEY=[same-as-above]
- USE_MOCK_STORAGE=false
```

Then restart the containers:

```
docker-compose down && docker-compose up -d
```

## Troubleshooting

If you still see 401 errors, check:

1. **Token Scope**: Make sure the token is specifically scoped to the `autoshorts-media` bucket
2. **Account ID**: Confirm the account ID in the endpoint URL matches your Cloudflare account
3. **Bucket Name**: Verify the bucket is named exactly `autoshorts-media` (case sensitive)
4. **Token Status**: Ensure the token is active and not expired 