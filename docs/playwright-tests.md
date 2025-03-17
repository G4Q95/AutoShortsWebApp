# Playwright E2E Testing Framework

Last Updated: April 5, 2025

## Overview

This document describes the end-to-end testing framework for the Auto Shorts Web App using Playwright. Our testing approach focuses on verifying critical user workflows and ensuring app functionality works as expected across different environments.

## Test Structure

We've implemented a fully modular, domain-specific approach to organize our tests:

### Test Files

1. **Home Page & Navigation (`home-page.spec.ts`)**
   - Home page loads correctly
   - Navigation between pages works properly
   - Create video button navigation

2. **Project Management (`project-management.spec.ts`)**
   - Project creation and setup
   - Existing project loading and management

3. **Scene Operations (`scene-operations.spec.ts`)**
   - Scene deletion 
   - Drag and drop scene reordering

4. **Audio Generation (`audio-generation.spec.ts`)**
   - Audio generation and playback
   - Voice settings management

5. **Mock Audio Testing (`mock-audio-test.spec.ts`)**
   - Audio generation with mock API
   - API interception and verification

6. **Example Workflows (`examples/simplified-workflow.spec.ts`)**
   - Complete end-to-end user flow tests
   - Demonstrates usage of all domain-specific helpers

### Utility Files

1. **Centralized Index (`utils/index.ts`)**
   - Single import point for all utilities
   - Re-exports from domain-specific helpers

2. **Test Utilities (`utils/test-utils.ts`)**
   - Shared constants
   - Common helper functions
   - Test data

3. **Selectors Library (`utils/selectors.ts`)**
   - Centralized selectors for UI elements
   - Fallback selector strategies
   - Helper functions for reliable element selection

4. **Domain-Specific Helpers**
   - `utils/scene-utils.ts` - Scene operations (add, edit, delete, reorder)
   - `utils/audio-utils.ts` - Audio generation and verification
   - `utils/project-utils.ts` - Project creation and management
   - `utils/layout-utils.ts` - Layout verification
   - `utils/navigation-utils.ts` - Page navigation
   - `utils/wait-utils.ts` - Timing utilities and polling

## Domain-Specific Helper Pattern

We've implemented domain-specific helpers to improve test maintainability and readability:

```typescript
// Example of simplified test using domain helpers
test('creates project with scenes and audio', async ({ page }) => {
  await createNewProject(page, 'Test Project');
  await addScene(page);
  await editSceneText(page, 0, 'First scene content');
  await generateVoiceForScene(page, 0);
  await expect(page.locator(selectors.audioPlayer)).toBeVisible();
});
```

## Running Tests

### Basic Test Command

```bash
cd web/frontend && npm test
```

### Mock Audio Testing

To avoid consuming ElevenLabs API credits, use the mock audio mode:

```bash
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test
```

### Running Specific Test Files

```bash
cd web/frontend && npx playwright test tests/e2e/examples/simplified-workflow.spec.ts
```

## Test Status

All tests (10/10) are currently passing.

## Recent Changes

1. **April 5, 2025**
   - Completed migration of all tests to domain-specific files
   - Removed `core-functionality.spec.ts` file
   - Verified all tests running successfully
   - Updated documentation to reflect reorganized structure

2. **March 22, 2025**
   - Implemented domain-specific helpers pattern
   - Created `scene-utils.ts`, `audio-utils.ts`, and `project-utils.ts`
   - Added comprehensive fallback strategies for voice generation button
   - Enhanced text editing with multiple targeting approaches
   - Resolved all failing tests with more resilient implementation

3. **March 21, 2025**
   - Split large test file into domain-specific files for better organization
   - Created shared test utilities and extracted common functions
   - Implemented centralized selectors library
   - Fixed scene deletion test with proper fallback strategies

## Best Practices

1. **Use Domain-Specific Helpers**
   - Write tests using the domain-specific helpers
   - Add new helpers for common operations
   - Maintain separation of concerns between helpers

2. **Use data-testid Attributes**
   - All interactive components should have data-testid attributes
   - Follow naming pattern: `data-testid="[component]-[element]-[purpose]"`

3. **Centralize Selectors**
   - Add all selectors to the `selectors.ts` file
   - Provide fallback strategies for critical elements

4. **Test Isolation**
   - Each test should create its own data
   - Clean up created resources after test completion
   - Avoid dependencies between tests

5. **Debugging**
   - Use screenshots liberally (`page.screenshot()`)
   - Add descriptive console logs
   - Implement clear error messages

6. **Test Artifact Management**
   - During test execution, Playwright generates various screenshot files to help with debugging and diagnostics. These files are useful during development but can accumulate and take up disk space over time. To manage these artifacts:
     - **Automatic Gitignore**: All test artifact files (screenshots, test-results directory) are automatically ignored by Git via patterns in `.gitignore`.
     - **Cleanup Script**: A dedicated cleanup script removes all test artifacts:
       ```bash
       # Run from the frontend directory
       npm run cleanup-tests
       ```
     - **Naming Patterns**: Screenshot files follow specific naming patterns:
       - `before-*.png` / `after-*.png` - State comparison screenshots
       - `debug-*.png` - Generated by `takeDebugScreenshot()` calls
       - Other prefixes for specific test scenarios
     - **When to Clean**: It's recommended to run the cleanup script:
       - After completing a test development session
       - When disk space is a concern
       - Before major Git operations to ensure clean status output
     **Note**: Screenshots are valuable for diagnosing test failures, so only clean them up after you've resolved any failing tests.

## Troubleshooting

### Common Issues

1. **Voice Generation Button Not Found**
   - Check that scene has text content first
   - Verify NEXT_PUBLIC_MOCK_AUDIO is set to true
   - See screenshots in test-results directory
   - Check which selectors are being attempted

2. **Text Editing Failures**
   - Verify text area is visible and active
   - Try clicking existing text first to activate editing
   - Check for overlapping elements
   - See `editSceneText` in scene-utils.ts for strategies

3. **Element Not Found**
   - Check if data-testid is correct
   - Verify element is visible in UI
   - Try using fallback selectors

4. **Test Timeouts**
   - Adjust timeout constants in test-utils.ts
   - Add additional waiting with expect.poll()
   - Check for network or backend issues

5. **Mock Audio Not Working**
   - Verify NEXT_PUBLIC_MOCK_AUDIO environment variable is set
   - Check console logs for mock initialization
   - Verify route interception is working

## Future Improvements

1. **Complete Data-testid Implementation (10% remaining)**
   - Finish adding data-testid attributes to all components
   - Update selectors to use data-testid consistently
   - Document all supported data-testid values

2. **Enhanced Test Documentation**
   - Add JSDoc comments to all helper functions
   - Create better examples of helper usage
   - Improve test organization documentation

3. **Test Command Standardization**
   - Create more specific npm test commands
   - Add shortcuts for common test patterns
   - Improve test output formatting

4. **Advanced Testing Features**
   - Implement visual regression testing
   - Set up CI/CD pipeline integration
   - Add performance metrics tracking
   - Enhance test analytics for flaky test detection

## Best Practice: Test Frequently

Maintaining a stable test suite requires regular testing. Follow these guidelines:

1. **When to Run Tests**:
   - Before starting new feature development
   - After making significant UI changes
   - Before creating pull requests
   - Any time you modify selectors or test utils
   - When upgrading dependencies

2. **Testing Strategy**:
   - Start with running specific test files relevant to your changes
   - Run the full test suite before submitting code
   - Always use mock audio mode during development
   - Save API tests for final verification

3. **Fixing Failing Tests**:
   - Prioritize fixing failing tests before continuing development
   - Examine test artifacts (screenshots, logs) to identify the issue
   - Update selectors if UI structure has changed
   - Refine waiting strategies for timing-related issues
   - Consider if a legitimate feature change broke the test 