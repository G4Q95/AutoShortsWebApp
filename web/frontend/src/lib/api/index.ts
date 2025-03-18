/**
 * @fileoverview API client for interacting with the Auto Shorts backend
 * 
 * This module exports all API client functionality from the various modules:
 * - Core API client (fetchAPI, error handling, health checks)
 * - Content extraction (extractContent, rewriteText)
 * - Project management (createProject, updateProject, etc.)
 * - Voice generation (generateVoice, getVoices)
 * - Video processing (createVideo, getVideoCreationStatus)
 * - User management (getCurrentUser)
 */

// Re-export everything from the core module
export * from './core';

// Re-export everything from the content module
export * from './content';

// Re-export everything from the projects module
export * from './projects';

// Re-export everything from the voice module
export * from './voice';

// Re-export everything from the video module
export * from './video';

// Re-export everything from the user module
export * from './user';

// Re-export types
export * from './types'; 