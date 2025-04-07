import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid';

interface MediaErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  mediaType?: 'image' | 'video' | 'gallery' | string;
  mediaUrl?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isCompactView?: boolean;
  resetKey?: any; // When this prop changes, the error state will be reset
  debug?: boolean; // Whether to log verbose errors to console
}

interface MediaErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * MediaErrorBoundary - A specialized error boundary for media components
 * 
 * This component catches JavaScript errors in the media components tree,
 * logs those errors, and displays a fallback UI instead of crashing the app.
 * Specifically designed to work with the VideoContextScenePreviewPlayer
 * and its child components.
 */
export class MediaErrorBoundary extends Component<MediaErrorBoundaryProps, MediaErrorBoundaryState> {
  constructor(props: MediaErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): MediaErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to console in development or if debug is enabled
    if (process.env.NODE_ENV === 'development' || this.props.debug) {
      console.error(`[MediaErrorBoundary] Error caught:`, error, errorInfo);
    }
    
    // Capture the error info for display
    this.setState({
      errorInfo
    });
    
    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: MediaErrorBoundaryProps): void {
    // Reset error state if resetKey changes
    if (
      this.state.hasError && 
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null
      });
    }
  }

  /**
   * Renders a custom error UI based on the current context
   */
  renderErrorFallback(): ReactNode {
    const { error, errorInfo } = this.state;
    const { fallback, mediaType, mediaUrl, isCompactView } = this.props;
    
    // If custom fallback is provided, use it
    if (fallback) {
      return fallback;
    }
    
    // Default error message
    const errorMessage = error?.message || 'An error occurred while loading media';
    const errorDetails = errorInfo?.componentStack || '';
    const mediaTypeLabel = mediaType ? mediaType.charAt(0).toUpperCase() + mediaType.slice(1) : 'Media';
    
    return (
      <div 
        className={`flex flex-col items-center justify-center bg-gray-900 w-full h-full text-white overflow-hidden p-2 ${isCompactView ? 'text-xs' : 'text-sm'}`}
        data-testid="media-error-fallback"
      >
        <ExclamationTriangleIcon className={`${isCompactView ? 'w-5 h-5' : 'w-8 h-8'} text-amber-500 mb-2`} />
        <div className="font-medium text-center">
          {mediaTypeLabel} Loading Error
        </div>
        <div className="text-red-400 text-center text-opacity-80 truncate max-w-full">
          {errorMessage}
        </div>
        
        {mediaUrl && (
          <div className={`mt-1 text-gray-400 text-center ${isCompactView ? 'text-[10px]' : 'text-xs'} truncate max-w-full`}>
            URL: {mediaUrl.substring(0, isCompactView ? 30 : 50)}
            {mediaUrl.length > (isCompactView ? 30 : 50) ? '...' : ''}
          </div>
        )}
        
        {process.env.NODE_ENV === 'development' && !isCompactView && (
          <details className="mt-2 text-gray-400 text-[10px] max-w-full overflow-hidden">
            <summary className="cursor-pointer">Stack trace</summary>
            <pre className="mt-1 whitespace-pre-wrap text-left max-h-32 overflow-y-auto">
              {errorDetails}
            </pre>
          </details>
        )}
        
        <button
          className="mt-2 px-2 py-1 bg-blue-600 text-white rounded-md text-xs hover:bg-blue-700"
          onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
        >
          Try Again
        </button>
      </div>
    );
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

export default MediaErrorBoundary; 