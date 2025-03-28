#!/bin/bash

# Cleanup script for R2 troubleshooting files
# This script removes test files and debugging scripts created during
# the R2 file deletion troubleshooting process

echo "Starting cleanup of R2 troubleshooting files..."

# Directory containing backend code
BACKEND_DIR="../web/backend"

# List of test files to remove
TEST_FILES=(
  "test_tls.py"
  "test_tls_connection.py"
  "test_mongo.py"
  "test_mongo_atlas.py"
  "test_mongodb_ssl.py"
  "apply_db_fix.py"
  "fix_database.py"
  "database_fixed.py"
)

# Backup directory
BACKUP_DIR="${BACKEND_DIR}/cleanup_backup_$(date +%Y%m%d%H%M%S)"

# Create backup directory
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Move files to backup directory
for file in "${TEST_FILES[@]}"; do
  if [ -f "${BACKEND_DIR}/${file}" ]; then
    echo "Backing up ${file}..."
    cp "${BACKEND_DIR}/${file}" "${BACKUP_DIR}/"
    echo "Removing ${file}..."
    rm "${BACKEND_DIR}/${file}"
  else
    echo "File ${file} not found, skipping."
  fi
done

# Check if we need to revert Docker changes
read -p "Do you want to revert Wrangler-related Docker changes? (y/n): " revert_docker

if [ "$revert_docker" == "y" ] || [ "$revert_docker" == "Y" ]; then
  if [ -f "${BACKEND_DIR}/Dockerfile.backup" ]; then
    echo "Restoring original Dockerfile..."
    cp "${BACKEND_DIR}/Dockerfile.backup" "${BACKEND_DIR}/Dockerfile"
    echo "Dockerfile restored."
  else
    echo "No Dockerfile backup found. Please manually update the Dockerfile to remove Wrangler."
  fi
else
  echo "Skipping Docker reversion. You can manually update the Dockerfile later."
fi

echo ""
echo "Cleanup completed. Files have been backed up to $BACKUP_DIR"
echo "Next steps:"
echo "1. Review docker-compose.yml to remove Wrangler-specific environment variables"
echo "2. Update .env file to remove Wrangler-specific variables"
echo "3. Implement the Cloudflare Workers approach as outlined in docs/Cloudflare-R2-Reconfig-Part-4.md"
echo "" 