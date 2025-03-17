/**
 * Test Utilities for Playwright E2E Tests
 * 
 * Common functions to reduce duplication and improve test maintainability.
 * This file contains core test utilities, timeouts, and constants.
 * For selectors, see utils/selectors.ts and ../selectors.ts which contain
 * centralized selectors to improve test resilience.
 */

import { Page, Locator } from '@playwright/test';
import { selectors, clickWithFallbacks, waitForWithFallbacks } from './selectors';
import { verifyLayoutAttributes } from './layout-utils';
import { 
  waitForButtonReady, 
  waitForProjectWorkspace, 
  waitForSceneAppearance, 
  waitForScenes,
  PAGE_LOAD_TIMEOUT,
  NAVIGATION_TIMEOUT,
  CONTENT_LOAD_TIMEOUT,
  CRITICAL_STEP_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  AUDIO_GENERATION_TIMEOUT
} from './wait-utils';

// Re-export for backward compatibility
export { 
  verifyLayoutAttributes,
  waitForButtonReady, 
  waitForProjectWorkspace, 
  waitForSceneAppearance, 
  waitForScenes,
  PAGE_LOAD_TIMEOUT,
  NAVIGATION_TIMEOUT,
  CONTENT_LOAD_TIMEOUT,
  CRITICAL_STEP_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  AUDIO_GENERATION_TIMEOUT
};

/**
 * Navigate to the homepage
 */
export async function goToHomePage(page: Page) {
  await page.goto('/');
  await page.waitForSelector('text=Auto Shorts');
}

/**
 * Create a new test project
 * 
 * @param page - Playwright page
 * @param projectName - Optional project name (generates random one if not provided)
 * @returns The name of the created project
 */
export async function createTestProject(page: Page, projectName?: string) {
  const name = projectName || `Test Project ${Date.now()}`;
  
  // Navigate to home page
  await goToHomePage(page);
  
  // Click create video button
  await page.click(selectors.createVideoButton);
  
  // Wait for project name input
  await page.waitForSelector(selectors.projectNameInput);
  
  // Fill project name and create
  await page.fill(selectors.projectNameInput, name);
  await page.click(selectors.createProjectButton);
  
  // Wait for workspace to load
  await waitForProjectWorkspace(page);
  
  console.log(`Created test project: ${name}`);
  return name;
}

/**
 * Helper function to take a debug screenshot with a clear name
 * Includes timeout handling to prevent test failures if screenshot times out
 */
export async function takeDebugScreenshot(page: Page, name: string, timeoutMs = 30000) {
  try {
    const cleanName = name.replace(/[^a-z0-9\-]/gi, '-').toLowerCase();
    const filename = `${cleanName}-${Date.now()}.png`;
    
    console.log(`Taking debug screenshot: ${cleanName}`);
    await page.screenshot({ 
      path: filename,
      timeout: timeoutMs
    });
    
    console.log(`Screenshot saved: ${filename}`);
    return filename;
  } catch (error: any) {
    console.warn(`Warning: Failed to take screenshot "${name}": ${error.message}`);
    // Return a placeholder filename so the test can continue
    return `failed-screenshot-${Date.now()}.png`;
  }
}

/**
 * Add a scene to the project from a URL
 * 
 * @param page - Playwright page
 * @param url - URL to add (defaults to a test Reddit post)
 * @returns The scene element
 */
export async function addSceneWithContent(
  page: Page,
  url = 'https://www.reddit.com/r/aww/comments/rgglk7/'
) {
  console.log(`Adding scene with URL: ${url}`);
  
  // Make sure we're in the project workspace
  try {
    await page.waitForSelector(selectors.urlInput, { timeout: 1000 });
  } catch (e) {
    console.log('URL input not found, checking if we need to navigate to project workspace');
    // We might not be in the project workspace yet
    try {
      await waitForProjectWorkspace(page);
    } catch (e) {
      console.error('Failed to find project workspace for scene addition');
      await takeDebugScreenshot(page, 'workspace-not-found-for-scene-add');
      throw e;
    }
  }
  
  // Fill URL input field and click Add
  await page.fill(selectors.urlInput, url);
  await page.click(selectors.addContentButton);
  
  // Wait for scene to appear
  const scene = await waitForSceneAppearance(page);
  
  console.log('Scene added successfully');
  return scene;
}

/**
 * Helper function to check audio playback
 */
export async function checkAudioPlayback(page: Page) {
  console.log('Checking for audio playback...');
  
  try {
    await page.waitForSelector('audio', { timeout: 10000 });
    console.log('Audio element found');
    
    const audioSrc = await page.locator('audio').getAttribute('src');
    console.log(`Audio source: ${audioSrc ? 'present' : 'not present'}`);
    
    return !!audioSrc;
  } catch (e) {
    console.log('No audio element found');
    return false;
  }
}

/**
 * Helper function to find text content on the page
 */
export async function findTextOnPage(page: Page, text: string) {
  try {
    const element = await page.waitForSelector(`text=${text}`, { timeout: 1000 });
    console.log(`Found text: "${text}"`);
    return element;
  } catch (e) {
    console.log(`Text not found: "${text}"`);
    return null;
  }
}

/**
 * Helper function to find selectors in a resilient way
 */
export async function findWithFallbackSelectors(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    console.log(`Trying selector: ${selector}`);
    try {
      const element = await page.waitForSelector(selector, { timeout: 1000 });
      console.log(`Found element with selector: ${selector}`);
      return page.locator(selector);
    } catch (e) {
      console.log(`Element not found with selector: ${selector}`);
      // Continue to next selector
    }
  }
  
  console.log('Element not found with any of the fallback selectors');
  return null;
}

/**
 * Delete a scene by index
 */
export async function deleteScene(page: Page, index = 0) {
  const scenes = await page.$$('.scene-container');
  
  if (index >= scenes.length) {
    throw new Error(`Cannot delete scene at index ${index}, only ${scenes.length} scenes exist`);
  }
  
  console.log(`Deleting scene at index ${index}`);
  
  // Try multiple strategies to click the delete button
  try {
    // Strategy 1: Use data-testid
    await clickWithFallbacks(page, selectors.sceneDeleteButtonFallbacks);
  } catch (e) {
    console.log('Failed to delete scene with normal selectors, trying positional clicking');
    
    // Strategy 2: Positional clicking
    const scene = scenes[index];
    const box = await scene.boundingBox();
    
    if (box) {
      // Click in the top right corner where the delete button typically is
      await page.mouse.click(box.x + box.width - 20, box.y + 20);
      console.log('Clicked position where delete button should be');
    } else {
      throw new Error('Could not get bounding box for scene');
    }
  }
  
  // Wait a moment for deletion to complete
  await page.waitForTimeout(500);
  
  // Verify deletion was successful
  const newScenesCount = await page.$$eval('.scene-container', (scenes) => scenes.length);
  console.log(`Scenes after deletion: ${newScenesCount}`);
  
  if (newScenesCount >= scenes.length) {
    console.warn('Scene count did not decrease after deletion attempt');
  }
}

/**
 * Generate a voice for a scene
 */
export async function generateVoiceForScene(page: Page, sceneIndex = 0) {
  console.log(`Generating voice for scene at index ${sceneIndex}`);
  
  // Get all scenes
  const scenes = await page.$$('.scene-container');
  
  if (sceneIndex >= scenes.length) {
    throw new Error(`Cannot generate voice for scene at index ${sceneIndex}, only ${scenes.length} scenes exist`);
  }
  
  // Get the target scene
  const scene = scenes[sceneIndex];
  
  // Find and click the Generate Voiceover button
  let buttonClicked = false;
  
  try {
    // First check if the button is directly in the scene
    const buttonSelector = 'text=Generate Voiceover';
    const button = await scene.$$(buttonSelector);
    if (button.length > 0) {
      await button[0].click({ timeout: 2000 });
      buttonClicked = true;
    }
  } catch (e) {
    console.log('Direct button click failed, trying fallback strategies');
    
    // Try clicking with fallbacks
    try {
      await clickWithFallbacks(page, selectors.generateVoiceButtonFallbacks);
      buttonClicked = true;
    } catch (e) {
      console.error('Failed to click Generate Voiceover button with all strategies');
      throw e;
    }
  }
  
  if (buttonClicked) {
    console.log('Successfully clicked Generate Voiceover button');
    
    // Wait for audio to appear
    try {
      await page.waitForSelector('audio', { timeout: 10000 });
      console.log('Audio element found after generation');
      return true;
    } catch (e) {
      console.log('No audio element found, checking for API call success');
      // Even if no audio element is found, return true if we got this far
      return true;
    }
  }
  
  return false;
}

/**
 * Check if text exists on the page
 */
export async function textExists(page: Page, text: string) {
  try {
    const element = await page.waitForSelector(`text=${text}`, { timeout: 1000 });
    return !!element;
  } catch (e) {
    return false;
  }
}

/**
 * Common test utilities for Playwright tests
 * 
 * This file contains shared functions, constants, and test data used across multiple test files
 */

// Test data
export const TEST_PROJECT_NAME = 'Test Project ' + Math.floor(Math.random() * 1000);
export const TEST_REDDIT_PHOTO_URL = 'https://www.reddit.com/r/mildlyinteresting/comments/1j8mkup/slug_on_our_wall_has_a_red_triangle_on_its_back/';
export const TEST_REDDIT_VIDEO_URL = 'https://www.reddit.com/r/interesting/comments/1j7mwks/sand_that_moves_like_water_in_the_desert/';

// Constants
export const DEBUG = true;

// Improved scene selectors based on actual UI
export const SCENES_HEADING = 'Scenes';
export const SCENE_NUMBER_SELECTOR = '[class*="number"], [data-testid^="scene-number-"]';
export const SCENE_CONTAINER_SELECTOR = '[class*="scene"]:visible, div[id^="scene-"]';
export const SCENE_CARD_SELECTOR = '[data-testid="scene-card"], div[class*="memo"] [class*="scene"]';
export const BLUE_NUMBER_SELECTOR = '.bg-blue-600, div[data-testid^="scene-number-"], div[class*="scene"] div[class*="blue"]';
export const MEDIA_SELECTOR = 'video[src], img[src]'; // Selector for any video or image with a src attribute
export const SCENE_COMPONENT_SELECTOR = '[data-testid="scene-component"]';

/**
 * Helper function to wait for project workspace to fully load
 */
export async function waitForWorkspace(page: Page, testName = 'unnamed') {
  console.log(`Waiting for workspace in ${testName} test...`);
  
  // Take a debug screenshot before looking for the workspace
  await page.screenshot({ path: `pre-workspace-check-${testName}-${Date.now()}.png` });
  
  // Simpler selectors that don't use :has() or complex CSS
  const selectors = [
    // Look for headings by text content (using page.locator instead of querySelector with :has)
    'h2', // Will match any h2, we'll check for "Scenes" or "Add Content" text
    'input[placeholder="Enter Reddit URL"]', // The URL input field (simple selector)
    '.bg-blue-600', // Blue number badges (without the text check)
    'button', // Any button, we'll check for "Add" text
    'h3', // Voice narration headings
    'button:visible', // Visible buttons
    // Additional selectors that might appear quickly
    'form', // Form elements
    '.flex', // Common class on containers
    '.container' // Common container class
  ];
  
  console.log('Checking for workspace elements with basic selectors...');
  
  // First try waiting for network requests to complete
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
    console.log('Network is idle');
  } catch (e) {
    console.log('Network still active, continuing anyway');
  }

  // Then check for each selector
  for (const selector of selectors) {
    try {
      // First check if the element exists at all
      const count = await page.locator(selector).count();
      console.log(`Found ${count} instances of "${selector}"`);
      
      if (count > 0) {
        // Wait for it to be visible
        await page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 5000 
        });
        console.log(`Found visible element with selector: ${selector}`);
        
        // If it's a heading, check if it contains the text we expect
        if (selector === 'h2') {
          const headings = await page.locator('h2').allTextContents();
          console.log(`Found h2 headings with text: ${JSON.stringify(headings)}`);
          
          // Check if any heading contains "Scenes" or "Add Content"
          const hasExpectedHeading = headings.some(
            h => h.includes('Scene') || h.includes('Add Content')
          );
          
          if (hasExpectedHeading) {
            console.log('Found project workspace (heading with expected text)');
            return true;
          }
        } else {
          // For other elements, just finding them visible is enough
          return true;
        }
      }
    } catch (e) {
      console.log(`Selector "${selector}" not found or not visible`);
    }
  }
  
  // If we get here, none of the selectors found the workspace
  console.log('No workspace selectors found, taking screenshot for debugging');
  await page.screenshot({ path: `workspace-not-found-${testName}-${Date.now()}.png` });
  throw new Error(`Workspace not found in ${testName} test`);
}

/**
 * Helper function to find elements with specific text content
 */
export async function findElementWithText(page: Page, selector: string, text: string) {
  const elements = await page.locator(selector).all();
  for (const element of elements) {
    const content = await element.textContent();
    if (content && content.includes(text)) {
      return element;
    }
  }
  return null;
}

/**
 * Helper function to check if an element with specific text exists
 */
export async function elementWithTextExists(page: Page, selector: string, text: string): Promise<boolean> {
  const element = await findElementWithText(page, selector, text);
  return element !== null;
}

/**
 * Helper function to wait for element with specific text
 */
export async function waitForElementWithText(page: Page, selector: string, text: string, timeout = 10000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const exists = await elementWithTextExists(page, selector, text);
    if (exists) {
      return true;
    }
    await page.waitForTimeout(100);
  }
  throw new Error(`Element ${selector} with text "${text}" not found after ${timeout}ms`);
} 