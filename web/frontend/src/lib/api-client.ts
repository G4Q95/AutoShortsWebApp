/**
 * @fileoverview API client for interacting with the Auto Shorts backend
 * 
 * This module provides a robust API client for communicating with the Auto Shorts backend.
 * It handles:
 * - API request/response lifecycle
 * - Error handling and parsing
 * - Request timeouts
 * - API health monitoring
 * - Development logging
 * - Response timing
 * 
 * Key features:
 * - Type-safe API responses
 * - Automatic error handling
 * - Request timeout management
 * - Development mode logging
 * - API health tracking
 * - Standardized error formats
 * - CORS error handling
 * - Network error detection
 * 
 * @module api-client
 */

import { 
  ApiError, 
  ApiResponse, 
  ApiHealth, 
  VideoCreationResponse, 
  VideoStatusResponse,
  UserResponse 
} from './api-types';

/**
 * Base URL for the API
 * Uses environment variable if available, falls back to localhost
 * @constant
 */
const isBrowser = typeof window !== 'undefined'; 
// Use NEXT_PUBLIC_BROWSER_API_URL for browser requests, otherwise use NEXT_PUBLIC_API_URL for server requests
const API_BASE_URL = isBrowser 
  ? (process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:8000') 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000'); 
console.log('Using API URL:', API_BASE_URL, 'isBrowser:', isBrowser);

/**
 * API version prefix for all endpoints
 * @constant
 */
const API_VERSION = '/api/v1';

/**
 * Default timeout for API requests in milliseconds (10 seconds)
 * @constant
 */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Global API health state
 * Tracks the availability and performance of the API
 * 
 * @type {ApiHealth}
 */
export const apiHealth: ApiHealth = {
  lastChecked: 0,
  isAvailable: false,
  responseTime: 0,
  checkInProgress: false,
};

/**
 * Enhanced fetch wrapper with error handling and diagnostics
 * Provides a standardized way to make API requests with:
 * - Automatic timeout handling
 * - Error parsing and formatting
 * - Response timing
 * - Development mode logging
 * - Type-safe responses
 * 
 * @template T - The expected response data type
 * @param {string} endpoint - The API endpoint to call (without base URL and version)
 * @param {RequestInit} [options={}] - Fetch options (method, headers, body, etc.)
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - Request timeout in milliseconds
 * @returns {Promise<ApiResponse<T>>} Promise with standardized API response
 * 
 * @example
 * // Simple GET request
 * const response = await fetchAPI('/users/me');
 * 
 * // POST request with body
 * const response = await fetchAPI('/videos', {
 *   method: 'POST',
 *   body: JSON.stringify({ url: 'https://example.com' })
 * });
 * 
 * // Custom timeout
 * const response = await fetchAPI('/long-operation', {}, 30000);
 * 
 * @throws Will not throw, but returns error in ApiResponse
 */
export async function fetchAPI<T = any>(
  endpoint: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<ApiResponse<T>> {
  const startTime = performance.now();

  try {
    const url = `${API_BASE_URL}${API_VERSION}${endpoint}`;
    
    // Log requests in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Request: ${options.method || 'GET'} ${url}`);
      if (options.body) {
        console.log('Request Body:', options.body);
      }
    }

    // Default headers
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    // Clear timeout
    clearTimeout(timeoutId);

    // Calculate response time
    const endTime = performance.now();
    const timing = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };

    // Create connection info
    const connectionInfo = {
      success: response.ok,
      server: API_BASE_URL,
      status: response.status,
      statusText: response.statusText,
    };

    // Log response in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`API Response: ${response.status} ${response.statusText}`);
      console.log('Response Time:', Math.round(timing.duration), 'ms');
    }

    // Update API health if this was a successful request
    if (response.ok) {
      apiHealth.lastChecked = Date.now();
      apiHealth.isAvailable = true;
      apiHealth.responseTime = timing.duration;
    }

    // Handle non-2xx responses
    if (!response.ok) {
      const error: ApiError = {
        status_code: response.status,
        message: `${response.status}: ${response.statusText}`,
      };

      // Try to parse error message from the response
      try {
        const data = await response.json();
        
        // Handle FastAPI error response format
        if (data.status_code && data.message) {
          error.status_code = data.status_code;
          error.message = data.message;
          error.error_code = data.error_code;
          error.details = data.details;
        } else if (data.detail) {
          // Legacy FastAPI error format
          error.message = data.detail;
        } else if (typeof data === 'string') {
          error.message = data;
        } else if (data.error) {
          error.message = data.error;
        }
        
        if (process.env.NODE_ENV === 'development') {
          console.error('API Error:', data);
        }
      } catch (e) {
        // Ignore parsing errors
        if (process.env.NODE_ENV === 'development') {
          console.error('API Error (failed to parse response):', e);
        }
      }

      return { 
        error, 
        timing, 
        connectionInfo,
        data: null as any // Add missing data property for TypeScript
      };
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return { data: null as any, timing, connectionInfo };
    }

    const data = await response.json();
    
    // Log data in development (truncated for large responses)
    if (process.env.NODE_ENV === 'development') {
      const dataStr = JSON.stringify(data);
      console.log('Response Data:', dataStr.length > 1000 
        ? dataStr.substring(0, 1000) + '... [truncated]' 
        : data
      );
    }
    
    return { data, timing, connectionInfo };
  } catch (error) {
    const endTime = performance.now();
    const timing = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', error);
    }

    // Handle timeout errors
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        error: {
          status_code: 408, // Request Timeout
          message: `Request timed out after ${timeoutMs}ms`,
          error_code: 'timeout_error'
        },
        timing,
        connectionInfo: {
          success: false,
          server: API_BASE_URL,
          status: 408,
          statusText: 'Request Timeout',
        },
        data: null as any // Add missing data property for TypeScript
      };
    }

    // Update API health status for connection errors
    apiHealth.isAvailable = false;
    apiHealth.lastChecked = Date.now();

    // Create user-friendly error messages
    let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    let errorStatusCode = 500;
    let errorStatusText = 'Server Error';
    let errorCode: string | undefined;
    
    // Map common error patterns to user-friendly messages
    if (errorMessage === 'Failed to fetch') {
      errorMessage = 'Could not connect to the backend server. Please ensure the server is running.';
      errorStatusCode = 503; // Service Unavailable
      errorStatusText = 'Backend Unavailable';
      errorCode = 'service_unavailable';
    } else if (errorMessage.includes('NetworkError')) {
      errorMessage = 'Network error: Check your internet connection or backend server status.';
      errorStatusCode = 503;
      errorStatusText = 'Network Error';
      errorCode = 'network_error';
    } else if (errorMessage.includes('CORS')) {
      errorMessage = 'CORS policy error: The backend server is not properly configured for cross-origin requests.';
      errorStatusCode = 520; // Custom status for CORS
      errorStatusText = 'CORS Policy Error';
      errorCode = 'cors_error';
    }

    return {
      error: {
        status_code: errorStatusCode,
        message: errorMessage,
        error_code: errorCode,
      },
      timing,
      connectionInfo: {
        success: false,
        server: API_BASE_URL,
        status: errorStatusCode,
        statusText: errorStatusText,
      },
      data: null as any // Add missing data property for TypeScript
    };
  }
}

/**
 * Checks if the API is available and returns connection status
 * Prevents multiple simultaneous health checks and caches results
 * 
 * @returns {Promise<ApiResponse<{ status: string }>>} Promise with API health status
 * 
 * @example
 * const health = await checkApiHealth();
 * if (health.error) {
 *   console.error('API is not available:', health.error.message);
 * } else {
 *   console.log('API Status:', health.data.status);
 * }
 */
export async function checkApiHealth(): Promise<ApiResponse<{ status: string }>> {
  // Prevent multiple simultaneous health checks
  if (apiHealth.checkInProgress) {
    return {
      data: { status: apiHealth.isAvailable ? 'available' : 'unavailable' },
      connectionInfo: {
        success: apiHealth.isAvailable,
        server: API_BASE_URL,
        status: apiHealth.isAvailable ? 200 : 503,
        statusText: apiHealth.isAvailable ? 'OK' : 'Service Unavailable',
      },
      timing: {
        start: 0,
        end: 0,
        duration: 0
      }
    };
  }

  apiHealth.checkInProgress = true;

  try {
    // Use a short timeout for health checks and use the Next.js rewrite
    const url = '/health'; // This will be rewritten to the backend
    console.log('Checking API health at:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const startTime = performance.now();

    const fetchResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const endTime = performance.now();

    console.log('Health check response:', fetchResponse.status, fetchResponse.statusText);

    const data = await fetchResponse.json();
    console.log('Health check data:', data);

    apiHealth.lastChecked = Date.now();
    apiHealth.isAvailable = fetchResponse.ok;
    apiHealth.responseTime = endTime - startTime;
    apiHealth.checkInProgress = false;

    return {
      data,
      timing: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime,
      },
      connectionInfo: {
        success: fetchResponse.ok,
        server: 'Using Next.js rewrite',
        status: fetchResponse.status,
        statusText: fetchResponse.statusText,
      },
    };
  } catch (err) {
    console.error('Error checking API health:', err);
    apiHealth.checkInProgress = false;
    return {
      error: {
        status_code: 0,
        message: err instanceof Error ? err.message : 'Unknown error checking API health',
        error_code: 'health_check_error'
      },
      connectionInfo: {
        success: false,
        server: 'Using Next.js rewrite',
        status: 0,
        statusText: 'Not Connected',
      },
      timing: {
        start: 0,
        end: 0,
        duration: 0
      },
      data: null as any
    };
  }
}

/**
 * Extracts content from a provided URL using the backend content extraction service
 * Handles URL encoding and error cases for failed extractions
 * 
 * @param {string} url - The URL to extract content from (must be from a supported domain)
 * @returns {Promise<ApiResponse<any>>} Promise with extracted content or error details
 * 
 * @example
 * const result = await extractContent('https://reddit.com/r/stories/123');
 * if (result.error) {
 *   console.error('Failed to extract:', result.error.message);
 * } else {
 *   console.log('Extracted content:', result.data);
 * }
 * 
 * @throws Will not throw, returns error in ApiResponse instead
 */
export async function extractContent(url: string): Promise<ApiResponse<any>> {
  try {
    return await fetchAPI(`/content/extract?url=${encodeURIComponent(url)}`, {
      method: 'GET',
    });
  } catch (error) {
    console.error('Error extracting content:', error);
    return {
      error: {
        status_code: 500,
        message: error instanceof Error ? error.message : 'Failed to extract content from URL',
        error_code: 'content_extraction_error'
      },
      data: null as any,
      timing: {
        start: 0,
        end: 0,
        duration: 0
      },
      connectionInfo: {
        success: false,
        server: API_BASE_URL,
        status: 500,
        statusText: 'Internal Error'
      }
    };
  }
}

/**
 * Rewrites text using AI to match a specified style and length
 * Uses the backend AI service to transform the text while preserving meaning
 * 
 * @param {string} text - The original text to rewrite
 * @param {string} [style='engaging'] - The desired writing style (e.g., 'engaging', 'professional', 'casual')
 * @param {number} [maxLength] - Optional maximum length for the rewritten text
 * @returns {Promise<ApiResponse<any>>} Promise with rewritten text or error details
 * 
 * @example
 * const result = await rewriteText(
 *   'Original text here',
 *   'engaging',
 *   150
 * );
 * if (result.error) {
 *   console.error('Rewrite failed:', result.error.message);
 * } else {
 *   console.log('Rewritten text:', result.data.text);
 * }
 */
export async function rewriteText(
  text: string,
  style: string = 'engaging',
  maxLength?: number
): Promise<ApiResponse<any>> {
  return fetchAPI('/ai/rewrite', {
    method: 'POST',
    body: JSON.stringify({
      text,
      style,
      max_length: maxLength,
    }),
  });
}

/**
 * Parameters required for video creation requests
 * 
 * @interface VideoCreationRequest
 * @property {string} source_url - URL to extract content from
 * @property {string} title - Title for the generated video
 * @property {string} [voice_id] - Optional voice ID for narration
 * @property {string} [text_style] - Optional style for text rewriting
 */
export interface VideoCreationRequest {
  source_url: string;
  title: string;
  voice_id?: string;
  text_style?: string;
}

/**
 * Creates a new video from a source URL with specified parameters
 * Handles the initial video creation request and returns a task ID for status tracking
 * 
 * @param {string} sourceUrl - URL to extract content from (must be from supported domain)
 * @param {string} title - Title for the generated video
 * @param {string} [voiceId='default'] - Voice ID for narration (defaults to system default)
 * @param {string} [textStyle='engaging'] - Style for text rewriting (defaults to 'engaging')
 * @returns {Promise<ApiResponse<VideoCreationResponse>>} Promise with video creation task details
 * 
 * @example
 * const result = await createVideo(
 *   'https://reddit.com/r/stories/123',
 *   'My Awesome Video',
 *   'en-US-1',
 *   'engaging'
 * );
 * if (result.error) {
 *   console.error('Video creation failed:', result.error.message);
 * } else {
 *   console.log('Video creation started:', result.data.task_id);
 * }
 */
export async function createVideo(
  sourceUrl: string,
  title: string,
  voiceId: string = 'default',
  textStyle: string = 'engaging'
): Promise<ApiResponse<VideoCreationResponse>> {
  return fetchAPI('/video-creation/create', {
    method: 'POST',
    body: JSON.stringify({
      source_url: sourceUrl,
      title,
      voice_id: voiceId,
      text_style: textStyle,
    }),
  });
}

/**
 * Retrieves the current status of a video creation task
 * Used to poll for updates on video generation progress
 * 
 * @param {string} taskId - ID of the video creation task to check
 * @returns {Promise<ApiResponse<VideoStatusResponse>>} Promise with current task status
 * 
 * @example
 * const status = await getVideoStatus('task-123');
 * if (status.error) {
 *   console.error('Failed to get status:', status.error.message);
 * } else {
 *   console.log('Current status:', status.data.status);
 *   console.log('Progress:', status.data.progress);
 * }
 */
export async function getVideoStatus(taskId: string): Promise<ApiResponse<VideoStatusResponse>> {
  return fetchAPI(`/video-creation/status/${taskId}`);
}

/**
 * Retrieves the current user's profile information
 * Used for authentication status and user details
 * 
 * @returns {Promise<ApiResponse<UserResponse>>} Promise with user profile data
 * 
 * @example
 * const user = await getCurrentUser();
 * if (user.error) {
 *   console.error('Failed to get user:', user.error.message);
 * } else {
 *   console.log('Current user:', user.data.username);
 * }
 */
export async function getCurrentUser(): Promise<ApiResponse<UserResponse>> {
  return fetchAPI('/users/me');
}
