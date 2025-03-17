/**
 * @fileoverview Voice generation API client for interacting with the backend
 * 
 * This module provides functions for voice generation and management:
 * - Generating voice audio from text
 * - Retrieving available voices
 * - Managing voice settings
 */

import { fetchAPI } from './core';
import { 
  GenerateVoiceRequest, 
  GenerateVoiceResponse, 
  Voice,
  ApiResponse
} from '../api-types';

/**
 * Default voice settings
 */
export const DEFAULT_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0,
  speaker_boost: true,
  speed: 1.0,
  output_format: "mp3_44100_128" as const
};

/**
 * Generate voice audio from text
 * 
 * @param {GenerateVoiceRequest} request - Voice generation request parameters
 * @returns {Promise<ApiResponse<GenerateVoiceResponse>>} Promise with voice generation response
 */
export async function generateVoice(
  request: GenerateVoiceRequest
): Promise<ApiResponse<GenerateVoiceResponse>> {
  // Apply default settings if not provided
  const requestWithDefaults: GenerateVoiceRequest = {
    ...DEFAULT_VOICE_SETTINGS,
    ...request,
  };

  // Use a longer timeout for voice generation (30 seconds)
  return fetchAPI<GenerateVoiceResponse>(
    '/voice/generate',
    {
      method: 'POST',
      body: JSON.stringify(requestWithDefaults),
    },
    30000 // 30 second timeout
  );
}

/**
 * Get list of available voices
 * 
 * @returns {Promise<ApiResponse<Voice[]>>} Promise with list of available voices
 */
export async function getVoices(): Promise<ApiResponse<Voice[]>> {
  return fetchAPI<Voice[]>('/voice/voices', { method: 'GET' });
}

/**
 * Create a data URL for audio playback from base64 encoded audio
 * 
 * @param {string} audioBase64 - Base64 encoded audio data
 * @param {string} contentType - Content type of the audio (e.g., 'audio/mpeg')
 * @returns {string} Data URL for audio playback
 */
export function createAudioUrl(audioBase64: string, contentType: string): string {
  return `data:${contentType};base64,${audioBase64}`;
}

/**
 * Calculate the estimated cost of voice generation
 * 
 * @param {number} characterCount - Number of characters in the text
 * @returns {number} Estimated cost in credits
 */
export function calculateVoiceGenerationCost(characterCount: number): number {
  // Current ElevenLabs pricing is approximately 1 credit per 1000 characters
  return Math.ceil(characterCount / 1000);
}

/**
 * Format voice name for display
 * 
 * @param {string} voiceName - Raw voice name
 * @returns {string} Formatted voice name
 */
export function formatVoiceName(voiceName: string): string {
  // Remove any special prefixes or suffixes
  return voiceName
    .replace(/\(.*?\)/g, '') // Remove anything in parentheses
    .replace(/^\d+\s*-\s*/, '') // Remove leading numbers with dashes
    .trim();
}

/**
 * Get a voice by ID from a list of voices
 * 
 * @param {Voice[]} voices - List of available voices
 * @param {string} voiceId - ID of the voice to find
 * @returns {Voice | undefined} The found voice or undefined
 */
export function getVoiceById(voices: Voice[], voiceId: string): Voice | undefined {
  return voices.find(voice => voice.voice_id === voiceId);
}

/**
 * Get a default voice from a list of voices
 * 
 * @param {Voice[]} voices - List of available voices
 * @returns {Voice | undefined} A default voice or undefined
 */
export function getDefaultVoice(voices: Voice[]): Voice | undefined {
  // Try to find a voice with "default" in the name
  const defaultVoice = voices.find(voice => 
    voice.name.toLowerCase().includes('default') || 
    voice.name.toLowerCase().includes('narrator')
  );
  
  // If no default voice is found, return the first voice
  return defaultVoice || voices[0];
} 