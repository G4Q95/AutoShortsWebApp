/**
 * Waiting and polling utilities
 * 
 * This file contains helper functions for waiting operations in tests such as
 * waiting for elements to appear, waiting for conditions, polling, etc.
 */

import { Page, Locator, expect } from '@playwright/test';
import { selectors } from './selectors';
import { takeDebugScreenshot } from './test-utils';
import { findElementWithText, elementWithTextExists } from './navigation-utils';

// Common timeouts
export const PAGE_LOAD_TIMEOUT = 7000;
export const NAVIGATION_TIMEOUT = 10000;
export const CONTENT_LOAD_TIMEOUT = 15000;
export const CRITICAL_STEP_TIMEOUT = 20000;
export const SCENE_MEDIA_TIMEOUT = 15000;
export const AUDIO_GENERATION_TIMEOUT = 15000;
export const UI_STABILIZATION_DELAY = 500;

/**
 * Wait for a button to be ready (visible and enabled)
 * 
 * @param page - Playwright page
 * @param buttonLocator - Either a string selector or a Locator object
 * @param timeout - Maximum time to wait in milliseconds
 * @returns A boolean indicating if the button is ready
 */
export async function waitForButtonReady(
  page: Page, 
  buttonLocator: string | Locator, 
  timeout = 5000
): Promise<boolean> {
  console.log(`Waiting for button to be ready: ${typeof buttonLocator === 'string' ? buttonLocator : 'Locator'}`);
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      let button: Locator;
      
      if (typeof buttonLocator === 'string') {
        try {
          button = page.locator(buttonLocator);
          if (await button.count() === 0) {
            console.log(`Button not found with selector: ${buttonLocator}`);
            await page.waitForTimeout(500);
            continue;
          }
        } catch (e) {
          console.log(`Invalid selector: ${buttonLocator}`);
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
  await takeDebugScreenshot(page, 'button-not-ready');
  return false;
}

/**
 * Wait for project workspace to load
 * 
 * @param page - Playwright page
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns A boolean indicating success
 */
export async function waitForProjectWorkspace(page: Page, timeoutMs = 20000): Promise<boolean> {
  console.log('Waiting for project workspace to load...');
  try {
    console.log('Current URL:', page.url());
    await page.waitForSelector(selectors.projectWorkspace, { timeout: timeoutMs });
    console.log('Project workspace loaded successfully');
    return true;
  } catch (error: any) {
    console.error('Error waiting for project workspace:', error.message);
    console.log('Taking debug screenshot...');
    await takeDebugScreenshot(page, 'workspace-not-found');
    
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
 * Wait for scene appearance
 * 
 * @param page - Playwright page
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns The scene element Locator
 */
export async function waitForSceneAppearance(page: Page, timeoutMs = 30000): Promise<Locator> {
  console.log('Waiting for scene to appear...');
  
  try {
    const scene = await page.waitForSelector(selectors.sceneComponent, { timeout: timeoutMs });
    console.log('Scene appears to have been added successfully');
    return page.locator(selectors.sceneComponent).first();
  } catch (e) {
    console.log('Primary scene selector not found, trying fallback...');
    
    try {
      const scene = await page.waitForSelector(selectors.sceneContainer, { timeout: 5000 });
      console.log('Scene found using fallback selector');
      return page.locator(selectors.sceneContainer).first();
    } catch (e) {
      console.error('Failed to find scene with all selectors');
      await takeDebugScreenshot(page, 'scene-not-found');
      throw new Error('Scene not found with any selector');
    }
  }
}

/**
 * Wait for a specific number of scenes
 * 
 * @param page - Playwright page
 * @param expectedCount - Expected number of scenes
 * @param testName - Name of the test for logging
 * @returns The scene count when successful
 */
export async function waitForScenes(page: Page, expectedCount = 1, testName = 'unnamed'): Promise<number> {
  console.log(`Waiting for ${expectedCount} scene(s) to appear in ${testName}...`);
  
  try {
    // Wait for the Scenes heading
    await page.waitForSelector('h2:has-text("Scenes"), h3:has-text("Scenes")', {
      timeout: 15000
    });
    console.log('Found Scenes heading');
    
    // Wait and check if we have the expected number of scenes
    await expect
      .poll(
        async () => {
          const sceneElements = await page.locator('[data-testid^="scene-number-"]').all();
          console.log(`Found ${sceneElements.length} elements with selector: [data-testid^="scene-number-"]`);
          return sceneElements.length;
        },
        {
          message: `Waiting for ${expectedCount} scenes`,
          timeout: 15000,
        }
      )
      .toBeGreaterThanOrEqual(expectedCount);
    
    const sceneCount = await page.locator('[data-testid^="scene-number-"]').count();
    console.log(`Found expected ${expectedCount} scene(s) with selector: [data-testid^="scene-number-"]`);
    
    // Verify first scene is visible
    const firstScene = page.locator('[data-testid^="scene-number-"]').first();
    if (await firstScene.isVisible()) {
      console.log('First scene element is visible');
    } else {
      console.log('Warning: First scene is not visible');
      await takeDebugScreenshot(page, `scene-not-visible-${testName}`);
    }
    
    return sceneCount;
  } catch (error) {
    console.error(`Failed to find ${expectedCount} scenes:`, error);
    await takeDebugScreenshot(page, `scenes-not-found-${testName}`);
    throw error;
  }
}

/**
 * Sleep for a specified duration
 * 
 * @param ms - Duration in milliseconds
 * @returns A promise that resolves after the duration
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function until it succeeds or times out
 * 
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns The result of the function
 */
export async function retry<T>(
  fn: () => Promise<T>, 
  options: { 
    maxAttempts?: number; 
    interval?: number; 
    timeout?: number;
    name?: string;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 5,
    interval = 1000,
    timeout = 30000,
    name = 'operation'
  } = options;
  
  console.log(`Starting retry for ${name} (max attempts: ${maxAttempts}, interval: ${interval}ms, timeout: ${timeout}ms)`);
  
  const startTime = Date.now();
  let attempts = 0;
  
  while (attempts < maxAttempts && Date.now() - startTime < timeout) {
    attempts++;
    
    try {
      const result = await fn();
      console.log(`${name} succeeded on attempt ${attempts}`);
      return result;
    } catch (error) {
      console.log(`Attempt ${attempts} failed:`, error);
      
      if (attempts >= maxAttempts || Date.now() - startTime >= timeout) {
        console.error(`${name} failed after ${attempts} attempts (${Date.now() - startTime}ms)`);
        throw error;
      }
      
      await sleep(interval);
    }
  }
  
  throw new Error(`${name} failed after ${attempts} attempts (${Date.now() - startTime}ms)`);
} 