# R2 Storage Utility Scripts

This directory contains scripts for managing and testing Cloudflare R2 storage in the Auto Shorts Web App.

## Setup and Requirements

Before using these scripts, ensure you have the following:

1. Wrangler CLI installed (run `npm install -g wrangler` if needed)
2. Proper Cloudflare R2 credentials configured (see `setup_wrangler.py`)
3. Backend virtual environment activated

## Available Scripts

### 1. `setup_wrangler.py`

Helps set up Wrangler CLI for R2 access.

```bash
python setup_wrangler.py
```

Guides you through:
- Checking Wrangler installation
- Authenticating with Cloudflare
- Setting up environment variables

### 2. `test_wrangler.py`

Tests basic Wrangler R2 operations.

```bash
python test_wrangler.py <bucket_name>
```

Verifies:
- Wrangler is installed
- Bucket accessibility
- Upload and delete operations

### 3. `test_hybrid_approach.py`

Tests the hybrid approach of using S3 API for listing and Wrangler for operations.

```bash
# Basic test with a bucket
python test_hybrid_approach.py <bucket_name>

# Test with deletion verification
python test_hybrid_approach.py <bucket_name> --delete-test

# Test project file cleanup
python test_hybrid_approach.py <bucket_name> --project-id <project_id>

# Skip S3 API tests (if you have authentication issues)
python test_hybrid_approach.py <bucket_name> --skip-s3
```

This script demonstrates:
- Using S3 API for comprehensive object listing
- Using Wrangler for reliable upload/delete operations
- Project cleanup with multiple ID format support
- Fallback to Wrangler if S3 API authentication fails

### 4. `cleanup_project_files.py`

Cleans up all files associated with a specific project.

```bash
# Preview what would be deleted (dry run)
python cleanup_project_files.py <project_id> --dry-run

# Actually delete the files
python cleanup_project_files.py <project_id>
```

### 5. `list_r2_objects.py`

Lists objects in your R2 bucket with various filtering options.

```bash
# List all objects
python list_r2_objects.py

# List with a specific prefix
python list_r2_objects.py --prefix proj_abc123

# Search for objects containing a string
python list_r2_objects.py --search "video"
```

## Hybrid Approach Details

The hybrid approach was developed to address limitations in both the S3 API and Wrangler CLI:

- **S3 API Strengths**: Comprehensive object listing, pagination, efficient filtering
- **S3 API Limitations**: Authentication issues with some R2 configurations

- **Wrangler Strengths**: Direct access to R2, reliable operations, no auth issues
- **Wrangler Limitations**: Limited listing capabilities, no pagination

By combining both approaches, we get the best of both worlds:
1. Use S3 API when possible for comprehensive object listing
2. Fall back to Wrangler for basic operations when S3 fails
3. Always use Wrangler for upload/delete operations for reliability

## Troubleshooting

If you encounter issues:

1. **401 Unauthorized errors**: 
   - Check your R2 credentials
   - Try using `--skip-s3` flag to bypass S3 API
   - Run `setup_wrangler.py` to ensure proper authentication

2. **Wrangler not found**:
   - Install with `npm install -g wrangler`
   - Ensure it's in your PATH

3. **Failed to import modules**:
   - Make sure you're running from the backend directory
   - Activate the virtual environment: `source venv/bin/activate` 