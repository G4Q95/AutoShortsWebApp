import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Props for the LoadingIndicator component
 */
interface LoadingIndicatorProps {
  /** Size of the loading indicator - 'small', 'medium', or 'large' */
  size?: 'small' | 'medium' | 'large';
  /** Optional message to display below the loading spinner */
  message?: string;
  /** Whether to display the loading indicator in fullscreen mode */
  fullscreen?: boolean;
  /** Whether to use a transparent background */
  transparent?: boolean;
  /** Additional CSS classes to apply to the component */
  className?: string;
  /** Whether to display the loading indicator inline with other content */
  inline?: boolean;
}

/**
 * A versatile loading indicator component that displays a spinning animation with optional message.
 * 
 * Features:
 * - Multiple size options (small, medium, large)
 * - Optional loading message
 * - Fullscreen mode for loading overlays
 * - Transparent background option
 * - Inline display mode
 * 
 * @component
 * @example
 * ```tsx
 * // Basic usage
 * <LoadingIndicator />
 * 
 * // With message and custom size
 * <LoadingIndicator 
 *   size="large"
 *   message="Loading your content..."
 * />
 * 
 * // Fullscreen overlay
 * <LoadingIndicator 
 *   fullscreen
 *   message="Processing video..."
 * />
 * ```
 */
export default function LoadingIndicator({
  size = 'medium',
  message,
  fullscreen = false,
  transparent = false,
  className = '',
  inline = false,
}: LoadingIndicatorProps) {
  // Determine icon size based on requested size
  const iconSizeMap = {
    small: 16,
    medium: 24,
    large: 36,
  };
  
  const iconSize = iconSizeMap[size];
  
  // Determine text size based on requested size
  const textSizeMap = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };
  
  const textSize = textSizeMap[size];
  
  // Create spinner with optional message
  const spinner = (
    <div className={`flex ${inline ? 'inline-flex' : 'flex-col'} items-center justify-center ${className}`}>
      <Loader2 className={`animate-spin ${inline ? 'mr-2' : 'mb-2'}`} size={iconSize} />
      {message && <p className={`${textSize} text-gray-600`}>{message}</p>}
    </div>
  );
  
  // If fullscreen, center in viewport
  if (fullscreen) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center ${transparent ? 'bg-transparent' : 'bg-white/80 backdrop-blur-sm'} z-50`}>
        {spinner}
      </div>
    );
  }
  
  return (
    <div
      className={`flex items-center justify-center gap-2 ${
        fullscreen ? 'fixed inset-0 bg-white bg-opacity-80 z-50' : ''
      } ${className}`}
      data-testid="loading-indicator"
    >
      {/* Simple spinner */}
      <div className="flex flex-col items-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    </div>
  );
}

/**
 * A simplified loading indicator for use within buttons
 * 
 * @component
 * @example
 * ```tsx
 * <button disabled={isLoading}>
 *   {isLoading ? <ButtonLoader /> : 'Submit'}
 * </button>
 * ```
 */
export function ButtonLoader({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin h-4 w-4 ${className}`} />;
}

/**
 * A loading indicator that displays inline with text
 * 
 * @component
 * @example
 * ```tsx
 * <div>
 *   <InlineLoader message="Fetching data..." />
 * </div>
 * ```
 */
export function InlineLoader({ message, className = '' }: { message?: string; className?: string }) {
  return (
    <div className={`inline-flex items-center text-gray-500 ${className}`}>
      <Loader2 className="animate-spin h-3 w-3 mr-2" />
      {message && <span className="text-xs">{message}</span>}
    </div>
  );
}

/**
 * A loading indicator for content areas with a skeleton loading effect
 * 
 * @component
 * @example
 * ```tsx
 * <div className="card">
 *   {isLoading ? (
 *     <ContentLoader height="h-48" />
 *   ) : (
 *     <Content />
 *   )}
 * </div>
 * ```
 */
export function ContentLoader({ height = 'h-32' }: { height?: string }) {
  return (
    <div className={`w-full ${height} flex items-center justify-center border border-gray-200 rounded-md bg-gray-50`}>
      <LoadingIndicator message="Loading content..." />
    </div>
  );
}

/**
 * A full-page loading indicator with centered message
 * 
 * @component
 * @example
 * ```tsx
 * {isLoading && <PageLoader message="Loading application..." />}
 * ```
 */
export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center">
      <LoadingIndicator size="large" message={message} />
    </div>
  );
} 