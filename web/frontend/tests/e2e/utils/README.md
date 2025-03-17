# Test Utilities

This directory contains utility functions and helpers for Playwright end-to-end tests.

## Overview

The test utilities are organized into domain-specific modules to improve maintainability and reduce duplication across test files.

## Directory Structure

```
utils/
├── index.ts         - Central export file
├── selectors.ts     - Centralized selectors
├── test-utils.ts    - Core test utilities
├── scene-utils.ts   - Scene-specific utilities
├── audio-utils.ts   - Audio-specific utilities
├── project-utils.ts - Project-specific utilities
└── README.md        - This file
```

## How to Use

Import the utilities from the central index file:

```typescript
import { 
  createProject,
  addScene, 
  generateVoiceForScene,
  waitForProjectWorkspace
} from './utils';
```

## Available Utilities

### Scene Operations (`scene-utils.ts`)

- `addScene(page, url)` - Add a scene with content from URL
- `deleteScene(page, index)` - Delete a scene at specified index
- `dragAndDropScene(page, sourceIndex, targetIndex)` - Reorder scenes
- `editSceneText(page, index, newText)` - Edit scene text
- `verifySceneContent(page, index, expectedText)` - Verify scene content

### Audio Operations (`audio-utils.ts`)

- `setupMockAudio(page)` - Set up mock audio to avoid API calls
- `generateVoiceForScene(page, sceneIndex)` - Generate voice for scene
- `playSceneAudio(page, sceneIndex)` - Play audio for scene
- `changeVoiceSettings(page, sceneIndex, voiceIndex, stability, similarity)` - Change voice settings
- `verifyAudioGeneration(page, sceneIndex)` - Verify audio generation

### Project Management (`project-utils.ts`)

- `createProject(page, projectName)` - Create a new project
- `openProject(page, projectName)` - Open existing project
- `deleteProject(page, projectName)` - Delete project
- `createMultipleProjects(page, count, baseProjectName)` - Create multiple test projects
- `cleanupTestProjects(page, testKeyword)` - Clean up all test projects

### Core Utilities (`test-utils.ts`)

- `goToHomePage(page)` - Navigate to home page
- `waitForProjectWorkspace(page)` - Wait for project workspace to load
- `takeDebugScreenshot(page, name)` - Take a screenshot for debugging
- `waitForScenes(page, expectedCount, context)` - Wait for scenes to appear
- `waitForButtonReady(page, button, timeout)` - Wait for button to be clickable

### Selectors (`selectors.ts`)

- `selectors` - Object containing all centralized selectors
- `clickWithFallbacks(page, selectors, timeout)` - Click with fallback selectors
- `waitForWithFallbacks(page, selectors, timeout)` - Wait with fallback selectors

## Example Usage

Here's a simplified test example:

```typescript
import { test, expect } from '@playwright/test';
import {
  createProject,
  addScene,
  editSceneText,
  setupMockAudio,
  generateVoiceForScene,
  TEST_REDDIT_PHOTO_URL
} from './utils';

test('Create project with voice generation', async ({ page }) => {
  // Set up mock audio
  await setupMockAudio(page);
  
  // Create project
  const projectName = `Test Project ${Date.now()}`;
  await createProject(page, projectName);
  
  // Add scene
  await addScene(page, TEST_REDDIT_PHOTO_URL);
  
  // Edit scene text
  await editSceneText(page, 0, 'Custom text for voiceover');
  
  // Generate voice
  await generateVoiceForScene(page, 0);
  
  // Verify result
  // ... rest of test
});
```

## Best Practices

1. **Use domain-specific helpers** instead of raw Playwright commands
2. **Prefer data-testid attributes** for element selection
3. **Add screenshots at critical points** for debugging
4. **Add detailed logging** to help diagnose test failures
5. **Clean up test projects** in `afterEach` or `afterAll` hooks
6. **Use mock audio mode** unless specifically testing the real API 