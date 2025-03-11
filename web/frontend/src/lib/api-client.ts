/**
 * API client for interacting with the Auto Shorts backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_VERSION = '/api/v1';

// Default timeout for API requests in milliseconds
const DEFAULT_TIMEOUT_MS = 10000;

interface ApiError {
  detail: string;
  status: number;
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
        if (data.detail) {
          error.detail = data.detail;
        }
      } catch (e) {
        // Ignore parsing errors
      }

      return { error, timing, connectionInfo };
    }

    // For 204 No Content responses, return null data
    if (response.status === 204) {
      return { data: null as any, timing, connectionInfo };
    }

    const data = await response.json();
    return { data, timing, connectionInfo };
  } catch (error) {
    const endTime = performance.now();
    const timing = {
      start: startTime,
      end: endTime,
      duration: endTime - startTime,
    };

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
    // Log the API_BASE_URL for debugging
    console.log('Attempting to connect to backend at:', API_BASE_URL);

    // Use a short timeout for health checks and use the Next.js rewrite
    const url = '/health'; // This will be rewritten to the backend
    console.log('Full health check URL:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const startTime = performance.now();

    console.log('Sending fetch request...');
    const fetchResponse = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const endTime = performance.now();

    console.log('Fetch response received:', fetchResponse.status, fetchResponse.statusText);

    const data = await fetchResponse.json();
    console.log('Response data:', data);

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
    throw new Error('Failed to extract content from URL');
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
