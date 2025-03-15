#!/bin/bash

# Usage: 
# From host: docker-compose exec frontend bash -c "./run-tests.sh [test-pattern]"
# From container: ./run-tests.sh [test-pattern]

# Set environment variables for testing
export NEXT_PUBLIC_TESTING_MODE=true
export NEXT_PUBLIC_API_URL=http://backend:8000

# Clear previous test results
rm -rf test-results/* || true

# Set default test command
TEST_CMD="npx playwright test tests/e2e/core-functionality.spec.ts"

# If a test pattern is provided, add it to the command
if [ ! -z "$1" ]; then
  TEST_CMD="$TEST_CMD --grep \"$1\""
fi

# Run the test with full output
echo "Running tests: $TEST_CMD"
echo "----------------------------------------"
eval $TEST_CMD

# Check exit code
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
  echo "----------------------------------------"
  echo "✅ All tests passed!"
else
  echo "----------------------------------------"
  echo "❌ Tests failed with exit code $EXIT_CODE"
  echo "See test results in the test-results directory"
  echo "Or run: npx playwright show-report"
fi

exit $EXIT_CODE 