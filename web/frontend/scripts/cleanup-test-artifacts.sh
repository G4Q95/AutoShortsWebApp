#!/bin/bash

# Script to clean up Playwright test screenshot artifacts
# Run this occasionally to free up disk space

echo "Cleaning up Playwright test screenshot artifacts..."

# Navigate to the frontend directory
cd "$(dirname "$0")/.." || exit

# Remove all test screenshot artifacts
echo "Removing screenshot files..."
find . -maxdepth 1 -type f -name "before-*.png" -delete
find . -maxdepth 1 -type f -name "after-*.png" -delete
find . -maxdepth 1 -type f -name "*-check-*.png" -delete
find . -maxdepth 1 -type f -name "pre-*.png" -delete
find . -maxdepth 1 -type f -name "during-*.png" -delete
find . -maxdepth 1 -type f -name "scene-structure-*.png" -delete
find . -maxdepth 1 -type f -name "voice-*.png" -delete
find . -maxdepth 1 -type f -name "button-*.png" -delete
find . -maxdepth 1 -type f -name "cleanup-*.png" -delete
find . -maxdepth 1 -type f -name "debug-*.png" -delete
find . -maxdepth 1 -type f -name "edit-scene-*.png" -delete
find . -maxdepth 1 -type f -name "drag-*.png" -delete
find . -maxdepth 1 -type f -name "existing-*.png" -delete
find . -maxdepth 1 -type f -name "found-*.png" -delete
find . -maxdepth 1 -type f -name "waiting-*.png" -delete
find . -maxdepth 1 -type f -name "audio-*.png" -delete

# Also clean up test-results directory
echo "Cleaning up test-results directory..."
rm -rf test-results

echo "Cleanup complete!" 