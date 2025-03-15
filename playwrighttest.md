# Playwright Test Status

## Overview
This document tracks the status of our Playwright E2E test suite for the Auto Shorts Web App. It provides a comprehensive reference for the current state of tests, recent changes, and known issues.

## Test Suite Purpose

Our Playwright test suite is designed to verify the core functionality of the Auto Shorts Web App, including:

1. Home page navigation and basic UI elements
2. Project creation and management
3. Scene addition from Reddit URLs
4. Content extraction and media display
5. Scene reordering via drag-and-drop
6. Scene deletion
7. Audio generation and persistence (recently added)

The primary goal of these tests is to provide a safety net during refactoring and feature development. As we plan to refactor portions of the codebase in upcoming sprints, these tests help ensure that existing functionality remains intact while we make architectural improvements.

## Test Structure

Tests are located in `web/frontend/tests/e2e/` with the main test file being `core-functionality.spec.ts`.

### Helper Functions

The test suite includes several helper functions to improve reliability:

- `waitForWorkspace` - Waits for the project workspace to load properly
- `findElementWithText` - Finds elements containing specific text
- `elementWithTextExists` - Checks if elements with specific text exist
- `waitForElementWithText` - Waits for elements with specific text to appear
- `closeVoiceSettingsIfOpen` - Utility to close voice settings panel if open 
- `waitForScenes` - Waits for scene elements with multiple selector strategies

### Test Cases

The test suite includes the following test cases:

1. **Home page loads correctly** - PASSING
   - Verifies the home page loads with correct title and navigation

2. **Navigation works correctly** - PASSING  
   - Checks navigation between main pages works properly

3. **Project creation works** - PASSING
   - Verifies project creation, naming, and workspace loading

4. **Adding scenes works correctly** - PASSING
   - Tests adding scenes from Reddit URLs
   - Verifies media content appears correctly

5. **Scene reordering works** - PASSING
   - Tests drag-and-drop reordering of scenes

6. **Existing project functionality** - PASSING
   - Tests navigating to existing projects
   - Verifies state persistence and manipulation

7. **Audio generation and playback** - FAILING
   - Tests voice generation integration
   - Checks for audio elements and playback controls
   - This test was recently added and is still being stabilized

## Current Status

- **Tests Passing**: 6/7
- **Tests Failing**: 1/7 (Audio generation and playback)
- **Last Run Date**: March 31, 2023

## Recent Changes

1. **Added Audio Generation Test**
   - Created a new test case for the voice API integration
   - Implemented checks for voice controls, generation buttons
   - Added verification of API calls and audio element presence

2. **Enhanced Test Resilience**
   - Added `waitForScenes` helper with multiple selector strategies
   - Implemented progressive selector fallback
   - Added detailed logging and screenshots for debugging
   - Fixed URL verification issue in the existing project test

3. **Docker Integration**
   - All tests now run within Docker containers
   - Frontend, backend, and browser-tools-server are containerized
   - Tests require all Docker services to be running

## Known Issues

### 1. Audio Generation Test Failure

**Symptoms:**
- The test times out after 60 seconds waiting for audio elements
- The test successfully triggers API calls to the voice API
- Audio elements are not being detected with current selectors

**What We've Tried:**
- Implemented a comprehensive selector system to find audio elements
- Added DOM scanning to find audio-related elements
- Tried multiple selector strategies (class-based, attribute-based, etc.)
- Added fallback mechanisms when audio elements aren't found
- Implemented API call detection as alternative success criteria
- Added extensive logging and screenshots for debugging

**Specific Failed Approaches:**
1. **Direct Selector Approach**: 
   - Using `page.waitForSelector('audio[src]')` - Failed with timeout
   - Using `page.locator('audio').first()` - Failed to find element
   - Using `page.locator('[class*="audio-player"]')` - Element not found

2. **API-based Verification**:
   - Added network monitoring with `page.on('request')` to track API calls
   - Successfully detected API calls but couldn't correlate with UI changes

3. **DOM Traversal**:
   - Used `page.evaluate()` to scan entire DOM for audio elements
   - Found some elements in DOM but couldn't interact with them properly
   - Tried direct click actions on coordinates where controls should be

4. **Timeout Adjustments**:
   - Increased timeouts from 30s to 60s - Still failed with timeouts
   - Added stabilization delays - Didn't resolve detection issues

5. **Alternative Element Detection**:
   - Tried finding play buttons instead of audio elements
   - Looked for volume controls as proxies for audio presence
   - Both approaches failed to reliably identify elements

**Current Hypothesis:**
- Audio elements may be rendered in a different way than expected in the test environment
- React may be mounting/unmounting audio elements in ways that break selector continuity
- There might be timing issues with the voice generation API responses in the Docker environment
- The audio element might be in an iframe or shadow DOM that's not directly accessible

### 2. TypeScript Linter Errors

**Symptoms:**
- "Property 'toBe' does not exist on type 'never'" error for the `elevenlabsApiCalled` variable
- Type annotations needed for proper Playwright test functions

**What We've Tried:**
- Added type annotations for the `elevenlabsApiCalled` variable: `let elevenlabsApiCalled: boolean = false`
- Received the same error despite adding the type annotation
- TypeScript type inference issues persisted despite explicit typing

## Environment Setup

### Docker Environment

Tests are designed to run within our Docker development environment:

```bash
# Start Docker containers
docker-compose up -d

# Run tests
cd web/frontend && npm test
```

### Required Services

All these services must be running for tests to pass:
- Frontend (Next.js) - Port 3000
- Backend (FastAPI) - Port 8000
- Browser-tools-server - Port 3025
- MongoDB Atlas connectivity
- Cloudflare R2 integration (for saved assets)

## Test Execution

### Running Tests

```bash
# From the project root
cd web/frontend && npm test

# To run a specific test file
cd web/frontend && npx playwright test core-functionality.spec.ts

# To run in debug mode
cd web/frontend && PWDEBUG=1 npm run test:debug
```

### Test Artifacts

- Screenshots: `web/frontend/test-results/*/screenshots/`
- Videos: `web/frontend/test-results/*/videos/`
- Traces: `web/frontend/test-results/*/traces/`

## Next Steps

1. **Fix Audio Generation Test**
   - Review the actual DOM structure during audio generation
   - Consider alternative verification methods
   - Possibly update the frontend to include more reliable test hooks like data-testid attributes
   - Try a completely different approach like checking backend logs for successful generation

2. **Improve Test Stability**
   - Add more robust error handling in tests
   - Implement better cleanup between tests
   - Consider separating tests into smaller, more focused test cases

3. **Add More Test Coverage**
   - Video processing pipeline tests
   - Authentication tests
   - Error handling tests

4. **Performance Optimization**
   - Reduce test execution time
   - Implement parallelization where appropriate
   - Add test sharding for CI/CD

5. **Prepare Tests for Upcoming Refactoring**
   - Add more specific assertions about component behavior
   - Create snapshots of critical UI elements
   - Document expected outcomes in detail

## Conclusion

The Playwright test suite is mostly stable with 6 out of 7 tests passing. The main focus is on stabilizing the audio generation test and improving overall test resilience. The tests are integrated with our Docker environment and verify all core functionality of the application.

These tests will be critical during our upcoming refactoring work to ensure we don't break existing functionality while improving the codebase architecture. We need to ensure all tests are passing reliably before beginning major refactoring efforts. 