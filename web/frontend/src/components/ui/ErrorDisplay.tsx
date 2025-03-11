import React from 'react';
import { AlertTriangle, Info, AlertCircle, X as CloseIcon, RefreshCw } from 'lucide-react';
import { ErrorType } from '@/lib/error-utils';

interface ErrorDisplayProps {
  error: string | Error | null | undefined;
  type?: 'validation' | 'api' | 'network' | 'extraction' | 'general';
  errorType?: ErrorType;
  showRetry?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  statusCode?: number;
}

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
    >
      <div className={`shrink-0 ${iconColor} mr-2 pt-0.5`}>
        <Icon size={16} />
      </div>
      <div className={`flex-grow ${textColor} text-sm`}>
        <p className="font-medium">
          {errorType === ErrorType.UNAUTHORIZED && '⚠️ Authentication Error: '}
          {errorType === ErrorType.VALIDATION && '⚠️ Validation Error: '}
          {errorType === ErrorType.NOT_FOUND && '🔍 Not Found: '}
          {errorType === ErrorType.NETWORK && '🌐 Network Error: '}
          {errorType === ErrorType.TIMEOUT && '⏱️ Timeout Error: '}
          {statusCode && `[${statusCode}] `}
          {errorMessage}
        </p>
        {errorType === ErrorType.NETWORK && (
          <p className="mt-1 text-xs opacity-80">
            Check your internet connection or try again later.
          </p>
        )}
        {errorType === ErrorType.TIMEOUT && (
          <p className="mt-1 text-xs opacity-80">
            The server is taking too long to respond. Please try again later.
          </p>
        )}
      </div>
      <div className="flex gap-2 ml-2 shrink-0">
        {showRetry && onRetry && (
          <button
            onClick={onRetry}
            className={`${iconColor} p-1 hover:bg-white hover:bg-opacity-30 rounded`}
            aria-label="Retry"
          >
            <RefreshCw size={14} />
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`${iconColor} p-1 hover:bg-white hover:bg-opacity-30 rounded`}
            aria-label="Dismiss error"
          >
            <CloseIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
} 