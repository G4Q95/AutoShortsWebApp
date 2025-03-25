import React from 'react';

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * LoadingState component
 * 
 * Displays a loading spinner with an optional message
 */
export default function LoadingState({ 
  message = 'Loading...', 
  fullScreen = false,
  className = ''
}: LoadingStateProps) {
  const containerClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white/80 z-50'
    : 'flex flex-col items-center justify-center p-6';

  return (
    <div className={`${containerClasses} ${className}`}>
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900"></div>
        {message && (
          <p className="mt-4 text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
} 