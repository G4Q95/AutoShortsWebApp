#!/bin/bash

# Auto Shorts - Voice Generation Command
# This script runs the google_to_elevenlabs.py script to generate voice narration

# Change to the app root directory
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR" || exit 1

# Activate virtual environment
source "$APP_DIR/venv/bin/activate"

# Run the Python script (interactive mode)
python3 "$APP_DIR/scripts/google_to_elevenlabs.py"
exit_code=$?

# Prompt before closing
read -p "Press Enter to close..."
exit $exit_code 