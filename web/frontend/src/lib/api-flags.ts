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
 * API implementation feature flags
 * 
 * Each flag controls whether to use the new implementation of a specific
 * API function. By default, all flags are set to false (use original implementation).
 * 
 * To enable a new implementation, set the corresponding flag to true.
 */
export const API_FLAGS = {
  /**
   * Whether to use the new implementation of voice-related APIs
   * Affects: getAvailableVoices, getVoiceById, generateVoice, etc.
   */
  useNewVoiceAPI: false,
  
  /**
   * Whether to use the new implementation of getAvailableVoices()
   */
  useNewGetVoices: false,
  
  /**
   * Whether to use the new implementation of getVoiceById()
   */
  useNewGetVoiceById: false,
  
  /**
   * Whether to use the new implementation of generateVoice()
   */
  useNewGenerateVoice: false,
  
  /**
   * Whether to use the new implementation of persistVoiceAudio()
   */
  useNewPersistVoiceAudio: false,
  
  /**
   * Whether to use the new implementation of getStoredAudio()
   */
  useNewGetStoredAudio: false,
  
  /**
   * Whether to log API implementation choices (for debugging)
   */
  logApiChoices: process.env.NODE_ENV === 'development',
};

/**
 * Helper function to log which implementation is being used
 * Only logs in development mode when logApiChoices is true
 * 
 * @param functionName - Name of the API function
 * @param useNewImpl - Whether the new implementation is being used
 */
export function logImplementationChoice(functionName: string, useNewImpl: boolean): void {
  if (API_FLAGS.logApiChoices) {
    console.log(`API Implementation: ${functionName} - Using ${useNewImpl ? 'NEW' : 'ORIGINAL'} implementation`);
  }
}

/**
 * Enable all new voice API implementations
 * Used for testing the fully refactored API
 */
export function enableAllNewVoiceAPIs(): void {
  API_FLAGS.useNewVoiceAPI = true;
  API_FLAGS.useNewGetVoices = true;
  API_FLAGS.useNewGetVoiceById = true;
  API_FLAGS.useNewGenerateVoice = true;
  API_FLAGS.useNewPersistVoiceAudio = true;
  API_FLAGS.useNewGetStoredAudio = true;
}

/**
 * Disable all new voice API implementations
 * Used for emergency rollback if issues are detected
 */
export function disableAllNewVoiceAPIs(): void {
  API_FLAGS.useNewVoiceAPI = false;
  API_FLAGS.useNewGetVoices = false;
  API_FLAGS.useNewGetVoiceById = false;
  API_FLAGS.useNewGenerateVoice = false;
  API_FLAGS.useNewPersistVoiceAudio = false;
  API_FLAGS.useNewGetStoredAudio = false;
} 