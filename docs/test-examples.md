# Test Examples

This document provides practical examples of how to use the helper functions in our Playwright end-to-end tests.

## Basic Test Structure

All tests should follow this basic structure:

```typescript
import { test, expect } from '@playwright/test';
import {
  createProject,
  addScene,
  editSceneText,
  generateVoiceForScene,
  setupMockAudio,
  cleanupTestProjects
} from '../tests/e2e/utils';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mock audio to avoid consuming API credits
    await setupMockAudio(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up any test projects created during the test
    await cleanupTestProjects(page);
  });

  test('Test name', async ({ page }) => {
    // Your test code here
  });
});
```

## Common Test Scenarios

### 1. Project Creation and Scene Management

```typescript
test('Create project with multiple scenes', async ({ page }) => {
  // Create a new project
  const projectName = await createProject(page);
  
  // Add multiple scenes
  await addScene(page, 'https://www.reddit.com/r/aww/comments/example1/');
  await addScene(page, 'https://www.reddit.com/r/pics/comments/example2/');
  
  // Verify scene count
  const sceneCount = await page.locator('[data-testid="scene-component"]').count();
  expect(sceneCount).toBe(2);
});
```

### 2. Scene Text Editing

```typescript
test('Edit scene text', async ({ page }) => {
  // Create project and add scene
  await createProject(page);
  await addScene(page);
  
  // Edit the scene text
  const newText = 'This is custom text for my video';
  await editSceneText(page, 0, newText);
  
  // Verify the edited text
  const sceneText = await page.locator('[data-testid="scene-text-editor"]').textContent();
  expect(sceneText).toContain(newText);
});
```

### 3. Voice Generation

```typescript
test('Generate voice for scene', async ({ page }) => {
  // Set up mock audio
  await setupMockAudio(page);
  
  // Create project and add scene
  await createProject(page);
  await addScene(page);
  
  // Edit scene text and generate voice
  await editSceneText(page, 0, 'Text for voice generation test');
  await generateVoiceForScene(page, 0);
  
  // Verify audio player appears
  await expect(page.locator('[data-testid="audio-player"]')).toBeVisible();
});
```

### 4. Scene Reordering

```typescript
test('Reorder scenes with drag and drop', async ({ page }) => {
  // Create project and add two scenes
  await createProject(page);
  await addScene(page, 'https://www.reddit.com/r/aww/comments/example1/');
  await addScene(page, 'https://www.reddit.com/r/pics/comments/example2/');
  
  // Get text from both scenes for comparison
  const firstSceneText = await page.locator('[data-testid="scene-component"]').nth(0).locator('[data-testid="scene-text-editor"]').textContent();
  const secondSceneText = await page.locator('[data-testid="scene-component"]').nth(1).locator('[data-testid="scene-text-editor"]').textContent();
  
  // Reorder the scenes
  await dragAndDropScene(page, 0, 1);
  
  // Verify the reordering
  const newFirstSceneText = await page.locator('[data-testid="scene-component"]').nth(0).locator('[data-testid="scene-text-editor"]').textContent();
  expect(newFirstSceneText).toBe(secondSceneText);
});
```

### 5. Complete Workflow

```typescript
test('Complete workflow with mock audio', async ({ page }) => {
  // Set up mock audio
  await setupMockAudio(page);
  
  // Create project
  const projectName = await createProject(page, 'Complete Workflow Test');
  
  // Add scene
  await addScene(page);
  
  // Edit scene text
  await editSceneText(page, 0, 'This is a test of the complete workflow');
  
  // Generate voice
  await generateVoiceForScene(page, 0);
  
  // Verify audio player
  await expect(page.locator('[data-testid="audio-player"]')).toBeVisible();
  
  // Play audio
  await playSceneAudio(page, 0);
  
  // Wait for some animation or state change
  await page.waitForTimeout(1000);
  
  // Clean up
  await cleanupTestProjects(page, [projectName]);
});
```

## Best Practices

1. **Always use helper functions** instead of direct Playwright commands
   ```typescript
   // Good
   await createProject(page, 'My Project');
   
   // Avoid
   await page.click('button:has-text("Create Video")');
   await page.fill('[placeholder="Enter project name"]', 'My Project');
   await page.click('button:has-text("Create Project")');
   ```

2. **Always clean up test data**
   ```typescript
   test.afterEach(async ({ page }) => {
     await cleanupTestProjects(page);
   });
   ```

3. **Use mock audio by default**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await setupMockAudio(page);
   });
   ```

4. **Add descriptive test names**
   ```typescript
   // Good
   test('User can create a project and add scenes', async ({ page }) => {
   
   // Avoid
   test('Test project creation', async ({ page }) => {
   ```

5. **Include screenshots for debugging**
   ```typescript
   await takeDebugScreenshot(page, 'before-action');
   // Perform action
   await takeDebugScreenshot(page, 'after-action');
   ```

## Handling Flaky Tests

If you encounter flaky tests, consider these strategies:

1. **Add wait operations**
   ```typescript
   await page.waitForSelector('[data-testid="scene-component"]');
   ```

2. **Use fallback selectors**
   ```typescript
   await clickWithFallbacks(page, [
     '[data-testid="generate-voice-button"]',
     'button:has-text("Generate Voice")',
     'button.voice-button'
   ]);
   ```

3. **Add retries to the test**
   ```typescript
   test.describe.configure({ retries: 2 });
   ```

4. **Take screenshots for debugging**
   ```typescript
   if (await page.locator('[data-testid="error-message"]').isVisible()) {
     await takeDebugScreenshot(page, 'error-occurred');
   }
   ```

5. **Increase timeouts for slow operations**
   ```typescript
   await page.waitForSelector('[data-testid="audio-player"]', { timeout: 30000 });
   ``` 