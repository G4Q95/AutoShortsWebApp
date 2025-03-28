# MongoDB Connection Fix

## Issue Description

The application is currently experiencing issues connecting to MongoDB Atlas. The problem appears to be related to:

1. DNS resolution errors with the MongoDB Atlas hostname
2. Default connection parameters that don't allow enough time for connection
3. SSL handshake failures that prevent successful connections

The primary error being logged is: 
```
[Errno 8] nodename nor servname provided, or not known
```

This is happening despite the MongoDB credentials being valid (confirmed via direct connection with the MongoDB shell).

## Root Cause Analysis

After extensive testing, we've identified that while the connection string is valid and works with the MongoDB shell, there are DNS resolution issues when trying to connect from the Python MongoDB driver. This appears to be specific to the SRV format (`mongodb+srv://`) and how it's being processed.

We've identified a few key issues:
1. The driver is trying to connect to `autoshortsdb:27017` directly instead of properly resolving the SRV record
2. Connection timeouts are too short (5 seconds) for initial connection establishment 
3. SSL handshake errors are occurring but being swallowed in the general connection error

## The Fix

We've created a more resilient database connection handler with these improvements:

1. **Increased connection timeouts** (30 seconds instead of 5) to allow more time for DNS resolution
2. **Better error handling and logging** to provide clearer information about connection failures
3. **Enhanced mock database implementation** with better in-memory storage for the fallback case
4. **Improved connection parameters** using MongoDB best practices for Atlas connections
5. **Hostname extraction and logging** to better diagnose connection issues

## How to Apply the Fix

### Option 1: Automatic Deployment (Recommended)

Run the included Python script to automatically apply the fix to the Docker container:

```bash
python apply_db_fix.py
```

This script will:
1. Find the running backend container
2. Create a backup of the original database.py file
3. Copy the fixed version to the container
4. Restart the container to apply the changes

### Option 2: Manual Deployment

If you prefer to apply the fix manually:

1. Copy the `database_fixed.py` file to the Docker container:
   ```bash
   docker cp database_fixed.py <container_id>:/app/app/core/database.py
   ```

2. Restart the backend container:
   ```bash
   docker restart <container_id>
   ```

## Verifying the Fix

Check the logs after applying the fix:

```bash
docker logs <container_id> | grep MongoDB
```

You should see either:
- A successful connection message: `Connected to MongoDB successfully. Using database: autoshortsdb`
- Or a clearer error message with more details about the connection failure

## Reverting Changes

If needed, you can revert to the original file. The automatic deployment script creates a backup with a timestamp, which you can copy back:

```bash
docker exec <container_id> cp /app/app/core/database.py.bak.<timestamp> /app/app/core/database.py
docker restart <container_id>
```

## Long-term Solutions

For a more permanent solution, consider these options:

1. Use a direct MongoDB connection string (not SRV format) if possible
2. Configure the Docker container with proper DNS resolution for SRV records
3. Update to the latest pymongo/motor drivers (already done in our fix)
4. Configure proper network access in MongoDB Atlas
5. Use a MongoDB URI environment variable with a direct IP rather than hostname

## Environment Variables

The MongoDB connection uses these environment variables:

- `MONGODB_URI`: The connection string for MongoDB Atlas
- `MONGODB_NAME`: The name of the database (defaults to "autoshortsdb")

The current URI format is:
```
mongodb+srv://username:password@autoshortsdb.f7asv.mongodb.net/?retryWrites=true&w=majority&appName=autoshortsdb
``` 