#!/bin/bash
# Script to delete all files in the Cloudflare R2 bucket using Wrangler
# Can be run with optional --dry-run argument

set -e  # Exit on error

BUCKET_NAME="autoshorts-media"
TEMP_FILE="/tmp/r2_file_list.txt"
DRY_RUN=false

# Check for dry run argument
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "Running in DRY-RUN mode. No files will be deleted."
fi

# Function to clean up temp files
cleanup() {
  rm -f "$TEMP_FILE"
}

# Ensure cleanup runs on exit
trap cleanup EXIT

# Ensure wrangler is installed
if ! command -v wrangler &> /dev/null; then
  echo "Error: wrangler command not found. Please install it with 'npm install -g wrangler'" >&2
  exit 1
fi

echo "Listing objects in bucket: $BUCKET_NAME"
echo "This may take a moment..."

# Get list of objects in the bucket
if command -v jq &> /dev/null; then
  # If jq is available, use it to parse JSON output
  wrangler r2 objects list "$BUCKET_NAME" --remote --json | jq -r '.[].key' > "$TEMP_FILE"
else
  # Otherwise, fallback to a less precise method
  wrangler r2 objects list "$BUCKET_NAME" --remote | grep -v "Listed" | grep -v "^$" | sed 's/^[[:space:]]*//' > "$TEMP_FILE"
fi

# Count files
FILE_COUNT=$(wc -l < "$TEMP_FILE" | tr -d ' ')

if [[ $FILE_COUNT -eq 0 ]]; then
  echo "No files found in bucket $BUCKET_NAME."
  exit 0
fi

echo "Found $FILE_COUNT files in bucket $BUCKET_NAME."

# Show sample of files
echo "Sample of files to be deleted:"
head -n 5 "$TEMP_FILE"
if [[ $FILE_COUNT -gt 5 ]]; then
  echo "... and $(($FILE_COUNT - 5)) more files"
fi

# If not in dry run mode, ask for confirmation
if [[ "$DRY_RUN" == "false" ]]; then
  echo
  echo "WARNING: You are about to DELETE ALL $FILE_COUNT FILES from bucket '$BUCKET_NAME'."
  echo "THIS ACTION CANNOT BE UNDONE."
  echo
  read -p "Type 'DELETE ALL' to confirm: " CONFIRMATION
  
  if [[ "$CONFIRMATION" != "DELETE ALL" ]]; then
    echo "Deletion cancelled."
    exit 1
  fi
  
  echo "Proceeding with deletion..."
else
  echo "DRY RUN: Would delete $FILE_COUNT files."
  exit 0
fi

# Delete all objects
SUCCESS_COUNT=0
FAILED_COUNT=0

while IFS= read -r FILE_KEY; do
  echo "Deleting: $FILE_KEY"
  if wrangler r2 object delete "$BUCKET_NAME/$FILE_KEY" --remote >/dev/null 2>&1; then
    ((SUCCESS_COUNT++))
  else
    echo "Failed to delete: $FILE_KEY"
    ((FAILED_COUNT++))
  fi
  
  # Show progress every 10 files
  if [[ $((SUCCESS_COUNT % 10)) -eq 0 ]]; then
    echo "Progress: $SUCCESS_COUNT/$FILE_COUNT files deleted"
  fi
done < "$TEMP_FILE"

# Report results
echo
echo "Deletion complete."
echo "Successfully deleted: $SUCCESS_COUNT files"
if [[ $FAILED_COUNT -gt 0 ]]; then
  echo "Failed to delete: $FAILED_COUNT files"
  exit 1
else
  echo "All files successfully deleted from bucket '$BUCKET_NAME'."
fi 