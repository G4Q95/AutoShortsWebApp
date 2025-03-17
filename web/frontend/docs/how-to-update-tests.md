# How to Update Tests When Adding New Features

This guide provides a step-by-step approach for updating tests when adding new features or making changes to the Auto Shorts Web App.

## Table of Contents

1. [Adding data-testid Attributes](#adding-data-testid-attributes)
2. [Updating Selectors](#updating-selectors)
3. [Adding New Test Cases](#adding-new-test-cases)
4. [Modifying Existing Tests](#modifying-existing-tests)
5. [Testing Process](#testing-process)
6. [Troubleshooting](#troubleshooting)

## Adding data-testid Attributes

When adding new components or UI elements, it's essential to include `data-testid` attributes to ensure they can be reliably targeted by tests.

### 1. Identify Key Elements

For each new component, identify all interactive elements that need to be tested:

- Buttons
- Input fields
- Dropdowns
- Toggle switches
- Container elements
- Sections that display data

### 2. Add Appropriate Attributes

Follow this naming convention for data-testid attributes:

```tsx
// Component-specific elements
<div data-testid="component-name">
  <button data-testid="component-name-action-button">Action</button>
  <input data-testid="component-name-input" />
</div>

// Global elements
<button data-testid="global-action-button">Global Action</button>
```

#### Examples:

```tsx
// Scene component
<div data-testid="scene-component">
  <div data-testid="scene-text">Text content</div>
  <button data-testid="generate-voice-button">Generate Voice</button>
</div>

// Project workspace
<div data-testid="project-workspace">
  <input data-testid="url-input" />
  <button data-testid="add-content-button">Add</button>
</div>
```

### 3. Use Consistent Naming Patterns

- Use kebab-case for all `data-testid` attributes
- Prefix with component name (e.g., `scene-`, `audio-`, `project-`)
- Suffix with element type (e.g., `-button`, `-input`, `-container`)
- For numbered items, use index in the attribute: `data-testid="scene-number-1"`

## Updating Selectors

When new elements are added or existing ones are modified, update the central selectors file.

### 1. Locate the Selectors File

Open `web/frontend/tests/e2e/utils/selectors.ts`

### 2. Add or Update Selectors

```typescript
// Add a new selector
export const selectors = {
  // ... existing selectors
  
  // New selector
  newFeatureButton: '[data-testid="new-feature-button"]',
  
  // Selector with fallbacks
  newFeatureButtonFallbacks: {
    testId: '[data-testid="new-feature-button"]',
    text: 'text=New Feature',
    cssClass: '.new-feature-btn',
    role: 'button:has-text("New Feature")'
  }
};
```

### 3. Use Fallback Strategies

Always include fallback selectors for critical UI elements:

```typescript
// Example of fallback selectors
export const generateVoiceButtonFallbacks = {
  testId: '[data-testid="generate-voice-button"]',
  text: 'text=Generate Voiceover',
  cssClass: '.generate-voice-btn',
  role: 'button:has-text("Generate")',
  alternative: '[data-testid="voice-generator-button"]'
};
```

## Adding New Test Cases

When adding new features, create tests to verify their functionality.

### 1. Choose the Appropriate Test File

- Place tests in the most relevant domain-specific file:
  - `project-management.spec.ts` - For project-related features
  - `scene-operations.spec.ts` - For scene manipulation features
  - `audio-generation.spec.ts` - For audio-related features
  - `home-page.spec.ts` - For navigation and home page features

### 2. Create a Test Function

```typescript
test('New feature works correctly', async ({ page }) => {
  // Setup
  await createTestProject(page, 'Test New Feature');
  
  // Test specific functionality
  await page.click(selectors.newFeatureButton);
  
  // Verify the expected outcome
  await expect(page.locator(selectors.featureResult)).toBeVisible();
  
  // Clean up
  await deleteTestProject(page);
});
```

### 3. Use Helpers from Test Utilities

Leverage existing helper functions from the test utilities:

```typescript
import { createTestProject, addScene, deleteTestProject } from './utils/test-utils';

test('New feature works with scenes', async ({ page }) => {
  // Create project
  const projectName = await createTestProject(page);
  
  // Add scene
  await addScene(page, 'https://www.reddit.com/example');
  
  // Test your new feature
  // ...
  
  // Clean up
  await deleteTestProject(page, projectName);
});
```

## Modifying Existing Tests

When changing existing features, update the related tests carefully.

### 1. Identify Affected Tests

Run existing tests with a grep to find tests related to your changes:

```bash
npm test -- --grep "Feature name"
```

### 2. Update Test Steps

1. Modify test assertions to match new behavior
2. Update selectors if UI elements have changed
3. Add new assertions for added functionality
4. Remove assertions for removed functionality

### 3. Test Incrementally

- Update one test at a time
- Run tests after each change to verify they still pass
- Commit changes once all tests are passing

## Testing Process

When adding new features or making changes, follow this incremental testing process:

### 1. Development Phase

1. Add `data-testid` attributes to all new elements
2. Update selector library with new selectors
3. Implement feature with testing in mind

### 2. Testing Phase

1. Run targeted tests first: 
   ```bash
   npm test -- --grep "Specific feature"
   ```

2. Update or create specific tests for the new feature

3. Verify no regressions in related areas:
   ```bash
   npm test -- --grep "Related feature"
   ```

4. Run the full test suite before finalizing:
   ```bash
   npm test
   ```

### 3. Debugging Failed Tests

1. Check test output for clues about failures
2. Look for screenshots in `test-results/` directory
3. Add console logging for better visibility
4. Use interactive debugging with `PWDEBUG=1 npm run test:debug`

## Troubleshooting

Common issues and solutions when updating tests:

### Selector Not Found

If a test fails because it can't find an element:

1. Verify the element has a `data-testid` attribute
2. Check if the selector in the test matches the actual attribute
3. Add fallback selectors for more robust tests

### Timing Issues

If tests fail due to timing:

1. Adjust implicit waits: `await page.waitForTimeout(500);`
2. Use explicit waiting for conditions: `await page.waitForSelector()`
3. Add stabilization delays for animations/transitions

### Element Not Visible

If tests fail because elements exist but aren't visible:

1. Check if the element is hidden by CSS
2. Verify the element isn't scrolled out of view
3. Check if a modal or other element is covering it

### API Issues

If tests fail due to API calls:

1. Ensure mock API mode is enabled for testing
2. Check the network logs for errors
3. Verify API routes are correctly mocked

---

## Quick Reference

### Key File Locations

- **Selectors**: `web/frontend/tests/e2e/utils/selectors.ts`
- **Test Utilities**: `web/frontend/tests/e2e/utils/test-utils.ts`
- **Domain-specific Helpers**: `web/frontend/tests/e2e/utils/[domain]-utils.ts`
- **Test Files**: `web/frontend/tests/e2e/*.spec.ts`

### Common Commands

```bash
# Run all tests
npm test

# Run specific tests
npm test -- --grep "Feature name"

# Run with mock audio (default)
NEXT_PUBLIC_MOCK_AUDIO=true npm test

# Debug with Playwright inspector
PWDEBUG=1 npm run test:debug

# Clean up test artifacts
npm run cleanup-tests
```

### Best Practices

1. **Add data-testid to all new UI elements**
2. **Update the selectors library with new selectors**
3. **Test incrementally - one change at a time**
4. **Use helper functions for common operations**
5. **Add fallback selectors for critical elements**
6. **Clean up after tests to leave the system in a good state**
7. **Write descriptive test names that explain what's being tested** 