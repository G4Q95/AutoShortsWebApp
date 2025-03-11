#!/bin/bash

echo "===== AUTO SHORTS WEB APP - CODE FORMATTING SCRIPT ====="
echo ""

# Format frontend code
echo "--- Formatting Frontend Code ---"
cd web/frontend
npm run format
npm run lint:fix
cd ../..
echo ""

# Format backend code
echo "--- Formatting Backend Code ---"
cd web/backend
source $(which python3 &>/dev/null && echo venv/bin/activate || echo env/Scripts/activate)
isort .
black .
flake8 .
cd ../..
echo ""

echo "Formatting completed! 🎉" 