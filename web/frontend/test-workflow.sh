#!/bin/bash
# Test Workflow Script
# This script demonstrates the full test workflow: running tests and cleaning up afterward

echo "========== Auto Shorts Test Workflow =========="
echo "1. Running Playwright tests (with mock audio)"
echo "=============================================="
NEXT_PUBLIC_MOCK_AUDIO=true npm test

# Get the exit code from the tests
TEST_EXIT_CODE=$?

echo ""
echo "========== Cleaning Up Test Projects =========="
echo "2. Running cleanup script to remove test projects and R2 files"
echo "================================================"
npm run cleanup

echo ""
echo "========== Test Workflow Summary =========="
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✅ Tests passed successfully"
else
  echo "❌ Tests failed with exit code $TEST_EXIT_CODE"
fi
echo "✅ Cleanup completed"
echo "=========================================="

# Return the test exit code as the script's exit code
exit $TEST_EXIT_CODE 