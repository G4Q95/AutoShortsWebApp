#!/bin/bash

# Format code with isort and black
echo "Running isort..."
isort .

echo "Running black..."
black .

# Run linters
echo "Running flake8..."
flake8 .

echo "Running mypy..."
mypy app/

echo "Linting and formatting completed!" 