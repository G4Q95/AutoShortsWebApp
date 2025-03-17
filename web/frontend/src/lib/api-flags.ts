/**
 * @fileoverview API feature flags for controlling refactoring transitions
 * 
 * This module provides feature flags to enable/disable new API implementations
 * during the refactoring process. This allows for:
 * - Gradual migration to new implementations
 * - Easy rollback if issues are detected
 * - A/B testing between old and new implementations
 * - Safe deployments with runtime toggles
 * 
 * @module api-flags
 */

/**
 * Feature flags for API implementation control
 * 
 * This module provides a feature flag system to control which implementation
 * of API functions are used. This allows for:
 * 
 * - Gradual migration between implementations
 * - Easy rollback capability
 * - A/B testing of implementations
 * - Safe deployments with fallback options
 */

// Use development mode check to determine default logging behavior
const isDev = process.env.NODE_ENV === 'development';

/**
 * API feature flags controlling which implementation to use
 */
export const API_FLAGS = {
  // Voice API flags
  // Master flag to use all new voice API implementations
  useNewVoiceAPI: true,  // Enable all new voice API implementations
  
  // Individual voice function flags
  useNewGetVoices: true,
  useNewGetVoiceById: true,
  useNewGenerateVoice: true,
  useNewPersistVoiceAudio: true,
  useNewGetStoredAudio: true,

  // Content API flags
  // Master flag to use all new content API implementations
  useNewContentAPI: false,  // Disabled by default until thoroughly tested
  
  // Individual content function flags
  useNewExtractContent: false,
  useNewValidateUrl: false,

  // Logging control
  logApiChoices: process.env.NODE_ENV !== 'production'
};

/**
 * Logs which implementation of an API function is being used
 * Only logs in development mode or when explicitly enabled
 * 
 * @param {string} functionName - The name of the API function
 * @param {boolean} useNewImpl - Whether the new implementation is being used
 */
export function logImplementationChoice(functionName: string, useNewImpl: boolean): void {
  if (API_FLAGS.logApiChoices) {
    console.log(`API Choice: ${functionName} using ${useNewImpl ? 'NEW' : 'ORIGINAL'} implementation`);
  }
}

/**
 * Enable all new voice API implementations
 * Useful for testing all new implementations at once
 */
export function enableAllNewVoiceAPIs(): void {
  API_FLAGS.useNewVoiceAPI = true;
  API_FLAGS.useNewGetVoices = true;
  API_FLAGS.useNewGetVoiceById = true;
  API_FLAGS.useNewGenerateVoice = true;
  API_FLAGS.useNewPersistVoiceAudio = true;
  API_FLAGS.useNewGetStoredAudio = true;
  
  console.log('All new voice API implementations enabled');
}

/**
 * Disable all new voice API implementations
 * Useful for quick rollback in case of issues
 */
export function disableAllNewVoiceAPIs(): void {
  API_FLAGS.useNewVoiceAPI = false;
  API_FLAGS.useNewGetVoices = false;
  API_FLAGS.useNewGetVoiceById = false;
  API_FLAGS.useNewGenerateVoice = false;
  API_FLAGS.useNewPersistVoiceAudio = false;
  API_FLAGS.useNewGetStoredAudio = false;
  
  console.log('All new voice API implementations disabled');
}

/**
 * Enable all new content API implementations
 * Useful for testing all new implementations at once
 */
export function enableAllNewContentAPIs(): void {
  API_FLAGS.useNewContentAPI = true;
  API_FLAGS.useNewExtractContent = true;
  API_FLAGS.useNewValidateUrl = true;
  
  console.log('All new content API implementations enabled');
}

/**
 * Disable all new content API implementations
 * Useful for quick rollback in case of issues
 */
export function disableAllNewContentAPIs(): void {
  API_FLAGS.useNewContentAPI = false;
  API_FLAGS.useNewExtractContent = false;
  API_FLAGS.useNewValidateUrl = false;
  
  console.log('All new content API implementations disabled');
} 