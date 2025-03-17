import React from 'react';
import { AlertTriangle, Info, AlertCircle, X as CloseIcon, RefreshCw } from 'lucide-react';
import { ErrorType } from '@/lib/error-utils';

/**
 * Props for the ErrorDisplay component
 */
interface ErrorDisplayProps {
  /** The error to display - can be a string message, Error object, or null/undefined */
  error: string | Error | null | undefined;
  /** The type of error, which determines the color scheme and icon */
  type?: 'validation' | 'api' | 'network' | 'extraction' | 'general';
  /** Specific error type from ErrorType enum for additional context */
  errorType?: ErrorType;
  /** Whether to show a retry button */
  showRetry?: boolean;
  /** Callback function when retry button is clicked */
  onRetry?: () => void;
  /** Callback function when dismiss button is clicked */
  onDismiss?: () => void;
  /** Additional CSS classes to apply to the component */
  className?: string;
  /** HTTP status code associated with the error */
  statusCode?: number;
}

/**
 * A versatile error display component that shows error messages with appropriate styling and icons.
 * 
 * Features:
 * - Multiple error types with distinct color schemes
 * - Support for different error formats (string, Error object)
 * - Optional retry and dismiss actions
 * - Contextual icons based on error type
 * - Accessibility support with ARIA attributes
 * - HTTP status code display
 * - Additional context for network and timeout errors
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorDisplay error="Something went wrong" />
 * 
 * // Network error with retry option
 * <ErrorDisplay 
 *   error="Failed to fetch data"
 *   type="network"
 *   errorType={ErrorType.NETWORK}
 *   showRetry
 *   onRetry={() => refetchData()}
 * />
 * 
 * // Validation error with dismiss option
 * <ErrorDisplay 
 *   error="Invalid input"
 *   type="validation"
 *   errorType={ErrorType.VALIDATION}
 *   onDismiss={() => setError(null)}
 * />
 * 
 * // API error with status code
 * <ErrorDisplay 
 *   error="Not found"
 *   type="api"
 *   statusCode={404}
 *   errorType={ErrorType.NOT_FOUND}
 * />
 * ```
 */
export default function ErrorDisplay({
  error,
  type = 'general',
  errorType,
  showRetry = false,
  onRetry,
  onDismiss,
  className = '',
  statusCode,
}: ErrorDisplayProps) {
  if (!error) return null;

  // Convert error to string message
  const errorMessage = typeof error === 'string' ? error : error.message || 'An error occurred';

  // Determine background color based on error type
  let bgColor = 'bg-red-50';
  let textColor = 'text-red-700';
  let borderColor = 'border-red-200';
  let iconColor = 'text-red-500';

  // Adjust colors based on the type
  if (type === 'validation') {
    bgColor = 'bg-yellow-50';
    textColor = 'text-yellow-800';
    borderColor = 'border-yellow-200';
    iconColor = 'text-yellow-500';
  } else if (type === 'network') {
    bgColor = 'bg-blue-50';
    textColor = 'text-blue-700';
    borderColor = 'border-blue-200';
    iconColor = 'text-blue-600';
  } else if (type === 'extraction') {
    bgColor = 'bg-orange-50';
    textColor = 'text-orange-700';
    borderColor = 'border-orange-200';
    iconColor = 'text-orange-500';
  }

  // Select icon based on error type
  let Icon = AlertTriangle;
  if (type === 'validation') {
    Icon = Info;
  } else if (type === 'network' || type === 'extraction') {
    Icon = AlertCircle;
  }

  return (
    <div
      className={`flex items-start p-3 rounded-md border ${bgColor} ${borderColor} ${className}`}
      role="alert"
      aria-live="assertive"
      data-testid="error-display"
      data-error-type={type}
    >
      <div className={`shrink-0 ${iconColor} mr-2 pt-0.5`} data-testid="error-icon">
        <Icon size={16} />
      </div>
      <div className={`flex-grow ${textColor} text-sm`} data-testid="error-content">
        <p className="font-medium" data-testid="error-message">
          {errorType === ErrorType.UNAUTHORIZED && '⚠️ Authentication Error: '}
          {errorType === ErrorType.VALIDATION && '⚠️ Validation Error: '}
          {errorType === ErrorType.NOT_FOUND && '🔍 Not Found: '}
          {errorType === ErrorType.NETWORK && '🌐 Network Error: '}
          {errorType === ErrorType.TIMEOUT && '⏱️ Timeout Error: '}
          {statusCode && `[${statusCode}] `}
          {errorMessage}
        </p>
        {errorType === ErrorType.NETWORK && (
          <p className="mt-1 text-xs opacity-80" data-testid="error-help-text">
            Check your internet connection or try again later.
          </p>
        )}
        {errorType === ErrorType.TIMEOUT && (
          <p className="mt-1 text-xs opacity-80" data-testid="error-help-text">
            The server is taking too long to respond. Please try again later.
          </p>
        )}
      </div>
      <div className="flex gap-2 ml-2 shrink-0" data-testid="error-actions">
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`${iconColor} p-1 hover:bg-white hover:bg-opacity-30 rounded`}
            aria-label="Retry"
            data-testid="error-retry-button"
          >
            <RefreshCw size={14} />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${iconColor} p-1 hover:bg-white hover:bg-opacity-30 rounded`}
            aria-label="Dismiss error"
            data-testid="error-dismiss-button"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
} 