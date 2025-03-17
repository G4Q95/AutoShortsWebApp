/**
 * @fileoverview Core API client functionality for interacting with the backend
 * 
 * This module provides the base API client with core functionality including:
 * - Base fetchAPI function for all API requests
 * - Error handling and standardization
 * - Request timeouts and response timing
 * - API health monitoring
 */

import { 
  ApiError, 
  ApiHealth, 
  ApiResponse,
  ConnectionInfo,
  ApiTiming
} from '../api-types';

/**
 * Base URL for the API
 * Uses environment variable if available, falls back to localhost
 */
const isBrowser = typeof window !== 'undefined'; 
// Use NEXT_PUBLIC_BROWSER_API_URL for browser requests, otherwise use NEXT_PUBLIC_API_URL for server requests
export const API_BASE_URL = isBrowser 
  ? (process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:8000') 
  : (process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000'); 

/**
 * API version prefix for all endpoints
 */
export const API_VERSION = '/api/v1';

/**
 * Default timeout for API requests in milliseconds (10 seconds)
 */
export const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Global API health state
 * Tracks the availability and performance of the API
 */
export const apiHealth: ApiHealth = {
  lastChecked: 0,
  isAvailable: false,
  responseTime: 0,
  checkInProgress: false,
};

/**
 * Enhanced fetch wrapper with error handling and diagnostics
 * 
 * @template T - The expected response data type
 * @param {string} endpoint - The API endpoint to call (without base URL and version)
 * @param {RequestInit} [options={}] - Fetch options (method, headers, body, etc.)
 * @param {number} [timeoutMs=DEFAULT_TIMEOUT_MS] - Request timeout in milliseconds
 * @returns {Promise<ApiResponse<T>>} Promise with standardized API response
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
    const timing: ApiTiming = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };

    // Create connection info
    const connectionInfo: ConnectionInfo = {
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
    const timing: ApiTiming = {
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
 * 
 * @returns {Promise<ApiResponse<{ status: string }>>} Promise with API health status
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