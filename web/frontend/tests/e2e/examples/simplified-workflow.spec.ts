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
  TEST_REDDIT_VIDEO_URL
} from '../utils';

test.describe('Simplified User Workflow', () => {
  // Run this test only in mock audio mode to avoid API calls
  test.beforeEach(async ({ page }) => {
    // Set up mock audio to avoid real API calls
    await setupMockAudio(page);
  });

  // Clean up test projects after each test
  test.afterEach(async ({ page }) => {
    await cleanupTestProjects(page);
  });

  test('Complete workflow with domain-specific helpers', async ({ page }) => {
    console.log('Starting simplified workflow test');

    // Create a new project
    const projectName = `Demo Project ${Date.now()}`;
    await createProject(page, projectName);
    console.log('Project created successfully');

    // Add first scene
    await addScene(page, TEST_REDDIT_PHOTO_URL);
    console.log('First scene added');

    // Add second scene
    await addScene(page, TEST_REDDIT_VIDEO_URL);
    console.log('Second scene added');

    // Edit first scene text
    const customText = 'This is custom text for the first scene';
    await editSceneText(page, customText, 0);
    console.log('First scene text edited');

    // Reorder scenes (move first scene to second position)
    await dragAndDropScene(page, 0, 1);
    console.log('Scenes reordered successfully');

    // Generate voice for the second scene (now at index 0 after reordering)
    await generateVoiceForScene(page, 0);
    console.log('Voice generated for scene');

    // Verify audio generation worked
    const hasAudio = await verifyAudioGeneration(page, 0);
    expect(hasAudio).toBeTruthy();
    console.log('Audio generation verified');

    // Play the audio
    await playSceneAudio(page, 0);
    console.log('Audio playback started');

    // Wait a moment to ensure audio starts playing
    await page.waitForTimeout(1000);

    // Delete the first scene
    await deleteScene(page, 0);
    console.log('First scene deleted');

    console.log('Complete workflow test finished successfully');
  });
}); 