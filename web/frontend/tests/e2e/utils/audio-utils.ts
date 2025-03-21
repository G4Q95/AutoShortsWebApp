/**
 * Audio-specific test utilities
 * 
 * This file contains helper functions specifically for testing audio generation
 * operations like generating voiceovers and verifying audio playback.
 */

import { Page, Locator, expect } from '@playwright/test';
import { selectors, clickWithFallbacks, waitForWithFallbacks } from './selectors';
import { takeDebugScreenshot, waitForButtonReady } from './test-utils';

// Default timeout for audio generation
const AUDIO_GENERATION_TIMEOUT = 60000;

// Extend Window interface to support our mock audio properties
declare global {
  interface Window {
    USE_MOCK_AUDIO?: boolean;
    MOCK_AUDIO_BLOB?: Blob;
    MOCK_AUDIO_URL?: string;
  }
}

/**
 * Set up mock audio in the test environment
 * 
 * This function injects JavaScript into the browser to mock the audio generation
 * functionality, allowing tests to run without consuming ElevenLabs API credits.
 * It creates:
 * 1. A global flag (USE_MOCK_AUDIO) to enable mock mode
 * 2. A mock audio blob to simulate audio data
 * 3. A mock URL for the audio src attribute
 * 
 * The mock audio is automatically detected by the application code when the
 * window.USE_MOCK_AUDIO flag is set to true.
 * 
 * @param page - Playwright page object
 * @returns Promise resolving when mock audio is set up
 * 
 * @example
 * // Set up mock audio at the beginning of your test
 * test('Audio generation test', async ({ page }) => {
 *   await setupMockAudio(page);
 *   // Rest of your test using mock audio
 * });
 * 
 * @example
 * // Alternative setup with environment variable
 * // In your test file:
 * test.beforeEach(async ({ page }) => {
 *   if (process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true') {
 *     await setupMockAudio(page);
 *   }
 * });
 */
export async function setupMockAudio(page: Page) {
  console.log('Setting up mock audio generation');
  
  // Inject mock audio implementation
  await page.addInitScript(() => {
    // Set a flag that this test is running with mock audio
    window.USE_MOCK_AUDIO = true;
    console.log('Enabled mock audio mode in browser');
    
    // Mock the audio blob
    const mockAudioBlob = new Blob(
      [new Uint8Array(100).fill(0)], 
      { type: 'audio/mpeg' }
    );
    
    // Store the mock audio blob
    window.MOCK_AUDIO_BLOB = mockAudioBlob;
    
    // Create a mock URL
    window.MOCK_AUDIO_URL = URL.createObjectURL(mockAudioBlob);
    
    console.log('Created mock audio blob and URL');
  });
  
  console.log('Mock audio setup complete');
}

/**
 * Generate voice for a scene
 * 
 * @param page - Playwright page
 * @param sceneIndex - Index of scene to generate voice for (0-based)
 * @returns Promise resolving when voice generation is started
 * 
 * @example
 * // Generate voice for the first scene
 * await generateVoiceForScene(page);
 * 
 * // Generate voice for the second scene
 * await generateVoiceForScene(page, 1);
 */
export async function generateVoiceForScene(page: Page, sceneIndex = 0) {
  console.log(`Generating voice for scene at index ${sceneIndex}`);
  
  // Find the scene at the specified index
  const scenes = page.locator('[data-testid="scene-component"]');
  const sceneCount = await scenes.count();
  
  if (sceneCount <= sceneIndex) {
    throw new Error(`Cannot generate voice for scene at index ${sceneIndex}, only ${sceneCount} scenes exist`);
  }
  
  // Target the specific scene
  const scene = scenes.nth(sceneIndex);
  
  // Primary selector - direct and reliable
  const voiceButton = scene.locator('[data-testid="generate-voice-button"]');
  
  // Check if button exists with primary selector
  if (await voiceButton.count() > 0) {
    console.log('Found generate voice button with primary selector');
    await voiceButton.click({ timeout: 5000 });
    return;
  }
  
  // Fallback selectors - simplified list
  const fallbackSelectors = [
    'button:has-text("Generate Voiceover")',
    'button.generate-button',
    'button.bg-green-600',
    'button:has(svg[class*="mic"])'
  ];
  
  // Try fallback selectors
  for (const selector of fallbackSelectors) {
    try {
      const button = scene.locator(selector);
      if (await button.count() > 0) {
        console.log(`Found voice button with selector: ${selector}`);
        await button.click({ timeout: 3000 });
        return;
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  }
  
  // Last resort: take a screenshot and try buttons in the bottom section
  console.log("Using last resort approach for voice generation");
  await page.screenshot({ path: `voice-button-not-found-${Date.now()}.png` });
  
  try {
    // Find the bottom section of the scene card
    const bottomSection = scene.locator('.border-t');
    const buttons = bottomSection.locator('button');
    const count = await buttons.count();
    
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.innerText();
      
      // If it looks like a voice generation button, click it
      if (text.includes('Voice') || text.includes('Generate') || 
          await button.locator('svg').count() > 0) {
        await button.click({ timeout: 3000 });
        return;
      }
    }
  } catch (e) {
    console.error('Error in last resort approach:', e);
  }
  
  throw new Error('Voice generation button not found with any selector');
}

/**
 * Play the audio for a scene
 * 
 * @param page - Playwright page
 * @param sceneIndex - Index of scene to play audio for (0-based)
 * @returns Promise resolving when audio playback is attempted
 */
export async function playSceneAudio(page: Page, sceneIndex = 0) {
  console.log(`Playing audio for scene at index ${sceneIndex}`);
  
  // Find scenes
  const scenes = page.locator(selectors.sceneComponent);
  const sceneCount = await scenes.count();
  
  if (sceneCount <= sceneIndex) {
    throw new Error(`Cannot play audio for scene at index ${sceneIndex}, only ${sceneCount} scenes exist`);
  }
  
  // Find the audio element within this scene
  const scene = scenes.nth(sceneIndex);
  const audioElement = scene.locator('audio');
  const audioCount = await audioElement.count();
  
  if (audioCount === 0) {
    console.log('No audio element found, checking for play button');
    
    // Try to find and click a play button instead
    const playButton = scene.locator('[aria-label="Play"], button:has-text("Play")');
    const playButtonCount = await playButton.count();
    
    if (playButtonCount > 0) {
      console.log('Found play button, clicking it');
      await playButton.click();
    } else {
      throw new Error('No audio element or play button found in scene');
    }
  } else {
    console.log('Found audio element, clicking play');
    
    // Evaluate in browser context to play the audio
    await page.evaluate((sceneIndex) => {
      const scenes = document.querySelectorAll('[data-testid="scene-component"]');
      if (scenes.length > sceneIndex) {
        const audio = scenes[sceneIndex].querySelector('audio');
        if (audio) {
          audio.play().catch(err => console.error('Error playing audio:', err));
        }
      }
    }, sceneIndex);
  }
  
  console.log('Attempted to play audio');
}

/**
 * Change voice settings for a scene
 * 
 * @param page - Playwright page
 * @param sceneIndex - Index of scene to change voice for (0-based)
 * @param voiceIndex - Index of voice to select (0-based, if applicable)
 * @param stability - Stability value 0-100 (if applicable)
 * @param similarity - Similarity value 0-100 (if applicable)
 * @returns Promise resolving when settings are changed
 */
export async function changeVoiceSettings(
  page: Page, 
  sceneIndex = 0, 
  voiceIndex?: number, 
  stability?: number, 
  similarity?: number
) {
  console.log(`Changing voice settings for scene at index ${sceneIndex}`);
  
  // Find scenes
  const scenes = page.locator(selectors.sceneComponent);
  const sceneCount = await scenes.count();
  
  if (sceneCount <= sceneIndex) {
    throw new Error(`Cannot change voice for scene at index ${sceneIndex}, only ${sceneCount} scenes exist`);
  }
  
  // Find the scene
  const scene = scenes.nth(sceneIndex);
  
  // Find voice settings button or dropdown
  let settingsButton = scene.locator('button:has-text("Voice Settings"), [aria-label="Voice Settings"]');
  let buttonCount = await settingsButton.count();
  
  if (buttonCount === 0) {
    // Try alternative selector
    settingsButton = scene.locator('.voice-settings, button:has(svg)');
    buttonCount = await settingsButton.count();
    
    if (buttonCount === 0) {
      throw new Error('Could not find voice settings button');
    }
  }
  
  // Click the settings button to open settings
  await settingsButton.click();
  
  // Change voice if voiceIndex is provided
  if (voiceIndex !== undefined) {
    // Look for voice selector dropdown
    const voiceSelector = page.locator(selectors.voiceSelector);
    await voiceSelector.click();
    
    // Select voice by index
    const voiceOptions = page.locator('li[role="option"], .voice-option');
    const optionsCount = await voiceOptions.count();
    
    if (optionsCount <= voiceIndex) {
      throw new Error(`Cannot select voice at index ${voiceIndex}, only ${optionsCount} voices available`);
    }
    
    await voiceOptions.nth(voiceIndex).click();
    console.log(`Selected voice at index ${voiceIndex}`);
  }
  
  // Change stability if provided
  if (stability !== undefined) {
    // Find stability slider
    const stabilitySlider = page.locator('[aria-label="Stability"], input[type="range"][name="stability"]');
    const stabilityCount = await stabilitySlider.count();
    
    if (stabilityCount > 0) {
      // Set value (implementation depends on how your sliders work)
      await stabilitySlider.evaluate((el: HTMLInputElement, value: number) => {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, stability);
      
      console.log(`Set stability to ${stability}`);
    }
  }
  
  // Change similarity if provided
  if (similarity !== undefined) {
    // Find similarity slider
    const similaritySlider = page.locator('[aria-label="Similarity"], input[type="range"][name="similarity"]');
    const similarityCount = await similaritySlider.count();
    
    if (similarityCount > 0) {
      // Set value
      await similaritySlider.evaluate((el: HTMLInputElement, value: number) => {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, similarity);
      
      console.log(`Set similarity to ${similarity}`);
    }
  }
  
  // Save changes if there's a save button
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Apply")');
  const saveButtonCount = await saveButton.count();
  
  if (saveButtonCount > 0) {
    await saveButton.click();
    console.log('Saved voice settings');
  }
  
  console.log('Voice settings changed successfully');
}

/**
 * Verify audio generation is complete and successful
 * 
 * @param page - Playwright page
 * @param sceneIndex - Index of scene to verify (0-based)
 * @returns Promise resolving with boolean indicating if audio is available
 */
export async function verifyAudioGeneration(page: Page, sceneIndex = 0) {
  console.log(`Verifying audio generation for scene at index ${sceneIndex}`);
  
  // Find scenes
  const scenes = page.locator(selectors.sceneComponent);
  const sceneCount = await scenes.count();
  
  if (sceneCount <= sceneIndex) {
    throw new Error(`Cannot verify audio for scene at index ${sceneIndex}, only ${sceneCount} scenes exist`);
  }
  
  // Find the scene
  const scene = scenes.nth(sceneIndex);
  
  // Check for key audio indicators in order of reliability
  
  // 1. Most reliable: data attribute set by our code specifically for tests
  if (await scene.getAttribute('data-voice-generated') === 'true') {
    console.log('Found data-voice-generated attribute set to true');
    return true;
  }
  
  // 2. Test-specific audio element
  const testAudioElement = scene.locator('[data-testid="test-audio-element"], [data-testid="audio-element"]');
  if (await testAudioElement.count() > 0) {
    console.log('Found test audio element');
    return true;
  }
  
  // 3. Standard audio element within scene
  const audioElement = scene.locator('audio');
  if (await audioElement.count() > 0) {
    console.log('Found audio element');
    return true;
  }
  
  // 4. Check for visual indicators
  const audioControls = scene.locator('[data-testid="audio-play-button"], .audio-controls');
  if (await audioControls.count() > 0) {
    console.log('Found audio controls');
    return true;
  }
  
  // 5. Check if "Generate" button is replaced with playback controls
  const hasGenerateButton = await scene.locator('button:has-text("Generate")').count() > 0;
  if (!hasGenerateButton && await scene.locator('.audio-container, .back').count() > 0) {
    console.log('Generate button replaced with audio controls');
    return true;
  }
  
  console.log('No audio indicators found');
  return false;
}

/**
 * Close voice settings panel if it's open
 * 
 * @param page - Playwright page
 * @returns Promise resolving when panel is closed or confirmed not open
 */
export async function closeVoiceSettingsIfOpen(page: Page) {
  console.log('Checking if voice settings panel is open...');
  
  // Look for voice settings panel
  const voiceSettingsVisible = await page.locator('div[class*="voice-settings"]').isVisible() || 
                              await page.getByText('Voice Settings').isVisible();
  
  if (voiceSettingsVisible) {
    console.log('Voice settings panel is open, attempting to close it');
    
    // Try clicking the close button if it exists
    const closeButton = page.locator('button[aria-label="Close"]');
    if (await closeButton.isVisible()) {
      console.log('Found close button, clicking it');
      await closeButton.click();
      await page.waitForTimeout(500);
    } else {
      console.log('No close button found, trying escape key');
      // Try pressing escape key
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Click outside the panel as a last resort
    if (await page.locator('div[class*="voice-settings"]').isVisible() || 
        await page.getByText('Voice Settings').isVisible()) {
      console.log('Panel still open, trying to click outside it');
      // Click in the top-left corner of the page
      await page.mouse.click(10, 10);
      await page.waitForTimeout(500);
    }
    
    // Take a debug screenshot
    await takeDebugScreenshot(page, 'voice-settings-after-close');
  } else {
    console.log('Voice settings panel is not open, continuing');
  }
} 