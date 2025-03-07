#!/bin/bash

# Setup script for Auto Shorts Web App
echo "Setting up Auto Shorts Web App..."

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "Installing dependencies..."
pip install -r requirements.txt

# Make scripts executable
chmod +x commands/*.command
chmod +x scripts/*.py

echo "Setup complete! You can now use the download.command to run the Reddit downloader." 