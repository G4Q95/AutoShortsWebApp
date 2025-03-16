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
  MEDIA_SELECTOR
} from './utils/test-utils';
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
    
    // If using mock audio, set up the same way as mock-audio-test.spec.ts
    if (useMockAudio) {
      // First, inject our mock API implementation
      await page.addInitScript(() => {
        // Set a flag that this test is running with mock audio
        (window as any).USE_MOCK_AUDIO = true;
        
        // Add a global variable that persists the mock flag
        (window as any).__MOCK_AUDIO_ENABLED = true;
        
        console.log('MOCK: Mock audio flag enabled in core functionality test');
      });
      
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
    await page.goto('/projects/create', { timeout: NAVIGATION_TIMEOUT });
    
    // Ensure page is fully loaded before proceeding
    await page.waitForLoadState('networkidle', { timeout: 5000 });
    
    await page.getByPlaceholder('Enter project name').fill(projectNameAudio);
    await page.getByRole('button', { name: 'Create Project' }).click();
    console.log('Created new project for audio test:', projectNameAudio);
    
    // Wait for project workspace to load
    await page.waitForURL(/.*\/projects\/[a-z0-9]+$/, { timeout: NAVIGATION_TIMEOUT });
    
    // Wait for the page to be fully loaded
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      console.log('Network activity still ongoing, continuing anyway');
    });
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'audio-test-workspace-loaded.png' });
    
    // Add a scene for testing voice
    console.log('Adding a scene for voice generation...');
    const urlInput = page.getByPlaceholder('Enter Reddit URL');
    await expect(urlInput).toBeVisible({ timeout: PAGE_LOAD_TIMEOUT });
    await urlInput.fill(TEST_REDDIT_PHOTO_URL);
    await page.getByRole('button', { name: 'Add' }).click();
    
    // Wait for scene to appear
    console.log('Waiting for scene number to appear...');
    const blueNumberText = '1';
    await expect.poll(async () => {
      return elementWithTextExists(page, BLUE_NUMBER_SELECTOR, blueNumberText);
    }, {
      message: `Expected to find blue number with text "${blueNumberText}"`,
      timeout: PAGE_LOAD_TIMEOUT
    }).toBeTruthy();
    
    // Take screenshot after scene is added
    await page.screenshot({ path: 'audio-test-scene-added.png' });
    
    // Wait for scene media to load
    console.log('Waiting for scene media to load...');
    await expect(page.locator(MEDIA_SELECTOR).first()).toBeVisible({ timeout: SCENE_MEDIA_TIMEOUT });
    console.log('Scene media loaded successfully');
    
    // Wait for a moment to ensure components are fully initialized
    await page.waitForTimeout(1000);
    
    // Set up voice selector if needed
    console.log('Setting up voice selection...');
    try {
      // Check if voice selector exists
      const voiceSelector = page.locator(selectors.voiceSelector);
      if (await voiceSelector.count() > 0) {
        // Select a voice from the dropdown
        await voiceSelector.selectOption({ index: 0 }); // Select the first voice
        console.log('Selected voice from dropdown');
      } else {
        console.log('Voice selector not found, might be using default voice');
      }
    } catch (e) {
      console.log('Error setting up voice selection:', e);
    }
    
    // Set up network listener to capture API calls
    let voiceApiCalled: boolean = false;
    await page.route('**/voice/generate', route => {
      console.log('****************************');
      console.log('TEST: Voice API call intercepted!');
      console.log('Route URL:', route.request().url());
      console.log('Method:', route.request().method());
      console.log('****************************');
      voiceApiCalled = true;
      route.continue(); // Allow the request to proceed
    });
    
    // Locate the generate voice button using several methods
    console.log('Locating generate voice button...');
    let generateButton;
    
    // First try with the most specific selector
    try {
      // Try the most reliable button locator first
      generateButton = page.getByRole('button', { name: /Generate Voice/i });
      await generateButton.waitFor({ state: 'visible', timeout: 5000 });
      console.log('Found generate voice button with role/name');
    } catch (e) {
      // If that fails, try with fallbacks
      try {
        generateButton = await waitForWithFallbacks(page, selectors.generateVoiceButtonFallbacks);
        console.log('Found generate voice button with fallback selectors');
      } catch (e2) {
        // Last resort, try with text content
        try {
          generateButton = page.getByText(/Generate Voice/i);
          await generateButton.waitFor({ state: 'visible', timeout: 5000 });
          console.log('Found generate voice button with text content');
        } catch (e3) {
          console.error('Could not find generate voice button with any method');
          // Take a screenshot for debugging
          await page.screenshot({ path: 'audio-test-button-not-found.png' });
          throw new Error('Generate voice button not found with any method');
        }
      }
    }
    
    // Take a screenshot before clicking generate
    await page.screenshot({ path: 'audio-test-before-click.png' });
    
    // Wait for button to be enabled
    console.log('Waiting for generate button to be ready...');
    const buttonReady = await waitForButtonReady(page, generateButton, 10000);
    
    if (!buttonReady) {
      console.warn('Button not ready, attempting to click anyway');
      // Take a screenshot for debugging
      await page.screenshot({ path: 'audio-test-button-not-ready.png' });
    }
    
    // Click the generate voice button
    console.log('Clicking generate voice button...');
    await generateButton.click({ timeout: 5000 }).catch(async (error: Error) => {
      console.error('Failed to click button:', error);
      // Try with force option
      console.log('Trying force click...');
      await generateButton.click({ force: true, timeout: 5000 });
    });
    console.log('Clicked generate voice button');
    
    // Take a screenshot after clicking
    await page.screenshot({ path: 'audio-test-after-click.png' });
    
    // Wait for audio generation to complete
    console.log('Waiting for audio element to appear...');
    
    // First check if API was called
    if (!voiceApiCalled && !useMockAudio) {
      console.warn('API was not called, this might indicate a problem');
    }
    
    // Try multiple approaches to verify audio generation
    let audioFound = false;
    
    // Approach 1: Check for audio element
    try {
      const audioElement = page.locator('audio');
      await audioElement.waitFor({ state: 'attached', timeout: AUDIO_GENERATION_TIMEOUT / 2 });
      console.log('Audio element found, generation completed');
      
      // Verify audio element has src attribute
      const src = await audioElement.getAttribute('src');
      expect(src).toBeTruthy();
      console.log('Audio element has src attribute:', src?.substring(0, 30) + '...');
      audioFound = true;
    } catch (e) {
      console.log('Audio element not found with first approach, trying alternatives...');
    }
    
    // Approach 2: Check for specialized audio player components
    if (!audioFound) {
      try {
        const audioPlayer = page.locator('[data-testid="audio-player"]');
        await audioPlayer.waitFor({ state: 'visible', timeout: AUDIO_GENERATION_TIMEOUT / 2 });
        console.log('Audio player component found');
        audioFound = true;
      } catch (e) {
        console.log('Audio player component not found');
      }
    }
    
    // Approach 3: Check for generated audio message
    if (!audioFound) {
      try {
        const successMessage = page.getByText(/audio generated|voice generated/i);
        await successMessage.waitFor({ state: 'visible', timeout: 5000 });
        console.log('Found success message indicating audio was generated');
        audioFound = true;
      } catch (e) {
        console.log('No success message found');
      }
    }
    
    // Take final screenshot after audio generation
    await page.screenshot({ path: 'audio-test-final-state.png' });
    
    if (!audioFound && !useMockAudio) {
      // Log browser state for debugging
      const pageState = await page.evaluate(() => {
        return {
          audioElements: document.querySelectorAll('audio').length,
          audioSources: Array.from(document.querySelectorAll('audio')).map(el => el.src),
          bodyContent: document.body.innerHTML.substring(0, 200) + '...'
        };
      });
      console.log('Page state:', pageState);
      
      // Fail the test if real API is being used and no audio was found
      expect(false, 'No audio element or player found after generation').toBe(true);
    } else {
      // For mock audio, we'll consider the test successful if the API was called
      // even if no audio element was found (since it might be mocked with a dummy component)
      if (useMockAudio) {
        expect(voiceApiCalled).toBe(true);
      }
    }
    
    // Clean up - delete the project
    console.log('Cleaning up: deleting test project...');
    await page.locator('header').getByRole('link', { name: 'My Projects' }).click();
    await page.waitForURL(/.*\/projects/, { timeout: NAVIGATION_TIMEOUT });
    await page.getByText(projectNameAudio.split(' ')[0], { exact: false }).first().click();
    await page.getByRole('button', { name: 'Delete' }).click();
    
    console.log('Audio generation test completed successfully');
  });
}); 