/**
 * Layout testing utilities
 * 
 * This file contains helper functions specifically for testing layout attributes
 * and dimensions to ensure visual consistency during refactoring.
 */

import { Page, Locator, expect } from '@playwright/test';
import { takeDebugScreenshot } from './test-utils';

/**
 * Verify layout attributes and dimensions of an element
 * 
 * @param page - Playwright page
 * @param selector - Base selector type (div, textarea, etc.)
 * @param expectedLayoutId - The expected data-test-layout attribute value
 * @returns A boolean indicating whether the element with the expected layout was found
 */
export async function verifyLayoutAttributes(page: Page, selector: string, expectedLayoutId: string): Promise<boolean> {
  try {
    // Take a debug screenshot before checking layout
    await takeDebugScreenshot(page, `before-layout-check-${expectedLayoutId.replace(/\s+/g, '-')}`);
    
    console.log(`Looking for element with data-test-layout="${expectedLayoutId}"...`);
    const element = await page.locator(`[data-test-layout="${expectedLayoutId}"]`).first();
    const exists = await element.count() > 0;
    
    if (exists) {
      // Log that we found the element with the correct layout ID
      console.log(`✅ Found element with data-test-layout="${expectedLayoutId}"`);
      
      // Check if it has dimensions attribute
      const dimensions = await element.getAttribute('data-test-dimensions');
      if (dimensions) {
        console.log(`📏 Element dimensions: ${dimensions}`);
        
        // Parse and verify dimensions if available
        const dimensionPairs = dimensions.split(';').filter(d => d.trim() !== '');
        if (dimensionPairs.length > 0) {
          console.log(`Found ${dimensionPairs.length} dimension specifications:`);
          dimensionPairs.forEach(pair => {
            console.log(`  - ${pair.trim()}`);
          });
        }
      }
      
      // Take a success screenshot
      await takeDebugScreenshot(page, `layout-verified-${expectedLayoutId.replace(/\s+/g, '-')}`);
      
      return true;
    }
    
    // If we get here, the element wasn't found
    console.error(`❌ Element with data-test-layout="${expectedLayoutId}" not found`);
    
    // Take a failure screenshot
    await takeDebugScreenshot(page, `layout-missing-${expectedLayoutId.replace(/\s+/g, '-')}`);
    
    return false;
  } catch (e) {
    console.error(`❌ Error checking layout attribute ${expectedLayoutId}:`, e);
    
    // Take an error screenshot
    await takeDebugScreenshot(page, `layout-error-${expectedLayoutId.replace(/\s+/g, '-')}`);
    
    return false;
  }
}

/**
 * Verifies a complete layout chain (multiple related layout elements)
 * 
 * @param page - Playwright page
 * @param layoutChain - Array of layout IDs that should exist in sequence
 * @returns A boolean indicating if all elements in the chain were found
 */
export async function verifyLayoutChain(page: Page, layoutChain: string[]): Promise<boolean> {
  console.log(`Verifying layout chain with ${layoutChain.length} elements...`);
  
  for (const layoutId of layoutChain) {
    const found = await verifyLayoutAttributes(page, 'div', layoutId);
    if (!found) {
      console.error(`❌ Layout chain verification failed at "${layoutId}"`);
      return false;
    }
  }
  
  console.log(`✅ Complete layout chain verified successfully`);
  return true;
} 