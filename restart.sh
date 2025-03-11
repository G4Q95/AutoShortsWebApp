#!/bin/bash
# Enhanced restart script for Auto Shorts Web App v4
# This script offers flexibility in how servers are launched

# Parse command line arguments
EXTERNAL=false
HELP=false

for arg in "$@"
do
    case $arg in
        --external|-e)
        EXTERNAL=true
        shift
        ;;
        --help|-h)
        HELP=true
        shift
        ;;
    esac
done

# Display help if requested
if [ "$HELP" = true ]; then
    echo "Usage: ./restart.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --external, -e    Launch servers in external terminal windows (useful for monitoring)"
    echo "  --help, -h        Display this help message"
    echo ""
    echo "Without options, servers will run in the current terminal (good for Cursor IDE)"
    exit 0
fi

# Display header with better formatting
echo -e "\033[1;34m====================================================\033[0m"
if [ "$EXTERNAL" = true ]; then
    echo -e "\033[1;34m     AUTO SHORTS SERVER STARTER v4 (EXTERNAL)      \033[0m"
    echo -e "\033[1;34m====================================================\033[0m"
    echo -e "\033[1;33mWill launch servers in dedicated terminal windows!\033[0m"
else
    echo -e "\033[1;34m    AUTO SHORTS SERVER STARTER v4 (IN-CURSOR)      \033[0m"
    echo -e "\033[1;34m====================================================\033[0m"
    echo -e "\033[1;33mWill launch servers in the current terminal environment!\033[0m"
fi
echo ""

# Define color codes for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Function to check if a process is running
is_process_running() {
    if ps -p $1 > /dev/null; then
        return 0 # True, process is running
    else
        return 1 # False, process is not running
    fi
}

# Function to kill a process if it exists
kill_process() {
    if is_process_running $1; then
        echo -e "${YELLOW}Killing process $1...${NC}"
        kill -9 $1 2>/dev/null
        sleep 1
    fi
}

# Function to ensure a port is completely free before proceeding
ensure_port_is_free() {
    local port=$1
    local max_attempts=5
    local attempt=1
    
    echo -e "${BLUE}Ensuring port $port is free...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if lsof -i:$port -sTCP:LISTEN &> /dev/null; then
            local pid=$(lsof -ti:$port)
            echo -e "${YELLOW}Attempt $attempt: Port $port is still in use by PID $pid. Terminating...${NC}"
            kill -9 $pid 2>/dev/null
            sleep 2
            attempt=$((attempt+1))
        else
            echo -e "${GREEN}Port $port is free${NC}"
            return 0
        fi
    done
    
    echo -e "${RED}Failed to free port $port after $max_attempts attempts.${NC}"
    echo -e "${RED}Please manually check and kill processes using: lsof -i:$port${NC}"
    return 1
}

# Check if we're in the right directory
if [ ! -d "web/frontend" ] || [ ! -d "web/backend" ]; then
    echo -e "${RED}ERROR: Missing required directories. Make sure you're running this from the project root.${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Verify Python and Node.js are installed
echo -e "${BLUE}Verifying environment...${NC}"
if ! command -v python &> /dev/null; then
    echo -e "${RED}ERROR: Python not found. Please install Python and try again.${NC}"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js not found. Please install Node.js and try again.${NC}"
    exit 1
fi

# Make sure ports 3000 and 8000 are free
echo -e "${BLUE}Ensuring ports are available...${NC}"
ensure_port_is_free 3000 || exit 1
ensure_port_is_free 8000 || exit 1

# Clean up any zombie processes from previous runs
echo -e "${BLUE}Cleaning up any previous server processes...${NC}"
pkill -f "python -m app.main" 2>/dev/null
pkill -f "python -m uvicorn app.main:app" 2>/dev/null
pkill -f "node.*next dev" 2>/dev/null
sleep 1

# Clean Next.js cache
echo -e "${BLUE}Cleaning Next.js cache...${NC}"
if [ -d "web/frontend/.next" ]; then
    rm -rf web/frontend/.next
    echo -e "${GREEN}Cleaned .next directory${NC}"
else
    echo "No .next directory found, continuing..."
fi

# Create logs directory if it doesn't exist
mkdir -p logs

# Choose between external terminal windows or in-cursor mode
if [ "$EXTERNAL" = true ]; then
    # Get the absolute path of the project root
    PROJECT_ROOT=$(pwd)

    # Create scripts for each server that will run in dedicated terminals
    # These scripts will have proper environment and path settings

    # Backend script
    cat > backend_start.sh << EOF
#!/bin/bash
cd "${PROJECT_ROOT}/web/backend"
echo "Starting backend server on port 8000..."
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
EOF

    # Frontend script
    cat > frontend_start.sh << EOF
#!/bin/bash
cd "${PROJECT_ROOT}/web/frontend"
echo "Starting frontend server on port 3000..."
npm run dev
EOF

    # Make the scripts executable
    chmod +x backend_start.sh frontend_start.sh

    # On macOS, we can use the 'open' command to open new Terminal windows
    # This will open a new Terminal window for each server
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${BLUE}Detected macOS, opening terminals for servers...${NC}"
        
        # Open a new terminal window for the backend
        open -a Terminal.app backend_start.sh
        echo -e "${GREEN}✓ Backend terminal window opened${NC}"
        
        # Wait a couple seconds before starting the frontend
        sleep 2
        
        # Open a new terminal window for the frontend
        open -a Terminal.app frontend_start.sh
        echo -e "${GREEN}✓ Frontend terminal window opened${NC}"
        
        echo -e "${YELLOW}Note: Each server is now running in its own Terminal window.${NC}"
        echo -e "${YELLOW}You can close those windows to stop the servers.${NC}"
        
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # For Linux, try to use gnome-terminal, xterm, or other terminals
        echo -e "${BLUE}Detected Linux, opening terminals for servers...${NC}"
        
        if command -v gnome-terminal &> /dev/null; then
            gnome-terminal -- bash -c "${PROJECT_ROOT}/backend_start.sh; bash"
            sleep 2
            gnome-terminal -- bash -c "${PROJECT_ROOT}/frontend_start.sh; bash"
        elif command -v xterm &> /dev/null; then
            xterm -e "bash ${PROJECT_ROOT}/backend_start.sh" &
            sleep 2
            xterm -e "bash ${PROJECT_ROOT}/frontend_start.sh" &
        else
            echo -e "${RED}Could not find a suitable terminal emulator.${NC}"
            echo -e "${YELLOW}Please run these scripts manually:${NC}"
            echo -e "  ${BOLD}./backend_start.sh${NC}"
            echo -e "  ${BOLD}./frontend_start.sh${NC}"
        fi
    else
        # For Windows or other platforms, we'll just tell the user to run the scripts
        echo -e "${YELLOW}Could not automatically open terminal windows on this platform.${NC}"
        echo -e "${YELLOW}Please run these scripts manually in separate terminals:${NC}"
        echo -e "  ${BOLD}./backend_start.sh${NC}"
        echo -e "  ${BOLD}./frontend_start.sh${NC}"
    fi

    echo ""
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}       SERVERS STARTING IN TERMINAL WINDOWS          ${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo ""
    echo -e "${BLUE}Backend Server:${NC} Running in a dedicated terminal window"
    echo -e "${BLUE}Frontend Server:${NC} Running in a dedicated terminal window"
    echo ""
    echo -e "${YELLOW}To stop servers:${NC}"
    echo -e "1. Press Ctrl+C in each terminal window running a server"
    echo -e "2. Or close the terminal windows"
    echo ""
    echo -e "${GREEN}Access your app at: http://localhost:3000${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "- If you don't see new terminal windows, run the scripts manually:"
    echo -e "  Backend: ${BOLD}./backend_start.sh${NC}"
    echo -e "  Frontend: ${BOLD}./frontend_start.sh${NC}"
    echo -e "- If you see 'Backend Disconnected' in the browser, wait a few more seconds"
    echo -e "- Make sure your virtual environment is activated before running scripts manually"

else
    # In-Cursor mode: Run servers in the current terminal environment
    # This is better for use within Cursor IDE
    
    # Start backend server with proper error handling
    echo -e "${BLUE}Starting backend server...${NC}"
    cd web/backend || { echo -e "${RED}Failed to change to backend directory${NC}"; exit 1; }
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started with PID: $BACKEND_PID"

    # Give backend some time to initialize
    echo -e "${YELLOW}Waiting for backend to initialize...${NC}"
    sleep 3

    # Check if backend is running and listening on port 8000
    if ! is_process_running $BACKEND_PID; then
        echo -e "${RED}ERROR: Backend process failed to start or exited immediately!${NC}"
        echo -e "${YELLOW}Last few lines of backend log:${NC}"
        tail -n 10 ../../logs/backend.log
        echo ""
        echo -e "${RED}Troubleshooting suggestion: Try starting the backend manually:${NC}"
        echo -e "cd web/backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
        exit 1
    fi

    # Verify backend port is open
    if ! lsof -i:8000 -sTCP:LISTEN | grep -q $BACKEND_PID; then
        echo -e "${RED}ERROR: Backend is not listening on port 8000!${NC}"
        echo -e "${YELLOW}Trying one more time with a longer startup delay...${NC}"
        sleep 5
        
        if ! lsof -i:8000 -sTCP:LISTEN | grep -q .; then
            echo -e "${RED}ERROR: Backend still not listening on port 8000 after retry.${NC}"
            echo -e "${YELLOW}Last few lines of backend log:${NC}"
            tail -n 15 ../../logs/backend.log
            echo -e "${RED}Killing stale backend process...${NC}"
            kill_process $BACKEND_PID
            echo -e "${RED}Troubleshooting suggestion: Run backend manually and check for errors:${NC}"
            echo -e "cd web/backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
            exit 1
        fi
    fi

    echo -e "${GREEN}✓ Backend successfully started and listening on port 8000${NC}"

    # Change to frontend directory
    echo -e "${BLUE}Starting frontend server...${NC}"
    cd ../frontend || { echo -e "${RED}Failed to change to frontend directory${NC}"; exit 1; }

    # Start frontend server
    PORT=3000 npm run dev > ../../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo "Frontend started with PID: $FRONTEND_PID"

    # Give frontend time to initialize
    echo -e "${YELLOW}Waiting for frontend to initialize...${NC}"
    sleep 5

    # Check if frontend is running
    if ! is_process_running $FRONTEND_PID; then
        echo -e "${RED}ERROR: Frontend process failed to start or exited immediately!${NC}"
        echo -e "${YELLOW}Last few lines of frontend log:${NC}"
        tail -n 15 ../../logs/frontend.log
        echo ""
        echo -e "${RED}Killing stale backend process before exit...${NC}"
        kill_process $BACKEND_PID
        echo -e "${RED}Troubleshooting suggestion: Try starting the frontend manually:${NC}"
        echo -e "cd web/frontend && npm run dev"
        exit 1
    fi

    # Verify frontend port is open
    if ! lsof -i:3000 -sTCP:LISTEN | grep -q .; then
        echo -e "${RED}ERROR: No process is listening on port 3000!${NC}"
        echo -e "${YELLOW}Last few lines of frontend log:${NC}"
        tail -n 15 ../../logs/frontend.log
        echo ""
        echo -e "${RED}Killing stale processes before exit...${NC}"
        kill_process $BACKEND_PID
        kill_process $FRONTEND_PID
        echo -e "${RED}Troubleshooting suggestion: Try starting the frontend manually:${NC}"
        echo -e "cd web/frontend && npm run dev"
        exit 1
    fi

    echo -e "${GREEN}✓ Frontend successfully started and listening on port 3000${NC}"

    # Return to the original directory
    cd ../..

    # Perform a simple connectivity test
    echo -e "${BLUE}Testing backend connectivity...${NC}"
    curl -s http://localhost:8000/health > /dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backend API is responding${NC}"
    else
        echo -e "${YELLOW}! Backend health check failed. API might not be fully initialized yet.${NC}"
        echo -e "${YELLOW}  Try accessing the application after a few seconds.${NC}"
    fi

    echo ""
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${GREEN}              SERVERS STARTED                        ${NC}"
    echo -e "${GREEN}=====================================================${NC}"
    echo -e "${BOLD}Backend:${NC} PID $BACKEND_PID on port 8000"
    echo -e "${BOLD}Frontend:${NC} PID $FRONTEND_PID on port 3000"
    echo ""
    echo -e "${YELLOW}To stop servers:${NC}"
    echo -e "1. Press Ctrl+C in each terminal window running a server"
    echo -e "2. Or use: ${BOLD}kill -9 $BACKEND_PID $FRONTEND_PID${NC}"
    echo ""
    echo -e "${GREEN}Access your app at: http://localhost:3000${NC}"
    echo ""
    echo -e "${BLUE}Log files:${NC}"
    echo -e "Backend log: $(pwd)/logs/backend.log"
    echo -e "Frontend log: $(pwd)/logs/frontend.log"
    echo ""
    echo -e "${YELLOW}To follow logs in real-time, run:${NC}"
    echo -e "  Backend: ${BOLD}tail -f $(pwd)/logs/backend.log${NC}"
    echo -e "  Frontend: ${BOLD}tail -f $(pwd)/logs/frontend.log${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting:${NC}"
    echo -e "- If you see 'Backend Disconnected' in the browser, check logs/backend.log"
    echo -e "- If frontend shows no content, check logs/frontend.log" 
    echo -e "- Try reloading the page if initial load fails"
    echo -e "- If issues persist, try running the servers manually:"
    echo -e "  Backend: cd web/backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
    echo -e "  Frontend: cd web/frontend && npm run dev"
fi 