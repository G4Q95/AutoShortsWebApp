/**
 * Navigation-specific test utilities
 * 
 * This file contains helper functions specifically for navigation and element finding
 * operations like finding elements with specific text and waiting for elements.
 */

import { Page, Locator } from '@playwright/test';
import { takeDebugScreenshot } from './test-utils';

/**
 * Helper function to find elements with specific text content
 * 
 * @param page - Playwright page
 * @param selector - The selector to find elements
 * @param text - The text to look for
 * @returns The element that contains the text, or null if not found
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
 * 
 * @param page - Playwright page
 * @param selector - The selector to find elements
 * @param text - The text to look for
 * @returns A boolean indicating whether the element exists
 */
export async function elementWithTextExists(page: Page, selector: string, text: string): Promise<boolean> {
  const element = await findElementWithText(page, selector, text);
  return element !== null;
}

/**
 * Helper function to wait for element with specific text
 * 
 * @param page - Playwright page
 * @param selector - The selector to find elements
 * @param text - The text to look for
 * @param timeout - The maximum time to wait in milliseconds
 * @returns A boolean indicating success
 */
export async function waitForElementWithText(page: Page, selector: string, text: string, timeout = 10000) {
  console.log(`Waiting for element ${selector} with text "${text}"...`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const exists = await elementWithTextExists(page, selector, text);
    if (exists) {
      console.log(`Found element ${selector} with text "${text}"`);
      return true;
    }
    await page.waitForTimeout(100);
  }
  
  // Take a debug screenshot before throwing error
  await takeDebugScreenshot(page, `element-text-not-found-${text.replace(/\s+/g, '-')}`);
  
  throw new Error(`Element ${selector} with text "${text}" not found after ${timeout}ms`);
} 