import React from 'react';
import { AlertCircleIcon, RefreshCwIcon, ExternalLinkIcon, WifiOffIcon } from 'lucide-react';

/**
 * Error types supported by the ErrorDisplay component
 */
export type ErrorType = 'network' | 'validation' | 'extraction' | 'processing' | 'general';

/**
 * Props for the ErrorDisplay component
 */
interface ErrorDisplayProps {
  /** The error message or object to display */
  error: string | Error;
  /** The type of error that occurred */
  type?: ErrorType;
  /** Optional callback function to retry the failed operation */
  onRetry?: () => void;
  /** Whether to show the retry button */
  showRetry?: boolean;
  /** Additional CSS classes to apply to the component */
  className?: string;
}

/**
 * A reusable error display component that shows error messages with appropriate styling and actions.
 * 
 * Features:
 * - Different styles based on error type (network, validation, extraction, processing, general)
 * - Optional retry functionality
 * - Automatic detection of Reddit-related errors
 * - Rate limit error detection
 * - Responsive design with appropriate icons
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <ErrorDisplay error="Failed to load content" />
 * 
 * // With retry functionality
 * <ErrorDisplay 
 *   error="Network error occurred"
 *   type="network"
 *   showRetry={true}
 *   onRetry={() => handleRetry()}
 * />
 * 
 * // With custom styling
 * <ErrorDisplay 
 *   error="Validation failed"
 *   type="validation"
 *   className="my-4"
 * />
 * ```
 */
export default function ErrorDisplay({
  error,
  type = 'general',
  onRetry,
  showRetry = false,
  className = '',
}: ErrorDisplayProps) {
  // Convert error to string if it's an Error object
  const errorMessage = error instanceof Error ? error.message : error;

  // Determine if error is likely due to Reddit URL issues
  const isRedditError =
    errorMessage.toLowerCase().includes('reddit') || errorMessage.toLowerCase().includes('redirect');

  const isRateLimitError = errorMessage.toLowerCase().includes('rate limit') || 
    errorMessage.toLowerCase().includes('too many requests');

  // Custom styling based on error type
  const getContainerStyles = () => {
    switch (type) {
      case 'network':
        return 'bg-red-50 border-red-200 text-red-700';
      case 'validation':
        return 'bg-yellow-50 border-yellow-200 text-yellow-700';
      case 'extraction':
        return 'bg-orange-50 border-orange-200 text-orange-700';
      case 'processing':
        return 'bg-blue-50 border-blue-200 text-blue-700';
      default:
        return 'bg-red-50 border-red-200 text-red-700';
    }
  };

  // Get the appropriate icon
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <WifiOffIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />;
      default:
        return <AlertCircleIcon className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />;
    }
  };

  // Generate helpful suggestions based on error type
  const getSuggestion = () => {
    if (isRateLimitError) {
      return (
        <div className="mt-2 text-sm">
          <p className="font-medium">Rate Limit Detected:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Please wait a few minutes before trying again</li>
            <li>Consider using a different Reddit post</li>
            <li>Ensure you're not making too many requests in a short time</li>
          </ul>
        </div>
      );
    }

    if (isRedditError) {
      return (
        <div className="mt-2 text-sm">
          <p className="font-medium">Suggestions for Reddit URLs:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Use the direct permalink to the post</li>
            <li>Try using old.reddit.com instead of www.reddit.com</li>
            <li>Ensure the post is public and not in a private subreddit</li>
            <li>Check if the post has been deleted or removed</li>
          </ul>
        </div>
      );
    }

    switch (type) {
      case 'network':
        return (
          <p className="mt-2 text-sm">
            Check your internet connection and ensure the backend server is running.
          </p>
        );
      case 'extraction':
        return (
          <p className="mt-2 text-sm">
            The content couldn&apos;t be extracted from the provided URL. Try a different URL or
            check if the content is accessible.
          </p>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`p-4 rounded-md ${getContainerStyles()} ${className}`}
      data-testid="error-display"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            {errorMessage}
          </h3>

          {getSuggestion()}

          {showRetry && onRetry && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={onRetry}
                className={`inline-flex items-center px-4 py-2 rounded-md hover:bg-opacity-80 transition-colors
                  ${
                    type === 'network'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
              >
                <RefreshCwIcon className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
