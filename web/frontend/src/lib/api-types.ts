/**
 * @fileoverview Type definitions for API responses and requests
 * 
 * This module defines the types and interfaces used for API communication
 * within the Auto Shorts Web App. It includes:
 * - API response formats
 * - Request payload structures
 * - Error handling types
 * 
 * Key features:
 * - Type-safe API interactions
 * - Clear definitions for request and response structures
 * 
 * @module api-types
 */

/**
 * Standardized API response format
 * 
 * @template T - The type of the data returned in the response
 * @interface ApiResponse
 * @property {T} data - The data returned from the API
 * @property {ApiError} [error] - Optional error object if the request failed
 * @property {Object} timing - Timing information for the request
 * @property {Object} connectionInfo - Information about the connection status
 */
export interface ApiResponse<T> {
  data: T;
  error?: ApiError;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
  connectionInfo: {
    success: boolean;
    server: string;
    status: number;
    statusText: string;
  };
}

/**
 * Standardized error format for API responses
 * 
 * @interface ApiError
 * @property {number} status_code - HTTP status code for the error
 * @property {string} message - Error message describing the issue
 * @property {string} [error_code] - Optional error code for specific error types
 * @property {string} [details] - Optional additional details about the error
 */
export interface ApiError {
  status_code: number;
  message: string;
  error_code?: string;
  details?: string;
}

/**
 * Response format for video creation requests
 * 
 * @interface VideoCreationResponse
 * @property {string} videoId - Unique identifier for the created video
 * @property {string} status - Current status of the video creation process
 */
export interface VideoCreationResponse {
  videoId: string;
  status: string;
}

/**
 * Response format for video status requests
 * 
 * @interface VideoStatusResponse
 * @property {string} videoId - Unique identifier for the video
 * @property {string} status - Current status of the video (e.g., 'processing', 'completed')
 * @property {number} progress - Progress percentage of the video creation
 */
export interface VideoStatusResponse {
  videoId: string;
  status: string;
  progress: number;
}

/**
 * Response format for user profile requests
 * 
 * @interface UserResponse
 * @property {string} id - Unique identifier for the user
 * @property {string} username - Username of the user
 * @property {string} email - Email address of the user
 */
export interface UserResponse {
  id: string;
  username: string;
  email: string;
}

/**
 * Timing information for API requests
 */
export interface ApiTiming {
  /** Request start timestamp */
  start: number;
  /** Request end timestamp */
  end: number;
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Connection status information
 */
export interface ConnectionInfo {
  /** Whether the request was successful */
  success: boolean;
  /** Server URL */
  server: string;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
}

/**
 * API health status information
 */
export interface ApiHealth {
  /** Timestamp of last health check */
  lastChecked: number;
  /** Whether the API is currently available */
  isAvailable: boolean;
  /** Last recorded response time in milliseconds */
  responseTime: number;
  /** Whether a health check is currently in progress */
  checkInProgress: boolean;
}

/**
 * Voice information
 * 
 * @interface Voice
 * @property {string} voice_id - Unique identifier for the voice
 * @property {string} name - Display name of the voice
 * @property {string} [category] - Category the voice belongs to (e.g., "premium", "standard")
 * @property {string} [description] - Description of the voice
 * @property {string} [preview_url] - URL to a preview audio sample
 * @property {Record<string, string>} [labels] - Additional labels/attributes for the voice
 */
export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

/**
 * Response for voice listing requests
 * 
 * @interface VoiceListResponse
 * @property {Voice[]} voices - Array of available voices
 * @property {number} count - Total number of voices
 */
export interface VoiceListResponse {
  voices: Voice[];
  count: number;
}

/**
 * Voice generation settings
 * 
 * @interface VoiceSettings
 * @property {number} stability - Voice stability (0.0-1.0) - higher values make voice more consistent but less expressive
 * @property {number} similarity_boost - Voice similarity boost (0.0-1.0) - higher values make voice more similar to sample
 * @property {number} [style] - Optional style value (0.0-1.0)
 * @property {boolean} [use_speaker_boost] - Whether to use speaker boost
 * @property {number} [speed] - Voice speed (0.7-1.2) - controls the pace of speech
 */
export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

/**
 * Request payload for voice generation
 * 
 * @interface GenerateVoiceRequest
 * @property {string} text - Text to convert to speech
 * @property {string} voice_id - ID of the voice to use
 * @property {number} [stability] - Voice stability (0.0-1.0)
 * @property {number} [similarity_boost] - Voice similarity boost (0.0-1.0)
 * @property {number} [style] - Optional style value (0.0-1.0)
 * @property {boolean} [use_speaker_boost] - Whether to use speaker boost
 * @property {string} [output_format] - Output format (mp3, pcm, wav, ogg, flac)
 * @property {number} [speed] - Voice speed (0.7-1.2) - controls the pace of speech
 */
export interface GenerateVoiceRequest {
  text: string;
  voice_id: string;
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  output_format?: "mp3_22050_32" | "mp3_44100_32" | "mp3_44100_64" | "mp3_44100_96" | "mp3_44100_128" | "mp3_44100_192" | "pcm_8000" | "pcm_16000" | "pcm_22050" | "pcm_24000" | "pcm_44100" | "ulaw_8000";
  speed?: number;
}

/**
 * Response for voice generation
 * 
 * @interface GenerateVoiceResponse
 * @property {string} audio_base64 - Base64 encoded audio data
 * @property {string} content_type - Content type of the audio (e.g., "audio/mpeg")
 * @property {number} character_count - Number of characters in the text
 * @property {number} processing_time - Time taken to process the request in seconds
 */
export interface GenerateVoiceResponse {
  audio_base64: string;
  content_type: string;
  character_count: number;
  processing_time: number;
}

/**
 * Voice generation types
 */
export interface VoiceResponse {
  voice_id: string;
  name: string;
  samples: Array<{ sample_id: string, file_name: string, mime_type: string, size_bytes: number, hash: string }>;
  category: string;
  fine_tuning: {
    model_id: string;
    is_allowed_to_fine_tune: boolean;
    fine_tuning_requested: boolean;
    finetuning_state: string;
    verification_attempts?: Array<any>;
    verification_failures?: Array<any>;
    verification_attempts_count?: number;
    slice_ids?: Array<any>;
  };
  labels: Record<string, string>;
  description: string;
  preview_url: string;
  available_for_tiers: Array<string>;
  settings: VoiceSettings;
  sharing: {
    status: string;
    history_item_sample_id: string;
    cloned_item_id: string;
    original_voice_id: string;
  };
}

/**
 * Request to save audio to persistent storage
 */
export interface SaveAudioRequest {
  /** Base64 encoded audio data */
  audio_base64: string;
  /** MIME type of the audio (e.g., "audio/mp3") */
  content_type: string;
  /** Project ID this audio belongs to */
  project_id: string;
  /** Scene ID this audio belongs to */
  scene_id: string;
  /** Voice ID used to generate this audio */
  voice_id: string;
}

/**
 * Response from saving audio to persistent storage
 */
export interface SaveAudioResponse {
  /** Whether the save operation succeeded */
  success: boolean;
  /** URL to access the stored audio */
  url: string;
  /** Storage key where the audio is saved */
  storage_key: string;
}

/**
 * Response from retrieving audio from storage
 */
export interface GetAudioResponse {
  /** Whether the retrieval operation succeeded */
  success: boolean;
  /** URL to access the stored audio (if it exists) */
  url?: string;
  /** Storage key where the audio is saved (if it exists) */
  storage_key?: string;
  /** Whether audio exists for the requested project/scene */
  exists: boolean;
} 