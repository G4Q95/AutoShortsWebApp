import React from 'react';
import { AlertCircleIcon, RefreshCwIcon, ExternalLinkIcon, WifiOffIcon } from 'lucide-react';

export type ErrorType = 'network' | 'validation' | 'extraction' | 'processing' | 'general';

interface ErrorDisplayProps {
  error: string;
  type?: ErrorType;
  onRetry?: () => void;
  showRetry?: boolean;
  className?: string;
}

export default function ErrorDisplay({ 
  error, 
  type = 'general', 
  onRetry, 
  showRetry = false,
  className = '' 
}: ErrorDisplayProps) {
  // Determine if error is likely due to Reddit URL issues
  const isRedditError = error.toLowerCase().includes('reddit') || 
                        error.toLowerCase().includes('redirect');
  
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
    if (isRedditError) {
      return (
        <div className="mt-2 text-sm">
          <p className="font-medium">Suggestions for Reddit URLs:</p>
          <ul className="list-disc pl-5 mt-1">
            <li>Use the direct permalink to the post</li>
            <li>Try using old.reddit.com instead of www.reddit.com</li>
            <li>Ensure the post is public and not in a private subreddit</li>
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
            The content couldn't be extracted from the provided URL. 
            Try a different URL or check if the content is accessible.
          </p>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className={`p-4 border rounded-md mb-4 ${getContainerStyles()} ${className}`}>
      <div className="flex items-start">
        {getIcon()}
        <span>{error}</span>
      </div>
      
      {getSuggestion()}
      
      {showRetry && onRetry && (
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onRetry}
            className={`inline-flex items-center px-4 py-2 rounded-md hover:bg-opacity-80 transition-colors
              ${type === 'network' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 
                'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
} 