#!/bin/bash
cd "/Users/georgegood/Desktop/Auto Shorts Web App/web/backend"
echo "Starting backend server on port 8000..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
