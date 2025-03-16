/**
 * Centralized selectors for Playwright tests
 * 
 * This file contains all the selectors used in our e2e tests.
 * Centralizing them makes it easier to update when UI changes.
 */

export const selectors = {
  // Navigation & Main UI
  homeLink: '[data-testid="home-link"]',
  createVideoButton: 'text=Create Video',
  myProjectsLink: 'text=My Projects',
  
  // Project Creation
  projectNameInput: '[data-testid="project-name-input"]',
  createProjectButton: '[data-testid="create-project-button"]',
  
  // Project List
  projectsList: '[data-testid="projects-list"]',
  projectCard: '.project-card',
  projectDeleteButton: '[data-testid="delete-project-button"]',
  
  // Project Workspace
  projectWorkspace: '.project-workspace',
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
    cssClass: '.generate-voice-btn'
  },
  
  sceneDeleteButtonFallbacks: {
    testId: '[data-testid="delete-scene-button"]',
    text: 'button[aria-label="Remove scene"]',
    cssClass: '.bg-red-600'
  },
  
  // Loading and error states
  loadingIndicator: '[data-testid="loading-indicator"]',
  errorDisplay: '[data-testid="error-display"]'
};

/**
 * Helper function to click an element with fallback selectors
 */
export async function clickWithFallbacks(page: any, selectors: { [key: string]: string }, timeoutMs = 5000) {
  const keys = Object.keys(selectors);
  
  for (let i = 0; i < keys.length; i++) {
    const selector = selectors[keys[i]];
    try {
      await page.click(selector, { timeout: timeoutMs / keys.length });
      console.log(`Successfully clicked using selector: ${keys[i]}`);
      return true;
    } catch (e) {
      console.log(`Failed to click using selector: ${keys[i]}`);
      if (i === keys.length - 1) {
        console.error(`All selectors failed: ${JSON.stringify(selectors)}`);
        throw e;
      }
    }
  }
  
  return false;
}

/**
 * Helper function to wait for an element with fallback selectors
 */
export async function waitForWithFallbacks(page: any, selectors: { [key: string]: string }, timeoutMs = 5000) {
  const keys = Object.keys(selectors);
  
  for (let i = 0; i < keys.length; i++) {
    const selector = selectors[keys[i]];
    try {
      const element = await page.waitForSelector(selector, { timeout: timeoutMs / keys.length });
      console.log(`Successfully found using selector: ${keys[i]}`);
      return element;
    } catch (e) {
      console.log(`Failed to find using selector: ${keys[i]}`);
      if (i === keys.length - 1) {
        console.error(`All selectors failed: ${JSON.stringify(selectors)}`);
        throw e;
      }
    }
  }
  
  return null;
} 