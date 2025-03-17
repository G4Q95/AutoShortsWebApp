/**
 * Centralized selectors for Playwright tests
 * 
 * This file contains all the selectors used in our e2e tests.
 * Centralizing them makes it easier to update when UI changes.
 */
import { Page, Locator } from '@playwright/test';

export const selectors = {
  // Navigation & Main UI
  homeLink: '[data-testid="home-link"]',
  createVideoButton: 'text=Create Video',
  myProjectsLink: 'text=My Projects',
  
  // Project Creation
  projectNameInput: '[data-testid="project-name-input"], input[placeholder="Enter project name"], input.project-name-input, input[name="projectName"], input#projectName, form input[type="text"]',
  createProjectButton: '[data-testid="create-project-button"], button:has-text("Create Project"), form button[type="submit"]',
  
  // Project List
  projectsList: '[data-testid="projects-list"]',
  projectCard: '.project-card',
  projectDeleteButton: '[data-testid="delete-project-button"]',
  
  // Project Workspace
  projectWorkspace: '.project-workspace, .workspace-container, [data-testid="project-workspace"], .main-content, main',
  urlInput: '[data-testid="url-input"]',
  addContentButton: '[data-testid="add-content-button"]',
  
  // Scene Components
  sceneContainer: '.scene-container',
  sceneComponent: '[data-testid="scene-component"]',
  sceneMedia: '[data-testid="scene-media"]',
  sceneText: '[data-testid="scene-text"]',
  
  // Scene Controls
  sceneDeleteButton: '[data-testid="delete-scene-button"]',
  dragHandle: '[data-testid="drag-handle"]',
  
  // Voice Generation
  generateVoiceButton: 'text=Generate Voiceover',
  voiceSelector: '[data-testid="voice-selector"]',
  audioPlayer: 'audio',
  audioControls: '.audio-controls',
  
  // Fallback selectors with multiple strategies
  generateVoiceButtonFallbacks: {
    testId: '[data-testid="generate-voice-button"]',
    text: 'text=Generate Voiceover',
    cssClass: '.generate-voice-btn',
    role: 'button:has-text("Generate")',
    alternative: '[data-testid="voice-generator-button"]'
  },
  
  sceneDeleteButtonFallbacks: {
    testId: '[data-testid="delete-scene-button"]',
    ariaLabel: 'button[aria-label="Remove scene"]',
    cssClass: '.scene-container button.bg-red-600',
    xIcon: 'button:has-text("×")',
    removeText: 'button:has-text("Remove")',
    deleteText: 'button:has-text("Delete")',
    svgContainer: 'button svg[class*="delete"], button svg[class*="trash"], button svg[class*="remove"]',
    iconButton: '[class*="scene"] button[class*="delete"], [class*="scene"] button[class*="remove"]',
    closeIcon: '[class*="close-button"], [class*="closeButton"]'
  },
  
  // Loading and error states
  loadingIndicator: '[data-testid="loading-indicator"]',
  errorDisplay: '[data-testid="error-display"]'
};

/**
 * Helper function to click an element with fallback selectors
 */
export async function clickWithFallbacks(page: Page, selectors: { [key: string]: string }, timeoutMs = 5000) {
  const keys = Object.keys(selectors);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const selector = selectors[key];
    
    try {
      // Log the selector being tried
      console.log(`Trying selector ${key}: ${selector}`);
      
      // Check if element exists before trying to click
      const exists = await page.locator(selector).count() > 0;
      
      if (exists) {
        console.log(`Found element with selector: ${key}`);
        
        // Check if element is visible
        const visible = await page.locator(selector).first().isVisible();
        
        if (visible) {
          console.log(`Element is visible, attempting to click: ${key}`);
          await page.click(selector, { timeout: Math.max(1000, timeoutMs / keys.length) });
          console.log(`Successfully clicked using selector: ${key}`);
          return true;
        } else {
          console.log(`Element exists but is not visible: ${key}`);
        }
      } else {
        console.log(`Element not found with selector: ${key}`);
      }
    } catch (error: any) {
      console.log(`Failed to click using selector ${key}: ${error.message}`);
      
      if (i === keys.length - 1) {
        console.error(`All selectors failed: ${JSON.stringify(selectors)}`);
        throw error;
      }
    }
  }
  
  return false;
}

/**
 * Helper function to wait for an element with fallback selectors
 */
export async function waitForWithFallbacks(page: Page, selectors: { [key: string]: string }, timeoutMs = 5000): Promise<Locator | null> {
  const keys = Object.keys(selectors);
  
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const selector = selectors[key];
    
    try {
      // Log the selector being tried
      console.log(`Trying to wait for selector ${key}: ${selector}`);
      
      const element = await page.waitForSelector(selector, { 
        timeout: Math.max(1000, timeoutMs / keys.length),
        state: 'visible'
      });
      
      console.log(`Successfully found using selector: ${key}`);
      return page.locator(selector);
    } catch (error: any) {
      console.log(`Failed to find using selector ${key}: ${error.message}`);
      
      if (i === keys.length - 1) {
        console.error(`All selectors failed: ${JSON.stringify(selectors)}`);
        throw error;
      }
    }
  }
  
  return null;
} 