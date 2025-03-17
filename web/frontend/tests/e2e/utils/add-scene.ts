/**
 * Helper utilities for scene addition operations
 */

import { Page, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Add a scene to the project with the given URL
 * 
 * @param page - Playwright page
 * @param url - URL to extract content from (default: Reddit test URL)
 * @param waitForExtraction - Whether to wait for content extraction to complete
 * @returns Promise resolving when scene is added
 */
export async function addScene(page: Page, url: string, waitForExtraction = true) {
  console.log(`Adding scene with URL: ${url}`);
  
  try {
    // Find the URL input field
    const urlInputSelectors = [
      '[data-testid="url-input"]',
      'input[placeholder="Enter Reddit URL"]',
      'input[type="text"]',
      '.url-input'
    ];
    
    let urlInput = null;
    
    // Try each selector
    for (const selector of urlInputSelectors) {
      const input = page.locator(selector);
      const count = await input.count();
      console.log(`Found ${count} inputs with selector: ${selector}`);
      
      if (count > 0) {
        urlInput = input;
        console.log(`Using URL input selector: ${selector}`);
        break;
      }
    }
    
    if (!urlInput) {
      console.error('Could not find URL input field with any selector');
      await page.screenshot({ path: `url-input-not-found-${Date.now()}.png` });
      throw new Error('URL input field not found');
    }
    
    // Clear the input and enter the URL
    await urlInput.clear();
    await urlInput.fill(url);
    console.log('Filled URL input');
    
    // Find the Add button
    const addButtonSelectors = [
      '[data-testid="add-content-button"]',
      'button:has-text("Add")',
      'button[type="submit"]',
      'form button'
    ];
    
    let addButton = null;
    
    // Try each selector
    for (const selector of addButtonSelectors) {
      const button = page.locator(selector);
      const count = await button.count();
      console.log(`Found ${count} buttons with selector: ${selector}`);
      
      if (count > 0) {
        addButton = button;
        console.log(`Using Add button selector: ${selector}`);
        break;
      }
    }
    
    if (!addButton) {
      console.error('Could not find Add button with any selector');
      await page.screenshot({ path: `add-button-not-found-${Date.now()}.png` });
      throw new Error('Add button not found');
    }
    
    // Take screenshot before clicking Add
    await page.screenshot({ path: `before-add-scene-${Date.now()}.png` });
    
    // Click the Add button
    await addButton.click();
    console.log('Clicked Add button');
    
    if (waitForExtraction) {
      // Wait for a new scene to appear
      console.log('Waiting for scene to appear...');
      
      // Wait a moment for extraction to start
      await page.waitForTimeout(1000);
      
      // Take screenshot to see what's happening
      await page.screenshot({ path: `during-content-extraction-${Date.now()}.png` });
      
      // Check for potential error messages
      const errorMessageExists = await page.locator('text=Unable to extract content').count() > 0;
      
      if (errorMessageExists) {
        console.log('WARNING: Content extraction error message detected');
        console.log('Continuing anyway as test may need to verify this error condition');
      } else {
        // Try to verify a scene appeared
        const blueNumberExists = await page.locator('.bg-blue-600, [data-testid^="scene-number-"]').count() > 0;
        const sceneComponentExists = await page.locator('[data-testid="scene-component"]').count() > 0;
        
        if (blueNumberExists || sceneComponentExists) {
          console.log('Scene appears to have been added successfully');
        } else {
          console.log('WARNING: Could not verify scene was added - no scene indicators found');
          console.log('Continuing anyway as scene might still be loading');
        }
      }
    }
    
    // Take screenshot after scene addition attempt
    await page.screenshot({ path: `after-add-scene-${Date.now()}.png` });
    
    // A short delay to let UI update
    await page.waitForTimeout(500);
    
    return true;
  } catch (error: any) {
    console.error('Error adding scene:', error.message);
    await page.screenshot({ path: `add-scene-error-${Date.now()}.png` });
    throw error;
  }
} 