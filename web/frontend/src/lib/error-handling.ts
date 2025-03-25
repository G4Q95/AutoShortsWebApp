/**
 * Error handling utilities for the application
 * 
 * This module provides enhanced error types and utilities for
 * consistent error handling throughout the application.
 */

/**
 * Categories of errors that can occur in the application
 */
export enum ErrorCategory {
  // Network-related errors
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  SERVER = 'server',
  
  // Input validation errors
  VALIDATION = 'validation',
  
  // Authentication errors
  AUTH = 'auth',
  
  // Resource errors
  NOT_FOUND = 'not_found',
  FORBIDDEN = 'forbidden',
  
  // Data-related errors
  DATA_PARSING = 'data_parsing',
  
  // Application errors
  APP = 'app',
  
  // Unknown/uncategorized errors
  UNKNOWN = 'unknown'
}

/**
 * Enhanced error interface with additional metadata
 */
export interface EnhancedError extends Error {
  category: ErrorCategory;
  details?: Record<string, any>;
  timestamp: number;
  originalError?: Error;
  statusCode?: number;
}

/**
 * Create an enhanced error with category and details
 * 
 * @param message Error message
 * @param category Error category
 * @param details Additional error details
 * @param originalError Original error if this is wrapping another error
 * @returns Enhanced error object
 */
export function createError(
  message: string,
  category: ErrorCategory = ErrorCategory.UNKNOWN,
  details?: Record<string, any>,
  originalError?: Error
): EnhancedError {
  const error = new Error(message) as EnhancedError;
  error.category = category;
  error.details = details;
  error.timestamp = Date.now();
  error.originalError = originalError;
  
  // If original error has a status code (e.g., from fetch), preserve it
  if (originalError && 'statusCode' in originalError) {
    error.statusCode = (originalError as any).statusCode;
  }
  
  return error;
}

/**
 * Categorize an existing error into an EnhancedError
 * 
 * @param error Original error to categorize
 * @returns Enhanced error with appropriate category
 */
export function categorizeError(error: unknown): EnhancedError {
  // If it's already an EnhancedError, return it
  if (error && typeof error === 'object' && 'category' in error) {
    return error as EnhancedError;
  }
  
  // Convert to string for analysis if not an Error object
  const errorMessage = error instanceof Error ? error.message : String(error);
  let category = ErrorCategory.UNKNOWN;
  
  // Categorize based on error message patterns
  if (/network|fetch|failed to fetch|net::/i.test(errorMessage)) {
    category = ErrorCategory.NETWORK;
  } else if (/timeout|timed out|time exceeded/i.test(errorMessage)) {
    category = ErrorCategory.TIMEOUT;
  } else if (/not found|404|doesn't exist/i.test(errorMessage)) {
    category = ErrorCategory.NOT_FOUND;
  } else if (/forbidden|unauthorized|permission|403|401/i.test(errorMessage)) {
    category = ErrorCategory.FORBIDDEN;
  } else if (/invalid|validation|not valid/i.test(errorMessage)) {
    category = ErrorCategory.VALIDATION;
  } else if (/parse|json|syntax/i.test(errorMessage)) {
    category = ErrorCategory.DATA_PARSING;
  } else if (/server error|500|502|503|504/i.test(errorMessage)) {
    category = ErrorCategory.SERVER;
  }
  
  // Create new enhanced error with appropriate category
  return createError(
    errorMessage,
    category,
    {},
    error instanceof Error ? error : undefined
  );
}

/**
 * Utility to handle errors consistently in async functions
 * 
 * @param fn Async function to execute
 * @param errorTransformer Optional function to transform errors
 * @returns Promise with result or enhanced error
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>,
  errorTransformer?: (error: unknown) => EnhancedError
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (errorTransformer) {
      throw errorTransformer(error);
    } else {
      throw categorizeError(error);
    }
  }
} 