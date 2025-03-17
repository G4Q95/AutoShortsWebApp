/**
 * Scene-specific test utilities
 * 
 * This file contains helper functions specifically for testing scene operations
 * like adding, deleting, and reordering scenes.
 */

import { Page, Locator, expect } from '@playwright/test';
import { selectors, clickWithFallbacks, waitForWithFallbacks } from './selectors';
import { takeDebugScreenshot, waitForScenes } from './test-utils';

/**
 * Add a scene with content from a URL
 * 
 * @param page - Playwright page
 * @param url - Reddit URL to add (defaults to a test URL)
 * @returns Promise resolving when scene is added
 */
export async function addScene(
  page: Page,
  url = 'https://www.reddit.com/r/aww/comments/rgglk7/'
) {
  console.log(`Adding scene with URL: ${url}`);
  
  // Count scenes before adding
  const scenesBeforeCount = await page.locator(selectors.sceneComponent).count();
  console.log(`Scenes before adding: ${scenesBeforeCount}`);
  
  // Fill URL input and click Add button
  await page.fill(selectors.urlInput, url);
  await page.click(selectors.addContentButton);
  
  // Wait for new scene to appear
  const expectedCount = scenesBeforeCount + 1;
  await waitForScenes(page, expectedCount, 'addScene');
  
  console.log(`Successfully added scene, now have ${expectedCount} scenes`);
}

/**
 * Delete a scene at the specified index
 * 
 * @param page - Playwright page
 * @param index - Index of scene to delete (0-based)
 * @returns Promise resolving when scene is deleted
 */
export async function deleteScene(page: Page, index = 0) {
  console.log(`Deleting scene at index ${index}`);
  
  // Count scenes before deletion
  const scenesBeforeCount = await page.locator(selectors.sceneComponent).count();
  console.log(`Scenes before deletion: ${scenesBeforeCount}`);
  
  if (scenesBeforeCount <= index) {
    throw new Error(`Cannot delete scene at index ${index}, only ${scenesBeforeCount} scenes exist`);
  }
  
  // Take screenshot before attempting deletion
  await takeDebugScreenshot(page, `before-scene-deletion-${index}`);
  
  // Get delete buttons and click the one at specified index
  const deleteButtons = page.locator(selectors.sceneDeleteButton);
  const buttonCount = await deleteButtons.count();
  
  console.log(`Found ${buttonCount} delete buttons`);
  
  if (buttonCount > index) {
    // Use nth to get the button at the specified index
    await deleteButtons.nth(index).click();
  } else {
    console.log('Delete button not found with primary selector, trying fallbacks');
    
    // Use fallback selectors if primary selector doesn't work
    await clickWithFallbacks(page, selectors.sceneDeleteButtonFallbacks);
  }
  
  // Wait for scene to be deleted
  const expectedCount = scenesBeforeCount - 1;
  await waitForScenes(page, expectedCount, 'deleteScene');
  
  console.log(`Successfully deleted scene, now have ${expectedCount} scenes`);
}

/**
 * Drag and drop a scene from one position to another
 * 
 * @param page - Playwright page
 * @param sourceIndex - Source index (0-based)
 * @param targetIndex - Target index (0-based)
 * @returns Promise resolving when drag and drop is complete
 */
export async function dragAndDropScene(page: Page, sourceIndex: number, targetIndex: number) {
  console.log(`Reordering scene from index ${sourceIndex} to index ${targetIndex}`);
  
  // Find the drag handles
  const dragHandleSelectors = [
    '[data-testid="drag-handle"]',
    '.drag-handle',
    'button[aria-label="Drag"]',
    '[class*="drag"]',
    'svg[class*="drag"]',
    // Scene header and scene number selectors that may contain drag functionality
    '.scene-header',
    '.scene-number',
    '[data-testid="scene-header"]',
    '[data-testid="scene-number"]',
    '[data-testid^="scene-number-"]',
    '.scene-component [data-testid^="scene-number-"]',
    // Blue number that indicates scene position
    '.bg-blue-600', 
    // Extremely generic fallbacks as last resort
    '.scene-container button:first-child',
    '.scene-component button:first-child'
  ];
  
  console.log(`Looking for drag handles using selectors: ${JSON.stringify(dragHandleSelectors)}`);
  
  // Capture screenshot of scene structure to help with debugging
  console.log("Taking screenshot of scene structure for debugging");
  await page.screenshot({ path: `scene-structure-before-drag-${Date.now()}.png` });
  
  // Output DOM structure of scenes for debugging
  console.log("Inspecting scene structure...");
  const sceneComponents = page.locator('[data-testid="scene-component"]');
  const sceneCount = await sceneComponents.count();
  console.log(`Found ${sceneCount} scene components`);
  
  if (sceneCount > 0) {
    // Log HTML structure of first scene for debugging
    const firstSceneHTML = await sceneComponents.first().evaluate(node => node.outerHTML);
    console.log(`First scene HTML structure: ${firstSceneHTML}`);
  }
  
  // Try each selector
  let sourceHandle = null;
  let foundSelector = '';
  
  for (const selector of dragHandleSelectors) {
    const handles = page.locator(selector);
    const count = await handles.count();
    
    console.log(`Found ${count} elements matching selector: ${selector}`);
    
    if (count > sourceIndex) {
      sourceHandle = handles.nth(sourceIndex);
      foundSelector = selector;
      console.log(`Using selector ${selector} for drag operation`);
      break;
    }
  }
  
  if (!sourceHandle) {
    console.error('ERROR: Could not find drag handle with any selector');
    await page.screenshot({ path: `drag-handle-not-found-${Date.now()}.png` });
    throw new Error('Drag handle not found with any selector');
  }
  
  // Take screenshot to debug
  await page.screenshot({ path: `before-drag-${Date.now()}.png` });
  
  // Perform drag and drop
  try {
    // Get positions
    console.log('Getting bounding box for source handle...');
    const sourceHandleBound = await sourceHandle.boundingBox();
    
    // Take another screenshot showing the drag handle
    await page.screenshot({ path: `found-drag-handle-${Date.now()}.png` });
    
    if (!sourceHandleBound) {
      throw new Error('Could not get bounding box for source handle');
    }
    
    // Find the target scene
    const targetScene = page.locator(foundSelector).nth(targetIndex);
    console.log('Getting bounding box for target handle...');
    const targetSceneBound = await targetScene.boundingBox();
    
    if (!targetSceneBound) {
      throw new Error('Could not get bounding box for target scene');
    }
    
    // Perform the drag operation
    console.log('Starting drag operation...');
    await page.mouse.move(
      sourceHandleBound.x + sourceHandleBound.width / 2,
      sourceHandleBound.y + sourceHandleBound.height / 2
    );
    await page.mouse.down();
    
    // Move to target position
    await page.mouse.move(
      targetSceneBound.x + targetSceneBound.width / 2,
      targetSceneBound.y + targetSceneBound.height / 2,
      { steps: 5 } // Slow down the movement for better stability
    );
    
    // Release mouse
    await page.mouse.up();
    console.log('Drag and drop completed');
    
    // Take screenshot after drag
    await page.screenshot({ path: `after-drag-${Date.now()}.png` });
    
    // Wait a moment for UI to update
    await page.waitForTimeout(500);
    
    return true;
  } catch (error: any) {
    console.error('Error during drag and drop:', error.message);
    await page.screenshot({ path: `drag-error-${Date.now()}.png` });
    throw error;
  }
}

/**
 * Edit the text content of a scene
 * 
 * @param page - Playwright page
 * @param newText - New text to set
 * @param index - Index of scene to edit (0-based)
 * @returns Promise resolving when edit is complete
 */
export async function editSceneText(page: Page, newText: string, index = 0) {
  console.log(`Editing text for scene at index ${index} to: "${newText}"`);
  
  // Find scene components
  const scenes = page.locator(selectors.sceneComponent);
  const sceneCount = await scenes.count();
  console.log(`Found ${sceneCount} scenes`);
  
  if (sceneCount <= index) {
    throw new Error(`Cannot edit scene at index ${index}, only ${sceneCount} scenes exist`);
  }
  
  const scene = scenes.nth(index);
  
  // Take a screenshot to debug
  await page.screenshot({ path: `before-edit-scene-${index}-${Date.now()}.png` });
  
  console.log('Finding editable text area/element...');
  
  // Log the scene HTML structure for debugging
  console.log('Examining scene structure for text editing...');
  try {
    const sceneHTML = await scene.evaluate(node => node.outerHTML);
    console.log(`Scene HTML structure: ${sceneHTML.substring(0, 500)}...`); // Log first 500 chars to avoid too much output
  } catch (e) {
    console.log('Error getting scene HTML:', e);
  }
  
  // Try multiple approaches to find editable text element
  let textArea = null;
  let edited = false;
  
  // Try textarea first
  try {
    console.log('Approach 1: Looking for textarea element...');
    textArea = scene.locator('textarea');
    const textAreaCount = await textArea.count();
    console.log(`Found ${textAreaCount} textarea elements`);
    
    if (textAreaCount > 0) {
      // Wait for it to be editable and visible
      await textArea.waitFor({ state: 'visible', timeout: 10000 });
      
      // Click to focus and clear the text area
      await textArea.click({ timeout: 10000 });
      await page.waitForTimeout(500); // Give it time to focus
      
      // Clear and type new text
      await textArea.fill(newText);
      console.log('Successfully edited textarea');
      edited = true;
    }
  } catch (e) {
    console.log('Error with textarea approach:', e);
  }
  
  // Try editable div
  if (!edited) {
    try {
      console.log('Approach 2: Looking for contenteditable div...');
      const editableSelectors = [
        '[contenteditable="true"]', 
        '[data-testid="scene-text"]',
        '.scene-text[contenteditable]', 
        '[role="textbox"]'
      ];
      
      for (const selector of editableSelectors) {
        console.log(`Trying selector: ${selector}`);
        textArea = scene.locator(selector);
        const count = await textArea.count();
        console.log(`Found ${count} elements with selector ${selector}`);
        
        if (count > 0) {
          // Wait for it to be visible
          await textArea.waitFor({ state: 'visible', timeout: 10000 });
          
          // Click to focus
          await textArea.click({ timeout: 10000 });
          await page.waitForTimeout(500); // Give it time to focus
          
          // Clear existing content and type new text
          await page.keyboard.press('Control+A');
          await page.waitForTimeout(100);
          await page.keyboard.press('Backspace');
          await page.waitForTimeout(100);
          await page.keyboard.type(newText);
          
          console.log(`Successfully edited with selector ${selector}`);
          edited = true;
          break;
        }
      }
    } catch (e) {
      console.log('Error with editable div approach:', e);
    }
  }
  
  // Try clicking a text element first, which might activate editing mode
  if (!edited) {
    try {
      console.log('Approach 3: Trying to activate edit mode by clicking text...');
      const textSelectors = [
        'p', 
        'span', 
        'div[data-testid="scene-text"]',
        '.scene-text',
        '.text-content'
      ];
      
      for (const selector of textSelectors) {
        console.log(`Trying to click ${selector} to activate edit mode`);
        const textElement = scene.locator(selector);
        const count = await textElement.count();
        
        if (count > 0) {
          // Click the text element to activate editing mode
          await textElement.click({ timeout: 10000 });
          await page.waitForTimeout(1000); // Give more time for edit mode to activate
          
          // Take screenshot to see if edit mode activated
          await page.screenshot({ path: `edit-mode-activation-${index}-${Date.now()}.png` });
          
          // Now try to find textarea or editable element that might have appeared
          const editableElement = scene.locator('textarea, [contenteditable="true"]');
          const editableCount = await editableElement.count();
          console.log(`After clicking text, found ${editableCount} editable elements`);
          
          if (editableCount > 0) {
            // Click and edit the element
            await editableElement.click({ timeout: 5000 });
            
            // Try both methods of clearing/filling
            try {
              // Method 1: fill() API
              await editableElement.fill(newText);
            } catch (e) {
              console.log('Fill method failed, trying keyboard input:', e);
              
              // Method 2: keyboard input
              await page.keyboard.press('Control+A');
              await page.waitForTimeout(100);
              await page.keyboard.press('Backspace');
              await page.waitForTimeout(100);
              await page.keyboard.type(newText);
            }
            
            console.log('Successfully edited text after activating edit mode');
            edited = true;
            break;
          } else {
            // Try keyboard input directly on the clicked element
            await page.keyboard.press('Control+A');
            await page.waitForTimeout(100);
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(100);
            await page.keyboard.type(newText);
            
            console.log('Attempted direct keyboard input on text element');
            edited = true;
            break;
          }
        }
      }
    } catch (e) {
      console.log('Error with click-to-edit approach:', e);
    }
  }
  
  // As a last resort, try to find any element that might be clickable in the scene
  if (!edited) {
    try {
      console.log('Approach 4: Last resort approach - trying to find any text element');
      
      // Try to find any element that looks like it might contain text
      const potentialTextElements = scene.locator('div, p, span, textarea').all();
      const elements = await potentialTextElements;
      
      console.log(`Found ${elements.length} potential text elements to try`);
      
      for (const element of elements) {
        try {
          // Check if element has text content that indicates it might be editable
          const text = await element.textContent();
          if (text && text.trim().length > 0 && !text.includes('Button') && !text.includes('Delete')) {
            console.log(`Found potential text element with content: "${text.substring(0, 30)}..."`);
            
            // Try to click this element
            await element.click({ timeout: 5000 });
            await page.waitForTimeout(500);
            
            // Try keyboard input
            await page.keyboard.press('Control+A');
            await page.waitForTimeout(100);
            await page.keyboard.press('Backspace');
            await page.waitForTimeout(100);
            await page.keyboard.type(newText);
            
            console.log('Attempted text edit on potential text element');
            edited = true;
            break;
          }
        } catch (e) {
          // Continue to next element
          console.log('Error checking an element:', e);
        }
      }
    } catch (e) {
      console.log('Error with last resort approach:', e);
    }
  }
  
  if (!edited) {
    console.error('Could not find editable text element by any method');
    await page.screenshot({ path: `edit-scene-failed-${index}-${Date.now()}.png` });
    throw new Error('Could not edit scene text - no editable element found');
  }
  
  // Click elsewhere to blur the text area
  try {
    await page.click(selectors.projectWorkspace);
  } catch (e) {
    console.log('Error clicking away from text area:', e);
    // Try alternative ways to blur
    await page.keyboard.press('Escape');
  }
  
  // Take a screenshot after editing
  await page.screenshot({ path: `after-edit-scene-${index}-${Date.now()}.png` });
  
  console.log(`Successfully edited scene text to: ${newText}`);
}

/**
 * Verify scene content matches expectations
 * 
 * @param page - Playwright page
 * @param index - Index of scene to verify (0-based)
 * @param expectedText - Optional text to verify (if provided)
 * @returns Promise resolving with boolean indicating if media is present
 */
export async function verifySceneContent(page: Page, index = 0, expectedText?: string) {
  console.log(`Verifying content for scene at index ${index}`);
  
  // Find the scene at the specified index
  const scenes = page.locator(selectors.sceneComponent);
  const sceneCount = await scenes.count();
  
  if (sceneCount <= index) {
    throw new Error(`Cannot verify scene at index ${index}, only ${sceneCount} scenes exist`);
  }
  
  const scene = scenes.nth(index);
  
  // Check if media is present
  const media = scene.locator(selectors.sceneMedia);
  const mediaCount = await media.count();
  const hasMedia = mediaCount > 0;
  
  console.log(`Scene ${index} media present: ${hasMedia}`);
  
  // If expectedText is provided, verify it
  if (expectedText) {
    const textArea = scene.locator('textarea');
    const actualText = await textArea.inputValue();
    expect(actualText).toBe(expectedText);
    console.log(`Scene ${index} text verified: "${actualText}"`);
  }
  
  return hasMedia;
} 