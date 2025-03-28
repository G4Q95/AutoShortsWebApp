#!/bin/bash

# Script to check logs for deletion-related entries

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print logs with colors based on keywords
function print_colored_log() {
    local line="$1"
    
    if [[ "$line" == *"ERROR"* ]] || [[ "$line" == *"error"* ]]; then
        echo -e "${RED}$line${NC}"
    elif [[ "$line" == *"CLEANUP-PROJECT"* ]]; then
        echo -e "${GREEN}$line${NC}"
    elif [[ "$line" == *"DELETE-DIR"* ]]; then
        echo -e "${BLUE}$line${NC}"
    elif [[ "$line" == *"STORAGE-PATH"* ]]; then
        echo -e "${YELLOW}$line${NC}"
    else
        echo "$line"
    fi
}

# Get the project ID from command line
PROJECT_ID=${1:-""}

if [ -z "$PROJECT_ID" ]; then
    echo "Please provide a project ID to search for"
    echo "Usage: $0 <project_id>"
    exit 1
fi

echo "Checking logs for project ID: $PROJECT_ID"

# Get container ID
CONTAINER_ID=$(docker-compose ps -q backend)

if [ -z "$CONTAINER_ID" ]; then
    echo "Backend container not found! Make sure it's running."
    exit 1
fi

echo "Found backend container: $CONTAINER_ID"
echo "===================================="

# Get logs and filter for relevant messages
echo "Filtering logs for CLEANUP-PROJECT, DELETE-DIR, and STORAGE-PATH entries..."
echo "===================================="

docker logs $CONTAINER_ID 2>&1 | grep -i -E "(CLEANUP-PROJECT|DELETE-DIR|STORAGE-PATH|$PROJECT_ID)" | while read -r line; do
    print_colored_log "$line"
done

echo "===================================="
echo "Log check complete!"

# Add instruction for troubleshooting
echo ""
echo "To see the full logs, run: docker-compose logs backend"
echo "To restart the backend after making code changes: docker-compose restart backend" 