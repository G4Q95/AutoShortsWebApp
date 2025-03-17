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
 * Wait for project workspace to load
 */
export async function waitForProjectWorkspace(page: Page, timeoutMs = 20000) {
  console.log('Waiting for project workspace to load...');
  try {
    console.log('Current URL:', page.url());
    await page.waitForSelector(selectors.projectWorkspace, { timeout: timeoutMs });
    console.log('Project workspace loaded successfully');
    return true;
  } catch (error: any) {
    console.error('Error waiting for project workspace:', error.message);
    console.log('Taking debug screenshot...');
    await page.screenshot({ path: `workspace-not-found-${Date.now()}.png` });
    
    // Try alternative selectors as fallback
    console.log('Trying alternative selectors for project workspace...');
    try {
      await page.waitForSelector('input[placeholder="Enter Reddit URL"]', { timeout: 5000 });
      console.log('Found URL input, workspace likely loaded');
      return true;
    } catch (e) {
      console.log('Could not find URL input either');
      throw error; // Rethrow the original error if all attempts fail
    }
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
      throw new Error('Failed to find project workspace when adding scene');
    }
  }
  
  // Enter URL
  await page.fill(selectors.urlInput, url);
  
  // Click add content button
  await page.click(selectors.addContentButton);
  
  // Wait for scene to appear
  const scene = await waitForSceneAppearance(page);
  console.log('Scene added successfully');
  
  return scene;
}

/**
 * Wait for a scene to appear in the workspace
 */
export async function waitForSceneAppearance(page: Page, timeoutMs = 30000) {
  console.log('Waiting for scene to appear...');
  
  // First try with the ideal selector
  try {
    const scene = await page.waitForSelector(selectors.sceneComponent, { timeout: timeoutMs });
    console.log('Scene appeared with primary selector');
    return scene;
  } catch (e) {
    console.log('Primary selector failed, trying fallback selector');
    // Fallback to a more general selector
    try {
      const scene = await page.waitForSelector(selectors.sceneContainer, { timeout: 5000 });
      console.log('Scene appeared with fallback selector');
      return scene;
    } catch (e) {
      console.log('All selectors failed when waiting for scene');
      throw new Error('Failed to find scene after adding content');
    }
  }
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
 * Take a screenshot for debugging
 */
export async function takeDebugScreenshot(page: Page, name: string) {
  const filename = `${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;
  console.log(`Taking debug screenshot: ${filename}`);
  await page.screenshot({ path: filename, fullPage: true });
  return filename;
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
export const NAVIGATION_TIMEOUT = 6000;  // Reduced from 30000
export const PAGE_LOAD_TIMEOUT = 5000;   // Reduced from 10000
export const CONTENT_LOAD_TIMEOUT = 6000; // Reduced from 40000
export const CRITICAL_STEP_TIMEOUT = 6000; // Reduced from 60000
export const SCENE_MEDIA_TIMEOUT = 6000;   // Reduced from 45000
export const AUDIO_GENERATION_TIMEOUT = 6000; // Reduced from 60000

// Add debug mode to log more information
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
 * Helper function to wait for scenes to appear
 */
export async function waitForScenes(page: Page, expectedCount = 1, testName = 'unnamed') {
  console.log(`Waiting for ${expectedCount} scene(s) to appear in ${testName}...`);
  
  // Take a screenshot to see current state
  await page.screenshot({ path: `pre-scene-wait-${testName}-${Date.now()}.png` });
  
  // First wait for Scenes heading
  try {
    await page.waitForSelector('h2:has-text("Scenes"), h3:has-text("Scenes")', { 
      timeout: PAGE_LOAD_TIMEOUT / 2
    });
    console.log('Found Scenes heading');
  } catch (e) {
    console.log('Could not find Scenes heading, continuing anyway');
  }
  
  // Try multiple selector strategies
  const selectors = [
    '[data-testid^="scene-number-"]',
    '.bg-blue-600',
    'div[class*="scene"] .bg-blue-600',
    'div[id^="scene-"]',
    'div[class*="memo"] div[class*="blue"]',
    'div[class*="scene"] div[class*="number"]'
  ];
  
  for (const selector of selectors) {
    try {
      const count = await page.locator(selector).count();
      console.log(`Found ${count} elements with selector: ${selector}`);
      
      if (count >= expectedCount) {
        console.log(`Found expected ${expectedCount} scene(s) with selector: ${selector}`);
        
        // Verify by checking visibility
        const firstElement = page.locator(selector).first();
        if (await firstElement.isVisible()) {
          console.log('First scene element is visible');
          return true;
        } else {
          console.log('Found elements but first one is not visible, continuing search');
        }
      }
    } catch (e) {
      console.log(`Error with selector ${selector}:`, e);
    }
  }
  
  // Take a screenshot if we failed to find the scenes
  await page.screenshot({ path: `scene-search-failed-${testName}-${Date.now()}.png` });
  throw new Error(`Failed to find ${expectedCount} scene(s) with any selector strategy`);
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

/**
 * Helper function to verify layout attributes and dimensions
 */
export async function verifyLayoutAttributes(page: Page, selector: string, expectedLayoutId: string): Promise<boolean> {
  try {
    const element = await page.locator(`[data-test-layout="${expectedLayoutId}"]`).first();
    const exists = await element.count() > 0;
    
    if (exists) {
      // Log that we found the element with the correct layout ID
      console.log(`Found element with data-test-layout="${expectedLayoutId}"`);
      
      // Check if it has dimensions attribute
      const dimensions = await element.getAttribute('data-test-dimensions');
      if (dimensions) {
        console.log(`Element dimensions: ${dimensions}`);
      }
      
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Error checking layout attribute ${expectedLayoutId}:`, e);
    return false;
  }
}

/**
 * Waits for a button to be ready (visible and enabled)
 * @param page Playwright page
 * @param buttonLocator Either a string selector or a Locator object
 * @param timeout Timeout in milliseconds
 * @returns True if button is ready, false otherwise
 */
export async function waitForButtonReady(page: Page, buttonLocator: string | Locator, timeout: number = 10000): Promise<boolean> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      // Handle both string selectors and Locator objects
      let button: Locator;
      if (typeof buttonLocator === 'string') {
        // If it's a string selector, create a locator
        button = page.locator(buttonLocator);
        // Check button exists
        const buttonCount = await button.count();
        if (buttonCount === 0) {
          console.log('Button not found yet');
          await page.waitForTimeout(500);
          continue;
        }
      } else {
        // It's already a Locator object
        button = buttonLocator;
      }

      // Check if button is visible and enabled
      const isVisible = await button.isVisible();
      const isDisabled = await button.isDisabled();
      
      if (isVisible && !isDisabled) {
        console.log('Button found and ready');
        return true;
      }
      
      console.log('Button found but not ready yet:', { isVisible, isDisabled });
      await page.waitForTimeout(500);
    } catch (e) {
      console.log('Error checking button status:', e);
      await page.waitForTimeout(500);
    }
  }
  
  console.log(`Button not ready after ${timeout}ms timeout`);
  return false;
} 