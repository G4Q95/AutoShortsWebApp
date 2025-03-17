/**
 * Test utilities for end-to-end testing
 * 
 * This file exports all the utilities from various test utility files.
 * Import from this file to avoid having to import from multiple files.
 */

// Re-export from test-utils.ts
export * from './test-utils';

// Re-export from selectors.ts
export * from './selectors';

// Export project utilities
export * from './project-utils';

// Export scene utilities
export { addScene } from './add-scene';
export { dragAndDropScene, deleteScene, editSceneText, verifySceneContent } from './scene-utils';

// Export audio utilities
export { generateVoiceForScene, setupMockAudio, playSceneAudio, changeVoiceSettings, verifyAudioGeneration, closeVoiceSettingsIfOpen } from './audio-utils';

// Export navigation utilities
export { findElementWithText, elementWithTextExists, waitForElementWithText } from './navigation-utils';

// Export layout utilities 
export { verifyLayoutAttributes, verifyLayoutChain } from './layout-utils';

// Export wait utilities
export { 
  waitForButtonReady, 
  waitForProjectWorkspace, 
  waitForSceneAppearance, 
  waitForScenes,
  sleep,
  retry,
  PAGE_LOAD_TIMEOUT,
  NAVIGATION_TIMEOUT,
  CONTENT_LOAD_TIMEOUT,
  CRITICAL_STEP_TIMEOUT,
  SCENE_MEDIA_TIMEOUT,
  AUDIO_GENERATION_TIMEOUT,
  UI_STABILIZATION_DELAY
} from './wait-utils';

// Define DRAG_HANDLE_SELECTOR directly since we don't have access to the selectors file
export const DRAG_HANDLE_SELECTOR = '[data-testid="drag-handle"], .drag-handle, .scene-drag-handle'; 