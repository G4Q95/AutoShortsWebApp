/**
 * Simplified Workflow Test Example
 * 
 * This file demonstrates how to use the domain-specific helpers to create
 * a clean, readable, and maintainable test for a complete user workflow.
 */

import { test, expect } from '@playwright/test';
import {
  // Import all helpers from the central index
  createProject,
  addScene,
  editSceneText,
  dragAndDropScene,
  deleteScene,
  setupMockAudio,
  generateVoiceForScene,
  playSceneAudio,
  verifyAudioGeneration,
  cleanupTestProjects,
  TEST_REDDIT_PHOTO_URL,
  TEST_REDDIT_VIDEO_URL,
  SCENE_MEDIA_TIMEOUT
} from '../utils';

test.describe('Simplified User Workflow', () => {
  // Configure fewer retries
  test.describe.configure({ retries: 1 });
  
  // Add detailed logging
  test.beforeEach(async ({ page }) => {
    console.log('Setting up mock audio generation');
    
    // Set shorter timeouts
    page.setDefaultTimeout(7000);
    
    // Set up mock audio to avoid real API calls
    await setupMockAudio(page);
    
    // Console and network error logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser console error: ${msg.text()}`);
      }
    });
    
    page.on('requestfailed', request => {
      console.log(`Request failed: ${request.url()}, reason: ${request.failure()?.errorText}`);
    });
  });

  // Clean up test projects after each test
  test.afterEach(async ({ page }) => {
    await cleanupTestProjects(page);
  });

  test('Complete workflow with domain-specific helpers', async ({ page }) => {
    console.log('Starting simplified workflow test');

    try {
      // Create a new project with unique name
      const projectName = `Demo Project ${Date.now().toString().slice(-4)}`;
      await createProject(page, projectName);
      console.log('Project created successfully');

      // Add first scene
      await addScene(page, TEST_REDDIT_PHOTO_URL);
      console.log('First scene added');

      // Add second scene with faster extraction
      await addScene(page, TEST_REDDIT_VIDEO_URL, true);
      console.log('Second scene added');

      // Generate voice for the first scene
      await generateVoiceForScene(page, 0);
      console.log('Voice generation initiated for first scene');
      
      // Verify with polling approach instead of single long wait
      let hasAudio = false;
      for (let i = 0; i < 5; i++) {
        hasAudio = await verifyAudioGeneration(page, 0);
        if (hasAudio) break;
        console.log(`Check ${i+1}: Audio not ready yet, waiting...`);
        await page.waitForTimeout(1000);
      }
      
      expect(hasAudio).toBeTruthy();
      console.log('Audio generation verified');
      
      // Edit scene text (complete the rest of the test)
      await editSceneText(page, "This is edited text for testing", 0);
      console.log('Scene text edited');
      
      // Take screenshot to capture current state
      await page.screenshot({ path: './test-results/workflow-complete.png' });
      
      console.log('Workflow test completed successfully');
    } catch (error) {
      // Take error screenshot
      await page.screenshot({ path: './test-results/workflow-failure.png' });
      console.error('Test failed:', error);
      throw error;
    }
  });
}); 