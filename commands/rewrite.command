#!/bin/bash

# ChatGPT Content Rewriter Command
# This script launches the rewrite.py script (formerly chatgpt_rewriter.py)

# Change to the app root directory
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 1

# Activate virtual environment
source "$APP_DIR/venv/bin/activate"

# Run the rewrite script with all arguments
"$APP_DIR/venv/bin/python3" scripts/rewrite.py "$@"
exit_code=$?

# Prompt before closing
read -p "Press Enter to close..."
exit $exit_code 