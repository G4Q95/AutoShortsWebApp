/**
 * Error handling utilities for the frontend
 */
import { ApiResponse } from './api-types';

export enum ErrorType {
  API = 'api_error',
  NETWORK = 'network_error',
  VALIDATION = 'validation_error',
  UNAUTHORIZED = 'unauthorized',
  NOT_FOUND = 'not_found',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown_error',
}

export interface FormattedError {
  message: string;
  type: ErrorType;
  code?: string;
  details?: string[];
  statusCode?: number;
  field?: string;
}

/**
 * Formats API errors into a standardized format
 */
export function formatApiError<T>(response: ApiResponse<T>): FormattedError {
  const error = response.error;
  
  // Default error
  const formattedError: FormattedError = {
    message: 'An unexpected error occurred',
    type: ErrorType.UNKNOWN,
  };
  
  if (!error) {
    return formattedError;
  }
  
  formattedError.statusCode = error.status_code;
  
  // Use the error message directly from the API response
  formattedError.message = error.message;
  
  // Map error codes to error types
  if (error.error_code) {
    switch (error.error_code) {
      case 'authentication_required':
      case 'authentication_failed':
      case 'authentication_expired':
      case 'invalid_authentication':
        formattedError.type = ErrorType.UNAUTHORIZED;
        break;
      case 'permission_denied':
      case 'access_forbidden':
        formattedError.type = ErrorType.UNAUTHORIZED;
        break;
      case 'resource_not_found':
      case 'content_not_found':
        formattedError.type = ErrorType.NOT_FOUND;
        break;
      case 'validation_error':
      case 'invalid_parameters':
      case 'missing_parameters':
        formattedError.type = ErrorType.VALIDATION;
        break;
      case 'network_error':
      case 'service_unavailable':
        formattedError.type = ErrorType.NETWORK;
        break;
      case 'timeout_error':
        formattedError.type = ErrorType.TIMEOUT;
        break;
      default:
        formattedError.type = ErrorType.API;
    }
  } else {
    // Fallback to status code based type determination
    if (error.status_code >= 400 && error.status_code < 500) {
      if (error.status_code === 401) {
        formattedError.type = ErrorType.UNAUTHORIZED;
      } else if (error.status_code === 403) {
        formattedError.type = ErrorType.UNAUTHORIZED;
      } else if (error.status_code === 404) {
        formattedError.type = ErrorType.NOT_FOUND;
      } else if (error.status_code === 422) {
        formattedError.type = ErrorType.VALIDATION;
      } else {
        formattedError.type = ErrorType.API;
      }
    } else if (error.status_code >= 500) {
      formattedError.type = ErrorType.API;
    } else if (error.status_code === 0) {
      formattedError.type = ErrorType.NETWORK;
    } else if (error.status_code === 408) {
      formattedError.type = ErrorType.TIMEOUT;
    }
  }
  
  // Add any additional details
  if (error.details) {
    formattedError.details = error.details.map((d: { msg: string }) => d.msg);
  }
  
  return formattedError;
}

/**
 * Gets a user-friendly error message from any type of error
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle our formatted errors
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return (error as { message: string }).message;
  }
  
  return 'An unexpected error occurred';
}

/**
 * Formats validation errors by field
 */
export function formatValidationErrors(
  errors: Record<string, string[]> | undefined
): Record<string, string> {
  if (!errors) {
    return {};
  }
  
  const formattedErrors: Record<string, string> = {};
  
  Object.entries(errors).forEach(([field, messages]) => {
    formattedErrors[field] = messages[0] || 'Invalid value';
  });
  
  return formattedErrors;
}

/**
 * Creates a user-friendly error message for content extraction errors
 */
export function getContentExtractionErrorMessage(error: unknown): string {
  const baseMessage = 'Failed to extract content';
  
  if (typeof error === 'string') {
    if (error.includes('404') || error.includes('not found')) {
      return 'The content was not found. Please check the URL and try again.';
    }
    if (error.includes('403') || error.includes('forbidden')) {
      return 'Access to this content is restricted. Please try a different URL.';
    }
    if (error.includes('timeout')) {
      return 'Request timed out. The server might be busy, please try again later.';
    }
    return `${baseMessage}: ${error}`;
  }
  
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('404') || message.includes('not found')) {
      return 'The content was not found. Please check the URL and try again.';
    }
    if (message.includes('403') || message.includes('forbidden')) {
      return 'Access to this content is restricted. Please try a different URL.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. The server might be busy, please try again later.';
    }
    return `${baseMessage}: ${error.message}`;
  }
  
  return baseMessage;
} 