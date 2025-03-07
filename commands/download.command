#!/bin/bash

# Reddit Content Downloader Command
# This script launches the download.py script (formerly reddit_downloader.py)

# Change to the app root directory
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 1

# Activate virtual environment
source "$APP_DIR/venv/bin/activate"

# Run the download script with all arguments
"$APP_DIR/venv/bin/python3" scripts/download.py "$@"
exit_code=$?

# Prompt before closing
read -p "Press Enter to close..."
exit $exit_code 