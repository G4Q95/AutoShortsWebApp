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
 * @param page - Playwright page
 * @returns Promise resolving when mock audio is set up
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
 * @returns Promise resolving when voice generation completes
 */
export async function generateVoiceForScene(page: Page, sceneIndex = 0) {
  console.log(`Generating voice for scene at index ${sceneIndex}`);
  
  // Find the scene at the specified index
  const scenes = page.locator('[data-testid="scene-component"]');
  const sceneCount = await scenes.count();
  
  if (sceneCount <= sceneIndex) {
    throw new Error(`Cannot generate voice for scene at index ${sceneIndex}, only ${sceneCount} scenes exist`);
  }
  
  // Take a screenshot before attempting to generate
  await page.screenshot({ path: `before-voice-generation-${sceneIndex}-${Date.now()}.png` });
  
  // Target the specific scene
  const scene = scenes.nth(sceneIndex);
  
  // Try multiple approaches to find and click the voice generation button
  console.log(`Attempting to find voice generation button in scene ${sceneIndex}`);
  
  // List of selectors to try, from most specific to most general
  const voiceButtonSelectors = [
    // Data attribute selectors (most reliable when present)
    '[data-testid="voice-button"]',
    '[data-testid="voice-generation-button"]',
    '[data-testid="generate-voice-button"]',
    
    // Text-based selectors
    'button:has-text("Voice")',
    'button:has-text("Generate Voiceover")',
    'button:has-text("Generate Voice")',
    'button:has-text("Voice Narration")',
    
    // Attribute selectors
    '[aria-label="Voice Narration"]',
    '[aria-label*="voice"]',
    '[aria-label*="generate"]',
    
    // Role selectors
    'button:has(svg[class*="mic"])',
    'button.bg-blue-600',
    
    // Dynamic attribute combinations
    '.scene-component:nth-child(' + (sceneIndex + 1) + ') button.bg-blue-600',
    '.scene-component:nth-child(' + (sceneIndex + 1) + ') [data-testid="voice-button"]'
  ];
  
  // Log all attempts for debugging
  let buttonFound = false;
  
  for (const selector of voiceButtonSelectors) {
    try {
      console.log(`Trying to find voice button with selector: ${selector}`);
      
      // For scene-specific selectors
      if (selector.startsWith('.scene-component:nth-child')) {
        const button = page.locator(selector);
        if (await button.count() > 0) {
          console.log(`Found voice button with selector: ${selector}`);
          await button.click({ timeout: 5000 });
          buttonFound = true;
          break;
        }
      } 
      // For within-scene selectors
      else {
        const button = scene.locator(selector);
        if (await button.count() > 0) {
          console.log(`Found voice button with selector: ${selector} within scene`);
          await button.click({ timeout: 5000 });
          buttonFound = true;
          break;
        }
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  }
  
  // If no button was found with scene-specific approaches, try fallbacks
  if (!buttonFound) {
    console.log("No voice button found with scene-specific selectors, trying global buttons...");
    
    // Try general button fallbacks
    const generalButtonSelectors = [
      'button.voice-narration',
      '.bg-blue-600:not([data-testid="scene-number"])',
      '.voice-button',
      'button:below(.scene-text)',
      'button:right-of([data-testid="scene-number"])'
    ];
    
    // Count all blue buttons for debugging
    const blueButtons = page.locator('.bg-blue-600');
    const blueButtonCount = await blueButtons.count();
    console.log(`Found ${blueButtonCount} blue buttons that might be voice buttons`);
    
    for (let i = 0; i < blueButtonCount; i++) {
      try {
        const buttonText = await blueButtons.nth(i).innerText();
        console.log(`Blue button ${i} text: "${buttonText}"`);
      } catch (e) {
        console.log(`Could not get text for blue button ${i}`);
      }
    }
    
    // Try each selector
    for (const selector of generalButtonSelectors) {
      try {
        console.log(`Trying fallback selector: ${selector}`);
        const buttons = page.locator(selector);
        const count = await buttons.count();
        
        console.log(`Found ${count} buttons with selector: ${selector}`);
        
        if (count > sceneIndex) {
          await buttons.nth(sceneIndex).click({ timeout: 5000 });
          buttonFound = true;
          break;
        } else if (count > 0) {
          // If we don't have enough buttons for the scene index, just click the first one
          await buttons.first().click({ timeout: 5000 });
          buttonFound = true;
          break;
        }
      } catch (e) {
        console.log(`Error with fallback selector ${selector}:`, e);
      }
    }
  }
  
  // Last resort: try to click the voice button by finding scene components and clicking their buttons
  if (!buttonFound) {
    console.log("Trying last resort approach: find any button in the scene");
    try {
      const sceneButtons = scene.locator('button');
      const buttonCount = await sceneButtons.count();
      console.log(`Found ${buttonCount} buttons in scene ${sceneIndex}`);
      
      // Take screenshot of the scene structure
      await scene.screenshot({ path: `scene-${sceneIndex}-buttons-${Date.now()}.png` });
      
      // Try each button
      for (let i = 0; i < buttonCount; i++) {
        try {
          const buttonText = await sceneButtons.nth(i).innerText();
          console.log(`Button ${i} text: "${buttonText}"`);
          
          // If the button has voice-related text, click it
          if (buttonText.toLowerCase().includes('voice') || 
              buttonText.toLowerCase().includes('narration') ||
              buttonText.toLowerCase().includes('audio')) {
            console.log(`Found likely voice button with text: "${buttonText}"`);
            await sceneButtons.nth(i).click({ timeout: 5000 });
            buttonFound = true;
            break;
          }
        } catch (e) {
          console.log(`Error checking button ${i}:`, e);
        }
      }
      
      // If still not found, try the button with the MIC icon or blue color
      if (!buttonFound) {
        for (let i = 0; i < buttonCount; i++) {
          try {
            // Check for mic icon or blue button
            const hasIcon = await sceneButtons.nth(i).locator('svg').count() > 0;
            const isBlue = await sceneButtons.nth(i).evaluate(el => {
              return el.classList.contains('bg-blue-600') || 
                    window.getComputedStyle(el).backgroundColor.includes('rgb(37, 99, 235)');
            });
            
            if (hasIcon || isBlue) {
              console.log(`Found button ${i} with icon or blue color`);
              await sceneButtons.nth(i).click({ timeout: 5000 });
              buttonFound = true;
              break;
            }
          } catch (e) {
            console.log(`Error with icon/color check for button ${i}:`, e);
          }
        }
      }
    } catch (e) {
      console.log(`Error with last resort approach:`, e);
    }
  }
  
  if (!buttonFound) {
    console.error('Could not find voice generation button with any selector');
    await page.screenshot({ path: `voice-button-not-found-${sceneIndex}-${Date.now()}.png` });
    throw new Error('Voice generation button not found with any selector');
  }
  
  // Wait for the voice to be generated
  console.log('Waiting for voice to be generated...');
  
  // Set buttonFound to true since we'll be checking separately
  let voiceGenerated = false;
  
  // Take a screenshot before checking for completion indicators
  await page.screenshot({ path: `before-voice-generation-${sceneIndex}-${Date.now()}.png` });
  
  // Check for voice generation completion indicators
  const successIndicators = [
    'text=Generated successfully',
    'audio',
    '[data-testid="audio-player"]',
    '.audio-player',
    '.audio-controls',
    'audio[src]'
  ];
  
  // Try each success indicator
  console.log('Checking for audio element or success message...');
  let generationComplete = false;
  
  // Give it a little time to start generation
  await page.waitForTimeout(1000);
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Attempt ${attempt} to check for voice generation completion...`);
    
    for (const indicator of successIndicators) {
      try {
        const elements = scene.locator(indicator);
        const count = await elements.count();
        
        console.log(`Found ${count} elements with indicator: ${indicator}`);
        
        if (count > 0) {
          console.log(`Voice generation complete (found ${indicator})`);
          generationComplete = true;
          break;
        }
      } catch (e) {
        console.log(`Error checking indicator ${indicator}:`, e);
      }
    }
    
    if (generationComplete) break;
    
    console.log('No completion indicator found yet, waiting...');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `waiting-for-generation-${attempt}-${sceneIndex}-${Date.now()}.png` });
  }
  
  if (!generationComplete) {
    console.log('No audio element found, looking for success indicator');
    try {
      // Last resort: wait for success text with a shorter timeout
      await page.waitForSelector('text=Generated successfully', { timeout: 4000 });
      generationComplete = true;
      console.log('Voice generation success message found');
    } catch (e) {
      console.log('No success message found either');
    }
  }
  
  // Take a final screenshot to see the state after generation attempt
  await page.screenshot({ path: `after-voice-generation-${sceneIndex}-${Date.now()}.png` });
  
  if (!generationComplete) {
    console.error('Voice generation may have failed - no success indicators found');
  } else {
    console.log('Voice generation completed successfully');
  }
  
  return generationComplete;
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
  
  // Check for audio element
  const audioElement = scene.locator('audio');
  const audioCount = await audioElement.count();
  
  // Take screenshot for debugging
  await takeDebugScreenshot(page, `audio-verification-${sceneIndex}`);
  
  if (audioCount === 0) {
    // Check for other indicators that audio generation succeeded
    const successIndicator = scene.locator('.audio-success, .voice-generated, [data-voice-generated="true"]');
    const indicatorCount = await successIndicator.count();
    
    if (indicatorCount > 0) {
      console.log('No audio element found but success indicator is present');
      return true;
    }
    
    console.log('No audio element or success indicator found');
    return false;
  }
  
  console.log('Audio element found, checking if it has a source');
  
  // Check if audio has a source
  const hasSource = await audioElement.evaluate((el: HTMLAudioElement) => {
    return Boolean(el.src) || Boolean(el.getAttribute('src'));
  });
  
  console.log(`Audio source present: ${hasSource}`);
  return hasSource;
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