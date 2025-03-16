# Playwright Testing Guide

## Overview
This document provides guidance on running, maintaining, and troubleshooting Playwright tests for the Auto Shorts Web App.

## Running Tests

### Basic Test Commands
```bash
# Run all tests with mock audio
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test

# Run specific test file
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npm test -- <test-file-name>

# Run tests with UI mode (for debugging)
cd web/frontend && NEXT_PUBLIC_MOCK_AUDIO=true npx playwright test --ui
```

### Environment Variables for Testing
- `NEXT_PUBLIC_MOCK_AUDIO=true` - Use mock audio to avoid consuming API credits
- `NEXT_PUBLIC_TESTING_MODE=true` - Enable testing mode (set automatically in npm test script)
- `NEXT_PUBLIC_API_URL=http://localhost:8000` - Set the API URL (set automatically in npm test script)

## Test Structure

The tests are organized in the following structure:
- `web/frontend/tests/e2e/` - Contains all end-to-end tests
- `web/frontend/tests/utils/` - Test utilities and helper functions
- `web/frontend/tests/selectors.ts` - Centralized selectors for tests

## Best Practices for Test Maintenance

### Selector Strategies
1. **Prefer data-testid attributes** - Use `data-testid` attributes for primary selectors
   ```typescript
   // Example
   await page.click('[data-testid="add-scene-button"]');
   ```

2. **Use multiple selector options** - Implement fallback selectors for robustness
   ```typescript
   // Example
   const button = await page.$(
     '[data-testid="delete-scene-button"], .delete-button, button:has-text("Delete")'
   );
   ```

3. **Check element visibility** - Always verify elements are visible before interaction
   ```typescript
   await expect(page.locator('[data-testid="scene-component"]')).toBeVisible();
   ```

### Handling Asynchronous Operations
1. **Wait for navigation** - Use proper navigation waiting
   ```typescript
   await Promise.all([
     page.waitForURL('**/projects/**'),
     page.click('.project-card')
   ]);
   ```

2. **Wait for network idle** - For operations that trigger API calls
   ```typescript
   await page.waitForLoadState('networkidle');
   ```

3. **Wait for element state** - Check proper element state before proceeding
   ```typescript
   await page.waitForSelector('[data-testid="scene-component"]', { state: 'visible' });
   ```

### Error Handling and Debugging
1. **Add descriptive console logs** - For debugging test flow
   ```typescript
   console.log('Attempting to add a new scene...');
   ```

2. **Take screenshots at failure points** - To diagnose visual state
   ```typescript
   await page.screenshot({ path: 'screenshots/before-deletion.png' });
   ```

3. **Check console errors** - Log browser console errors
   ```typescript
   page.on('console', msg => {
     if (msg.type() === 'error') {
       console.log(`Browser console error: ${msg.text()}`);
     }
   });
   ```

4. **Implement test retries** - For flaky tests
   ```typescript
   test.describe('Project Management', () => {
     test.use({ retries: 2 });
     // Test cases...
   });
   ```

## Common Issues and Solutions

### Issue: Test fails due to navigation timeout
**Solution**: Implement more robust navigation handling
```typescript
// Instead of
await page.click('.project-card');

// Use
await Promise.all([
  page.waitForURL('**/projects/**'),
  page.click('.project-card')
]);
```

### Issue: Element not found or not visible
**Solution**: Add waiting and verify visibility
```typescript
// Wait for element to be visible and stable
await page.waitForSelector('[data-testid="scene-component"]', { 
  state: 'visible',
  timeout: 10000 
});
```

### Issue: Media loading failures
**Solution**: Add verification for media loading
```typescript
// Check for media elements
const mediaElements = await page.$$('video[src], img[src]');
console.log(`Found ${mediaElements.length} media elements`);

// Verify media has loaded
await page.waitForFunction(() => {
  const videos = document.querySelectorAll('video');
  return Array.from(videos).every(v => v.readyState >= 2);
}, { timeout: 10000 });
```

### Issue: Project deletion fails
**Solution**: Implement robust deletion handling
```typescript
// Find delete button
const deleteButton = await page.locator('[data-testid="delete-project-button"]');
await expect(deleteButton).toBeVisible();
await deleteButton.click();

// Find and click confirmation button with retries
let confirmed = false;
for (let i = 0; i < 3; i++) {
  try {
    const confirmButton = await page.locator('[data-testid="confirm-delete-button"], button:has-text("Confirm")');
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();
    confirmed = true;
    break;
  } catch (e) {
    console.log(`Confirm button click attempt ${i+1} failed`);
    await page.waitForTimeout(1000);
  }
}
```

## Maintaining Tests Over Time

1. **Update selectors when UI changes** - Keep selectors in sync with UI changes
2. **Review test failures promptly** - Fix failing tests before they become stale
3. **Keep test helpers modular** - Extract reusable functions to test utility files
4. **Regularly review test speed and reliability** - Optimize slow or flaky tests
5. **Add new tests for new features** - Maintain coverage as application evolves 