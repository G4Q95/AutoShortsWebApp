# CloudFlare R2 Setup Guide

## Overview
This document provides comprehensive instructions for setting up and testing CloudFlare R2 storage integration with Auto Shorts Web App. CloudFlare R2 is used for storing media assets, audio files, and processed videos with the benefit of no egress fees.

## Setup Process

### 1. Create a CloudFlare Account and R2 Bucket
1. Sign up for a CloudFlare account at https://dash.cloudflare.com/sign-up
2. Navigate to R2 from the dashboard
3. Create a new bucket with appropriate name (e.g., `auto-shorts`)
4. Note the bucket name for later configuration

### 2. Generate API Tokens
1. Go to "R2" → "Overview" in the CloudFlare dashboard
2. Click on "Manage R2 API Tokens"
3. Create a new API token with the following permissions:
   - Object Read
   - Object Write
   - Bucket Read
   - Bucket Write
4. Save both the Access Key ID and Secret Access Key securely

### 3. Configure CORS for the Bucket
Create a CORS configuration file (`cors_configuration.json`):

```json
{
  "cors_rules": [
    {
      "allowed_origins": ["*"],
      "allowed_methods": ["GET", "PUT", "POST", "DELETE"],
      "allowed_headers": ["*"],
      "max_age_seconds": 3000
    }
  ]
}
```

Apply the CORS configuration using AWS CLI:

```bash
aws s3api put-bucket-cors --bucket YOUR_BUCKET_NAME --cors-configuration file://cors_configuration.json --endpoint-url https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com --profile r2
```

### 4. Update Environment Variables
Add the following variables to your `.env` file:

```
# CloudFlare R2 Configuration
CLOUDFLARE_R2_ACCOUNT_ID=your_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key
CLOUDFLARE_R2_BUCKET_NAME=your_bucket_name
```

## Testing R2 Connection

### Basic Connection Test
Run the following script to verify basic connectivity:

```python
import boto3
from botocore.config import Config

def test_r2_connection(account_id, access_key_id, secret_access_key, bucket_name):
    """Test connection to CloudFlare R2."""
    
    # Create an S3 client with CloudFlare R2 endpoint
    s3 = boto3.client(
        's3',
        endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(signature_version='s3v4'),
    )
    
    # List objects in the bucket
    try:
        response = s3.list_objects_v2(Bucket=bucket_name)
        print(f"Successfully connected to R2 bucket: {bucket_name}")
        print(f"Found {response.get('KeyCount', 0)} objects in the bucket")
        return True
    except Exception as e:
        print(f"Error connecting to R2: {str(e)}")
        return False

# Example usage
if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    # Get R2 credentials from environment
    account_id = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
    access_key_id = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID")
    secret_access_key = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
    bucket_name = os.getenv("CLOUDFLARE_R2_BUCKET_NAME")
    
    # Test connection
    test_r2_connection(account_id, access_key_id, secret_access_key, bucket_name)
```

### Upload Test
To verify you can upload files to R2:

```python
import boto3
from botocore.config import Config
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get R2 credentials from environment
account_id = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
access_key_id = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID")
secret_access_key = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
bucket_name = os.getenv("CLOUDFLARE_R2_BUCKET_NAME")

# Create a test file
with open("test_upload.txt", "w") as f:
    f.write("This is a test file for R2 upload.")

# Create an S3 client with CloudFlare R2 endpoint
s3 = boto3.client(
    's3',
    endpoint_url=f'https://{account_id}.r2.cloudflarestorage.com',
    aws_access_key_id=access_key_id,
    aws_secret_access_key=secret_access_key,
    config=Config(signature_version='s3v4'),
)

# Upload file
try:
    s3.upload_file("test_upload.txt", bucket_name, "test_upload.txt")
    print("File uploaded successfully!")
    
    # Verify upload by listing objects
    response = s3.list_objects_v2(Bucket=bucket_name, Prefix="test_upload.txt")
    if response.get('KeyCount', 0) > 0:
        print("File found in bucket!")
    else:
        print("File not found in bucket!")
except Exception as e:
    print(f"Error uploading file: {str(e)}")

# Clean up
os.remove("test_upload.txt")
```

## Project Directory Structure for R2 Storage

The application uses the following R2 directory structure:

```
bucket_name/
├── projects/
│   └── {projectId}/
│       ├── media/
│       │   ├── images/
│       │   ├── videos/
│       │   └── thumbnails/
│       ├── audio/
│       │   └── {sceneId}/
│       │       ├── base.mp3
│       │       └── generated.mp3
│       └── exports/
│           ├── segments/
│           └── final/
├── temp/
└── public/
    ├── assets/
    └── shared/
```

## Troubleshooting

### Common Issues

1. **Access Denied Errors**
   - Verify your API keys have the correct permissions
   - Check that the bucket name matches exactly
   - Ensure the account ID is correct in the endpoint URL

2. **CORS Issues**
   - Verify your CORS configuration includes the necessary methods and headers
   - Check that the allowed origins include your application's domain

3. **Connection Timeouts**
   - Ensure your environment has internet access
   - Check firewall settings that might block outbound connections

### Logging

For detailed debugging of R2 operations, you can enable boto3 logging:

```python
import logging
import boto3

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logging.getLogger('boto3').setLevel(logging.DEBUG)
logging.getLogger('botocore').setLevel(logging.DEBUG)
logging.getLogger('s3transfer').setLevel(logging.DEBUG)

# Create client as shown above
```

## Integration with Backend

The backend service integrates with R2 through an abstraction layer that handles:

1. Secure credential management
2. File upload/download operations
3. URL generation for client access
4. Error handling and retry logic
5. Path normalization and validation

All interactions with R2 should go through this abstraction layer rather than directly using boto3 in multiple places. 