#!/bin/bash

# This script runs the FastAPI backend in development mode

# Check if virtual environment exists, if not create it
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Run the FastAPI server with hot reload
echo "Starting FastAPI server..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001 