#!/bin/bash

# Script to clean up Playwright test screenshot artifacts
# Run this occasionally to free up disk space

echo "Cleaning up Playwright test screenshot artifacts..."

# Navigate to the frontend directory
cd "$(dirname "$0")/.." || exit

# Remove all test screenshot PNG files in the current directory (web/frontend)
echo "Removing screenshot files..."
find . -maxdepth 1 -type f -name "*.png" -delete

# Also clean up test-results directory
echo "Cleaning up test-results directory..."
rm -rf test-results

echo "Cleanup complete!" 