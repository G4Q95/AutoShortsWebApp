#!/bin/bash

# Media Merger Command
# This script launches the merge.sh script

# Change to the app root directory
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 1

# Activate virtual environment
source "$APP_DIR/venv/bin/activate"

# Run the merge script with all arguments
"$APP_DIR/scripts/merge.sh" "$@"
exit_code=$?

# Prompt before closing
read -p "Press Enter to close..."
exit $exit_code 