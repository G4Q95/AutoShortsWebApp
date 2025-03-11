/**
 * API client for interacting with the Auto Shorts backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_VERSION = '/api/v1';

// Default timeout for API requests in milliseconds
const DEFAULT_TIMEOUT_MS = 10000;

export interface ApiError {
  detail: string;
  status: number;
  code?: string;
  details?: Array<{
    loc?: string[];
    msg: string;
    type: string;
  }>;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  timing?: {
    start: number;
    end: number;
    duration: number;
  };
  connectionInfo?: {
    success: boolean;
    server: string;
    status: number;
    statusText: string;
  };
}

// Track API health
export const apiHealth = {
  lastChecked: 0,
  isAvailable: false,
  responseTime: 0,
  checkInProgress: false,
};

/**
 * Fetch wrapper with enhanced error handling and diagnostics
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

    // If the status code is not in the range 200-299,
    // we still try to parse and throw it.
    if (!response.ok) {
      const error: ApiError = {
        detail: `${response.status}: ${response.statusText}`,
        status: response.status,
      };

      // Try to parse error message from the response
      try {
        const data = await response.json();
        
        // Handle different error formats
        if (data.detail) {
          // Standard FastAPI error
          error.detail = data.detail;
        } else if (data.message) {
          // Our custom error format
          error.detail = data.message;
          error.code = data.error_code;
          error.details = data.details;
        } else if (typeof data === 'string') {
          error.detail = data;
        } else if (data.error) {
          error.detail = data.error;
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

      return { error, timing, connectionInfo };
    }

    // For 204 No Content responses, return null data
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

    // Check if it's an AbortError (timeout)
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        error: {
          detail: `Request timed out after ${timeoutMs}ms`,
          status: 408, // Request Timeout
        },
        timing,
        connectionInfo: {
          success: false,
          server: API_BASE_URL,
          status: 408,
          statusText: 'Request Timeout',
        },
      };
    }

    // Update API health status if this was a connection error
    apiHealth.isAvailable = false;
    apiHealth.lastChecked = Date.now();

    return {
      error: {
        detail: error instanceof Error ? error.message : 'An unknown error occurred',
        status: 500,
      },
      timing,
      connectionInfo: {
        success: false,
        server: API_BASE_URL,
        status: 0,
        statusText: 'Not Connected',
      },
    };
  }
}

/**
 * Check if the API is available and return connection status
 */
export async function checkApiHealth(): Promise<ApiResponse<{ status: string }>> {
  // Prevent multiple simultaneous health checks
  if (apiHealth.checkInProgress) {
    return {
      data: { status: apiHealth.isAvailable ? 'available' : 'unavailable' },
      connectionInfo: {
        success: apiHealth.isAvailable,
        server: API_BASE_URL,
        status: apiHealth.isAvailable ? 200 : 0,
        statusText: apiHealth.isAvailable ? 'OK' : 'Unknown',
      },
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
        detail: err instanceof Error ? err.message : 'Unknown error checking API health',
        status: 0,
      },
      connectionInfo: {
        success: false,
        server: 'Using Next.js rewrite',
        status: 0,
        statusText: 'Not Connected',
      },
    };
  }
}

/**
 * Extract content from a URL
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
        detail: error instanceof Error ? error.message : 'Failed to extract content from URL',
        status: 500,
      },
    };
  }
}

// AI API
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

// Types for video creation
export interface VideoCreationRequest {
  source_url: string;
  title: string;
  voice_id?: string;
  text_style?: string;
}

export interface VideoCreationResponse {
  task_id: string;
  message: string;
}

// Video Creation API
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

export async function getVideoStatus(taskId: string): Promise<ApiResponse<any>> {
  return fetchAPI(`/video-creation/status/${taskId}`);
}

// User API
export async function getCurrentUser(): Promise<ApiResponse<any>> {
  return fetchAPI('/users/me');
}
