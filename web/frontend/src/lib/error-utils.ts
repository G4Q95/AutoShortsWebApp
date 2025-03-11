/**
 * Error handling utilities for the frontend
 */
import { ApiResponse } from './api-client';

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
  
  formattedError.statusCode = error.status;
  
  // Determine error type based on status code
  if (error.status >= 400 && error.status < 500) {
    if (error.status === 401) {
      formattedError.type = ErrorType.UNAUTHORIZED;
      formattedError.message = 'You must be logged in to perform this action';
    } else if (error.status === 403) {
      formattedError.type = ErrorType.UNAUTHORIZED;
      formattedError.message = 'You don\'t have permission to perform this action';
    } else if (error.status === 404) {
      formattedError.type = ErrorType.NOT_FOUND;
      formattedError.message = 'The requested resource was not found';
    } else if (error.status === 422) {
      formattedError.type = ErrorType.VALIDATION;
      formattedError.message = 'The provided data is invalid';
    } else {
      formattedError.type = ErrorType.API;
      formattedError.message = error.detail || 'Request failed';
    }
  } else if (error.status >= 500) {
    formattedError.type = ErrorType.API;
    formattedError.message = 'Server error, please try again later';
  } else if (error.status === 0) {
    formattedError.type = ErrorType.NETWORK;
    formattedError.message = 'Network error, please check your connection';
  } else if (error.status === 408) {
    formattedError.type = ErrorType.TIMEOUT;
    formattedError.message = 'Request timed out, please try again';
  }
  
  // Override with specific error detail if available
  if (error.detail) {
    formattedError.message = error.detail;
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