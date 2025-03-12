#!/bin/bash

# Server Management Script for Auto Shorts Web App
# This script helps manage the various server processes and avoid port conflicts

# Define colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Define ports
BACKEND_PORT=8000
FRONTEND_PORT=3000
BROWSER_TOOLS_PORT=8555

# Function to check if a port is already in use
is_port_in_use() {
  if lsof -i ":$1" &> /dev/null; then
    return 0 # Port is in use
  else
    return 1 # Port is free
  fi
}

# Function to kill process using a specific port
kill_port_process() {
  echo -e "${YELLOW}Attempting to kill process using port $1...${NC}"
  
  # Get the PID of the process using the port
  local PID=$(lsof -t -i:$1)
  
  if [ -n "$PID" ]; then
    echo -e "${YELLOW}Killing process (PID: $PID) using port $1...${NC}"
    kill -9 $PID
    echo -e "${GREEN}Process terminated.${NC}"
  else
    echo -e "${RED}No process found using port $1.${NC}"
  fi
}

# Function to start backend server
start_backend() {
  echo -e "${BLUE}Starting backend server...${NC}"
  
  if is_port_in_use $BACKEND_PORT; then
    echo -e "${RED}Port $BACKEND_PORT is already in use.${NC}"
    read -p "Would you like to kill the process using this port? (y/n): " choice
    
    if [[ $choice == "y" || $choice == "Y" ]]; then
      kill_port_process $BACKEND_PORT
    else
      echo -e "${RED}Cannot start backend server. Port $BACKEND_PORT is already in use.${NC}"
      return 1
    fi
  fi
  
  cd web/backend
  echo -e "${GREEN}Starting backend server on port $BACKEND_PORT...${NC}"
  uvicorn app.main:app --reload --host 127.0.0.1 --port $BACKEND_PORT &
  BACKEND_PID=$!
  echo -e "${GREEN}Backend server started with PID: $BACKEND_PID${NC}"
  cd ../..
}

# Function to start frontend server
start_frontend() {
  echo -e "${BLUE}Starting frontend server...${NC}"
  
  if is_port_in_use $FRONTEND_PORT; then
    echo -e "${RED}Port $FRONTEND_PORT is already in use.${NC}"
    read -p "Would you like to kill the process using this port? (y/n): " choice
    
    if [[ $choice == "y" || $choice == "Y" ]]; then
      kill_port_process $FRONTEND_PORT
    else
      echo -e "${RED}Cannot start frontend server. Port $FRONTEND_PORT is already in use.${NC}"
      return 1
    fi
  fi
  
  cd web/frontend
  echo -e "${GREEN}Starting frontend server on port $FRONTEND_PORT...${NC}"
  npm run dev &
  FRONTEND_PID=$!
  echo -e "${GREEN}Frontend server started with PID: $FRONTEND_PID${NC}"
  cd ../..
}

# Function to start browser tools server
start_browser_tools() {
  echo -e "${BLUE}Starting browser tools server...${NC}"
  
  if is_port_in_use $BROWSER_TOOLS_PORT; then
    echo -e "${RED}Port $BROWSER_TOOLS_PORT is already in use.${NC}"
    read -p "Would you like to kill the process using this port? (y/n): " choice
    
    if [[ $choice == "y" || $choice == "Y" ]]; then
      kill_port_process $BROWSER_TOOLS_PORT
    else
      echo -e "${RED}Cannot start browser tools server. Port $BROWSER_TOOLS_PORT is already in use.${NC}"
      return 1
    fi
  fi
  
  echo -e "${GREEN}Starting browser tools server on port $BROWSER_TOOLS_PORT...${NC}"
  npx browser-tools-server &
  BROWSER_TOOLS_PID=$!
  echo -e "${GREEN}Browser tools server started with PID: $BROWSER_TOOLS_PID${NC}"
}

# Function to stop all servers
stop_all() {
  echo -e "${BLUE}Stopping all servers...${NC}"
  
  # Kill backend server if port is in use
  if is_port_in_use $BACKEND_PORT; then
    kill_port_process $BACKEND_PORT
  else
    echo -e "${YELLOW}Backend server is not running.${NC}"
  fi
  
  # Kill frontend server if port is in use
  if is_port_in_use $FRONTEND_PORT; then
    kill_port_process $FRONTEND_PORT
  else
    echo -e "${YELLOW}Frontend server is not running.${NC}"
  fi
  
  # Kill browser tools server if port is in use
  if is_port_in_use $BROWSER_TOOLS_PORT; then
    kill_port_process $BROWSER_TOOLS_PORT
  else
    echo -e "${YELLOW}Browser tools server is not running.${NC}"
  fi
  
  echo -e "${GREEN}All servers stopped.${NC}"
}

# Function to restart all servers
restart_all() {
  echo -e "${BLUE}Restarting all servers...${NC}"
  stop_all
  sleep 1
  start_all
}

# Function to start all servers
start_all() {
  echo -e "${BLUE}Starting all servers...${NC}"
  start_backend
  sleep 1
  start_frontend
  sleep 1
  start_browser_tools
  
  echo -e "${GREEN}All servers started. Available at:${NC}"
  echo -e "${GREEN}- Frontend: http://localhost:${FRONTEND_PORT}${NC}"
  echo -e "${GREEN}- Backend: http://localhost:${BACKEND_PORT}${NC}"
  echo -e "${GREEN}- Browser Tools: http://localhost:${BROWSER_TOOLS_PORT}${NC}"
}

# Function to check status of all servers
check_status() {
  echo -e "${BLUE}Checking server status...${NC}"
  
  # Check backend server
  if is_port_in_use $BACKEND_PORT; then
    echo -e "${GREEN}Backend server is running on port $BACKEND_PORT.${NC}"
  else
    echo -e "${RED}Backend server is not running.${NC}"
  fi
  
  # Check frontend server
  if is_port_in_use $FRONTEND_PORT; then
    echo -e "${GREEN}Frontend server is running on port $FRONTEND_PORT.${NC}"
  else
    echo -e "${RED}Frontend server is not running.${NC}"
  fi
  
  # Check browser tools server
  if is_port_in_use $BROWSER_TOOLS_PORT; then
    echo -e "${GREEN}Browser tools server is running on port $BROWSER_TOOLS_PORT.${NC}"
  else
    echo -e "${RED}Browser tools server is not running.${NC}"
  fi
}

# Print usage instructions
print_usage() {
  echo -e "${BLUE}Auto Shorts Web App Server Manager${NC}"
  echo -e "Usage: $0 [command]"
  echo -e "\nCommands:"
  echo -e "  start       Start all servers"
  echo -e "  stop        Stop all servers"
  echo -e "  restart     Restart all servers"
  echo -e "  status      Check status of all servers"
  echo -e "  backend     Start only the backend server"
  echo -e "  frontend    Start only the frontend server"
  echo -e "  tools       Start only the browser tools server"
  echo -e "  help        Display this help message"
}

# Main logic
case "$1" in
  start)
    start_all
    ;;
  stop)
    stop_all
    ;;
  restart)
    restart_all
    ;;
  status)
    check_status
    ;;
  backend)
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  tools)
    start_browser_tools
    ;;
  help|*)
    print_usage
    ;;
esac

exit 0 