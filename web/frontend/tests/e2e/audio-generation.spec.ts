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
  
  // Configure retries for flaky tests
  test.describe.configure({ retries: 2 });
  
  // Add console error logging
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });
  });
  
  // Add global timeout for all tests
  test.slow();
  
  test('Audio generation and playback', async ({ page }) => {
    console.log('Starting audio generation test...');
    
    // Check if we're using mock audio
    const useMockAudio = process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true';
    console.log('Test environment:', {
      mockAudioEnabled: useMockAudio,
      testingMode: process.env.NEXT_PUBLIC_TESTING_MODE
    });
    
    // Set up mock audio if needed
    if (useMockAudio) {
      await setupMockAudio(page);
      
      // Set up route interception for mock mode
      await page.route('**/voice/generate', route => {
        console.log('****************************');
        console.log('TEST: Voice API call intercepted!');
        console.log('Route URL:', route.request().url());
        console.log('Method:', route.request().method());
        console.log('****************************');
        route.continue(); // Allow the request to proceed
      });
    }

    // Create a project for testing
    const projectNameAudio = TEST_PROJECT_NAME + ' Audio ' + Date.now().toString().slice(-4);
    await createProject(page, projectNameAudio);
    console.log('Created new project for audio test:', projectNameAudio);
    
    // Add a scene
    await addScene(page, TEST_REDDIT_PHOTO_URL);
    console.log('Added scene with test URL');
    
    // Wait for scene to load
    const sceneLoaded = await page.waitForSelector(BLUE_NUMBER_SELECTOR, { timeout: SCENE_MEDIA_TIMEOUT });
    expect(sceneLoaded).toBeTruthy();
    console.log('Scene loaded successfully');
    
    // Generate voice for the scene
    await generateVoiceForScene(page, 0);
    
    // Verify audio was generated
    const hasAudio = await verifyAudioGeneration(page, 0);
    expect(hasAudio).toBeTruthy();
    console.log('Audio generation verified successfully');
    
    // Play the audio
    await playSceneAudio(page, 0);
    console.log('Audio playback attempted');
    
    // Wait a moment to ensure audio starts playing
    await page.waitForTimeout(1000);
    
    // Test passed if we get here without errors
    console.log('Audio generation test completed successfully');
  });
}); 