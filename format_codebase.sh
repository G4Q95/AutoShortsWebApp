#!/bin/bash
set -e

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Auto Shorts Web App Code Formatting Tool ===${NC}"
echo ""

# Function to print section header
print_header() {
  echo -e "${GREEN}$1${NC}"
  echo "---------------------------------------------"
}

# Function to handle errors
handle_error() {
  echo -e "${RED}Error: $1${NC}"
  exit 1
}

# Check if directories exist
if [ ! -d "web/frontend" ]; then
  handle_error "Frontend directory 'web/frontend' not found"
fi

if [ ! -d "web/backend" ]; then
  handle_error "Backend directory 'web/backend' not found"
fi

# Frontend formatting and linting
print_header "Frontend (Next.js/React) Formatting and Linting"

echo "Running ESLint fix..."
cd web/frontend
npm run lint:fix || handle_error "ESLint failed"

echo "Running Prettier format..."
npm run format || handle_error "Prettier failed"

cd ../..
echo -e "${GREEN}✓ Frontend formatting and linting completed${NC}"
echo ""

# Backend formatting and linting
print_header "Backend (FastAPI/Python) Formatting and Linting"

echo "Running isort..."
cd web/backend
isort . || handle_error "isort failed"

echo "Running Black..."
black . || handle_error "Black failed"

echo "Checking with Flake8..."
flake8 . || echo -e "${YELLOW}⚠ Flake8 found issues (see above)${NC}"

echo "Running mypy type checking..."
mypy app/ || echo -e "${YELLOW}⚠ mypy found type issues (see above)${NC}"

cd ../..
echo -e "${GREEN}✓ Backend formatting and linting completed${NC}"
echo ""

echo -e "${GREEN}✅ All formatting and linting tasks completed${NC}"
echo "Note: Some warnings might still need manual attention" 