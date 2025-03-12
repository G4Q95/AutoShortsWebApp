/**
 * Type definitions for API responses and error handling
 */

/**
 * Standard API error format
 * Combines FastAPI's error format with our custom extensions
 */
export interface ApiError {
  /** Main error message */
  detail: string;
  /** HTTP status code */
  status: number;
  /** Optional error code for client-side handling */
  code?: string;
  /** Detailed validation errors */
  details?: Array<{
    /** Location of the error (e.g., ["body", "username"]) */
    loc?: string[];
    /** Error message */
    msg: string;
    /** Error type identifier */
    type: string;
  }>;
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
 * Standard API response wrapper
 * @template T - The type of the response data
 */
export interface ApiResponse<T> {
  /** Response data (if successful) */
  data?: T;
  /** Error information (if failed) */
  error?: ApiError;
  /** Request timing information */
  timing?: ApiTiming;
  /** Connection status information */
  connectionInfo?: ConnectionInfo;
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
 * Video creation response format
 */
export interface VideoCreationResponse {
  /** Generated video ID */
  videoId: string;
  /** Status message */
  message: string;
  /** Whether the request was successful */
  success: boolean;
}

/**
 * Video status response format
 */
export interface VideoStatusResponse {
  /** Video processing status */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
  /** Video URL (when completed) */
  url?: string;
  /** Error message (when failed) */
  error?: string;
}

/**
 * User profile response format
 */
export interface UserResponse {
  /** User ID */
  id: string;
  /** User's email address */
  email: string;
  /** User's display name */
  name: string;
  /** Account creation date */
  createdAt: string;
  /** Account type */
  accountType: 'free' | 'premium';
  /** Usage statistics */
  usage: {
    /** Number of videos created */
    videosCreated: number;
    /** Storage used in bytes */
    storageUsed: number;
    /** API calls made */
    apiCalls: number;
  };
} 