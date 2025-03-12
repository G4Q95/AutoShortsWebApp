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