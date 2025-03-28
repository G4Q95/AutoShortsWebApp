#!/bin/bash
# Script to delete known file patterns from Cloudflare R2 bucket
# This script doesn't require listing objects, it uses known patterns

BUCKET_NAME="autoshorts-media"
DRY_RUN=false

# Check for dry run argument
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "Running in DRY-RUN mode. No files will be deleted."
fi

# Known file patterns based on previous observations
PATTERNS=(
  "proj_*_media.mp4"
  "proj_*_*_media.mp4"
  "scene_*_media.mp4"
  "test_*"
  "*.txt"
  "*.mp4"
  "*.jpg"
  "*.jpeg"
  "*.png"
  "*.wav"
  "*.mp3"
  "*"  # Fallback to catch all
)

# Counter for deleted files
DELETED=0
FAILED=0

delete_with_pattern() {
  local pattern=$1
  echo "Trying pattern: $pattern"
  
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY RUN: Would delete files matching pattern: $pattern"
    return
  fi
  
  # Try to delete the file, but don't exit on error
  if wrangler r2 object delete "$BUCKET_NAME/$pattern" --remote >/dev/null 2>&1; then
    echo "Successfully deleted object(s) matching: $pattern"
    ((DELETED++))
  else
    echo "No objects found or error deleting pattern: $pattern"
    ((FAILED++))
  fi
}

# If not in dry run mode, ask for confirmation
if [[ "$DRY_RUN" == "false" ]]; then
  echo "WARNING: You are about to attempt to DELETE ALL FILES from bucket '$BUCKET_NAME'."
  echo "THIS ACTION CANNOT BE UNDONE."
  echo
  read -p "Type 'DELETE ALL' to confirm: " CONFIRMATION
  
  if [[ "$CONFIRMATION" != "DELETE ALL" ]]; then
    echo "Deletion cancelled."
    exit 1
  fi
  
  echo "Proceeding with deletion..."
fi

# Try each pattern
for pattern in "${PATTERNS[@]}"; do
  delete_with_pattern "$pattern"
done

# Report results
echo
echo "Deletion attempts complete."
echo "Successful deletion attempts: $DELETED"
echo "Failed deletion attempts: $FAILED"

echo "Note: Since R2 doesn't provide a way to list objects with the current"
echo "Wrangler version, we can't guarantee all files were deleted."
echo "Please check the bucket manually to verify." 