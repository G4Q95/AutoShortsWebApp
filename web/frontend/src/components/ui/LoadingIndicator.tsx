import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullscreen?: boolean;
  transparent?: boolean;
  className?: string;
  inline?: boolean;
}

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
  
  return spinner;
}

// For convenience, also export specialized loading components
export function ButtonLoader({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin h-4 w-4 ${className}`} />;
}

export function InlineLoader({ message, className = '' }: { message?: string; className?: string }) {
  return (
    <div className={`inline-flex items-center text-gray-500 ${className}`}>
      <Loader2 className="animate-spin h-3 w-3 mr-2" />
      {message && <span className="text-xs">{message}</span>}
    </div>
  );
}

export function ContentLoader({ height = 'h-32' }: { height?: string }) {
  return (
    <div className={`w-full ${height} flex items-center justify-center border border-gray-200 rounded-md bg-gray-50`}>
      <LoadingIndicator message="Loading content..." />
    </div>
  );
}

export function PageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="w-full h-[calc(100vh-4rem)] flex items-center justify-center">
      <LoadingIndicator size="large" message={message} />
    </div>
  );
} 