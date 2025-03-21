import { test, expect } from '@playwright/test';
import { 
  NAVIGATION_TIMEOUT,
  PAGE_LOAD_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  AUDIO_GENERATION_TIMEOUT,
  TEST_PROJECT_NAME,
  TEST_REDDIT_PHOTO_URL,
  waitForButtonReady,
  elementWithTextExists,
  BLUE_NUMBER_SELECTOR,
  MEDIA_SELECTOR,
  // Import our new domain-specific helpers
  createProject,
  addScene,
  setupMockAudio,
  generateVoiceForScene,
  playSceneAudio,
  verifyAudioGeneration
} from './utils';
import { selectors, waitForWithFallbacks } from './utils/selectors';

/**
 * Tests for audio generation functionality
 */
test.describe('Audio Generation', () => {
  
  // Configure fewer retries to avoid excessive wait times
  test.describe.configure({ retries: 1 });
  
  // Add console logging to capture detailed test info
  test.beforeEach(async ({ page }) => {
    // Console error logging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`Browser console error: ${msg.text()}`);
      }
    });
    
    // Network error logging
    page.on('requestfailed', request => {
      console.log(`Request failed: ${request.url()}, reason: ${request.failure()?.errorText}`);
    });
  });
  
  test('Audio generation and playback', async ({ page }) => {
    console.log('Starting audio generation test...');
    
    // Set default timeout to 10 seconds (increased from 7)
    page.setDefaultTimeout(10000);
    
    // Check if we're using mock audio
    const useMockAudio = process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true';
    console.log(`Test environment: Mock audio=${useMockAudio}, Testing mode=${process.env.NEXT_PUBLIC_TESTING_MODE}`);
    
    // Set up mock audio if needed
    if (useMockAudio) {
      await setupMockAudio(page);
      console.log('Mock audio setup complete');
      
      // Take screenshot to verify initial state
      await page.screenshot({ path: './test-results/initial-state.png' });
    }

    try {
      // Create a project for testing with a unique name
      const projectNameAudio = `${TEST_PROJECT_NAME}-Audio-${Date.now().toString().slice(-4)}`;
      await createProject(page, projectNameAudio);
      console.log(`Created project: ${projectNameAudio}`);
      
      // Add a scene with our test URL
      await addScene(page, TEST_REDDIT_PHOTO_URL);
      console.log('Added scene with test URL');
      
      // Wait for scene to load with longer timeout
      console.log('Waiting for scene card to appear...');
      const sceneLoaded = await page.waitForSelector(BLUE_NUMBER_SELECTOR, { 
        timeout: 10000  // Increased to 10 seconds
      });
      expect(sceneLoaded).toBeTruthy();
      console.log('Scene card loaded successfully');
      
      // Now wait specifically for media content to be visible
      console.log('Waiting for media content to load...');
      await page.waitForSelector(MEDIA_SELECTOR, { 
        timeout: 10000,
        state: 'visible'
      });
      console.log('Media content loaded successfully');
      
      // Add an explicit delay to ensure all content is fully loaded
      console.log('Waiting additional time for all content to stabilize...');
      await page.waitForTimeout(2000);
      
      // Take screenshot of loaded scene
      await page.screenshot({ path: './test-results/scene-loaded.png' });
      
      // Generate voice for the scene
      await generateVoiceForScene(page, 0);
      console.log('Voice generation started');
      
      // Take longer time to verify audio generation (max 10 seconds)
      let hasAudio = false;
      for (let i = 0; i < 10; i++) {
        hasAudio = await verifyAudioGeneration(page, 0);
        if (hasAudio) break;
        console.log(`Audio check attempt ${i+1}: Not found yet, waiting...`);
        await page.waitForTimeout(1000);
      }
      
      // Take screenshot of generation result
      await page.screenshot({ path: './test-results/after-generation.png' });
      
      expect(hasAudio).toBeTruthy();
      console.log('Audio generation verified');
      
      // Play the audio (no need to wait for long duration)
      await playSceneAudio(page, 0);
      console.log('Audio playback started');
      
      // Test passed if we get here
      console.log('Audio generation test passed');
    } catch (error) {
      // Take error screenshot
      await page.screenshot({ path: './test-results/test-failure.png' });
      console.error('Test failed:', error);
      throw error;
    }
  });
}); 