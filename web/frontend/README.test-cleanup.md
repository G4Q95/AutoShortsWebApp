# Test Cleanup Process

When running Playwright tests for the Auto Shorts Web App, test files are created in both MongoDB and the Cloudflare R2 storage. This document explains how to clean up these files after running tests.

## The Problem

Playwright tests create test projects with names like "Test Project", "Playwright Test", etc. These projects and their associated files (images, videos, audio) remain in the system after tests complete, which can lead to:

1. Unnecessary storage costs in R2
2. Cluttered database with test projects
3. Potential interference between test runs

## Solution 

We've implemented a cleanup system that:

1. Identifies test projects by name patterns
2. Deletes them from MongoDB
3. Removes associated files from Cloudflare R2

## How to Use

### After Running Tests

Run this command to clean up test files:

```bash
npm run cleanup
```

### Combined Test and Cleanup

To run tests and then clean up afterward:

```bash
npm run test-and-cleanup
```

## How It Works

1. The `cleanup-test-files.js` script sends a request to the backend API endpoint `/api/v1/debug/cleanup-test-data`
2. The endpoint accepts name patterns like "Test Project" and "Playwright"
3. It finds projects in the database matching these patterns
4. It deletes the projects from MongoDB
5. It schedules background tasks to clean up associated R2 files

## Troubleshooting

If cleanup doesn't work:

1. Ensure the backend is running: `docker-compose ps` should show the backend container running
2. Check backend logs: `docker-compose logs backend`
3. Verify the MongoDB connection is working (not in mock mode)
4. Ensure R2 credentials are correctly set up in the environment variables

## Note on Mock Database Mode

If the backend is running in mock database mode:
- The cleanup will simulate the process but not delete real data
- You'll see a message: "Database is in mock mode. Real projects were not deleted."

This typically happens when the MongoDB connection string is invalid or the connection fails. 