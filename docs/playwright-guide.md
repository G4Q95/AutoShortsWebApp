# Playwright Testing Guide for Auto Shorts Web App

This guide provides information on running, maintaining, and troubleshooting Playwright tests for the Auto Shorts Web App.

## Basic Test Commands

- Run all tests with mock audio (preferred for development):
  ```bash
  cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test
  ```

- Run a specific test file:
  ```bash
  cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/examples/simplified-workflow.spec.ts
  ```

- Run tests in UI mode for debugging:
  ```bash
  cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test --ui
  ```

- Run a specific test in debug mode:
  ```bash
  cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test tests/e2e/examples/simplified-workflow.spec.ts --debug
  ```

## Environment Variables for Testing

- `NEXT_PUBLIC_MOCK_AUDIO`: Set to `true` to avoid consuming ElevenLabs API credits
- `NEXT_PUBLIC_TESTING_MODE`: Set to `true` to enable additional testing features
- `NEXT_PUBLIC_API_URL`: Override the API URL for testing against different environments

## Test Structure

Our tests are organized in the following directories:

- `tests/e2e/` - End-to-end tests organized by domain
  - `home.spec.ts` - Homepage functionality
  - `project-management.spec.ts` - Project creation and management
  - `scene-operations.spec.ts` - Scene manipulation operations
  - `audio-generation.spec.ts` - Voice generation tests
  - `examples/simplified-workflow.spec.ts` - Example of a full workflow test

- `tests/e2e/utils/` - Domain-specific test helpers
  - `index.ts` - Central export point for all utilities
  - `selectors.ts` - Centralized selectors with fallbacks
  - `test-utils.ts` - Common test utilities
  - `scene-utils.ts` - Scene-specific helper functions
  - `audio-utils.ts` - Voice generation and audio helpers
  - `project-utils.ts` - Project management helpers

## Domain-Specific Helpers

We've implemented a domain-specific helper pattern to improve test maintainability and readability. These helpers encapsulate common operations into reusable functions:

### Example Usage

```typescript
// Instead of writing complex sequences in every test:
test('creates a project and adds scenes', async ({ page }) => {
  // Using domain-specific helpers
  await createNewProject(page, 'Test Project');
  await addScene(page);
  await addScene(page);
  await editSceneText(page, 0, 'First scene content');
  await generateVoiceForScene(page, 0);
  
  // Verify results
  await expect(page.locator(selectors.sceneCount)).toHaveText('2');
});
```

### Key Helper Functions

- **Project Management**
  - `createNewProject(page, name)` - Creates a new project
  - `deleteProject(page, name)` - Deletes an existing project
  - `openProject(page, name)` - Opens an existing project

- **Scene Operations**
  - `addScene(page)` - Adds a new scene
  - `deleteScene(page, sceneIndex)` - Deletes a scene
  - `editSceneText(page, sceneIndex, text)` - Edits scene text
  - `dragAndDropScene(page, sourceIndex, targetIndex)` - Reorders scenes

- **Audio Operations**
  - `generateVoiceForScene(page, sceneIndex)` - Generates voice for a scene
  - `verifyAudioGenerated(page, sceneIndex)` - Verifies audio was generated

## Common Issues and Troubleshooting

### Voice Generation Button Not Found

If you encounter "Voice generation button not found with any selector":

1. Check that `NEXT_PUBLIC_MOCK_AUDIO=true` is set
2. Ensure the scene has text content before attempting to generate
3. Look at screenshots to see UI state at failure time
4. Check test logs for specific selector that failed

### Text Editing Failures

If text editing fails:

1. Verify the text area is visible and active
2. Check for any overlapping elements that might block interaction
3. Try clicking on existing text first to activate edit mode
4. Use multiple targeting strategies as implemented in `editSceneText`

### General Element Selection Issues

For element not found errors:

1. Confirm the element exists in the UI at that point in the test flow
2. Use multiple selector strategies (data-testid, role, text content)
3. Add waiting mechanisms before attempting interaction
4. Take screenshots at failure points to see UI state

### Mock Audio Troubleshooting

If mock audio isn't working properly:

1. Verify `NEXT_PUBLIC_MOCK_AUDIO=true` is set
2. Check network requests for any calls to actual API endpoints
3. Verify that mocked responses are correctly configured
4. Look for console errors related to audio playback

## Best Practices for Test Maintenance

1. **Use Domain-Specific Helpers**
   - Create reusable functions for common operations
   - Keep test files clean and focused on business logic

2. **Add Console Logs for Debugging**
   - Use `console.log` for critical test steps
   - Log selector attempts and fallback strategies

3. **Take Screenshots**
   - Capture the UI state at critical points
   - Always take screenshots before and after key interactions

4. **Use Multiple Selector Strategies**
   - Start with data-testid attributes
   - Fall back to accessibility roles and labels
   - Use text content as a last resort

5. **Clean Up Test Projects**
   - Always clean up created test projects
   - Use `test.afterEach` or `test.afterAll` for cleanup

For more detailed information on specific test utilities, see the README in the `tests/e2e/utils/` directory. 