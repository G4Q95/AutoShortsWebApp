#!/bin/bash
# Script to start development servers
# NOTE: Before running this script, manually terminate any existing servers with Ctrl+C

echo "===== AUTO SHORTS SERVER STARTER ====="
echo "Make sure you've manually terminated any existing Node.js and Python servers before running this script."
echo ""

# Clean Next.js cache for a fresh start
echo "Cleaning Next.js cache..."
rm -rf web/frontend/.next

# Start backend server
echo "Starting backend server..."
cd web/backend && python -m app.main &
BACKEND_PID=$!

# Wait for backend to initialize
echo "Waiting for backend to initialize..."
sleep 2

# Start frontend server
echo "Starting frontend server..."
cd ../frontend && PORT=3000 npm run dev &
FRONTEND_PID=$!

echo ""
echo "===== SERVERS STARTED ====="
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo ""
echo "To stop servers manually:"
echo "1. Press Ctrl+C in each terminal window running a server"
echo "2. Or use: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Access your app at: http://localhost:3000" 