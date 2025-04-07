import React, { CSSProperties } from 'react';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

interface ImageElementProps {
  // Media properties
  mediaUrl: string;
  
  // Media state
  isLoading: boolean;
  isPlaying: boolean;
  isCompactView: boolean;
  imageLoadError: boolean;
  
  // Refs
  imgRef: React.RefObject<HTMLImageElement>;
  
  // Styling
  mediaElementStyle: CSSProperties;
  
  // Callbacks
  onImageLoad: () => void;
  onImageError: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  
  // Testing
  sceneId: string;
}

/**
 * ImageElement - A specialized component for rendering image media in the scene preview
 * 
 * Handles the image element, loading states, error states, and play/pause indicators.
 */
export function ImageElement({
  mediaUrl,
  isLoading,
  isPlaying,
  isCompactView,
  imageLoadError,
  imgRef,
  mediaElementStyle,
  onImageLoad,
  onImageError,
  sceneId
}: ImageElementProps) {
  
  return (
    <>
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      
      {/* Image element */}
      <img
        ref={imgRef}
        src={mediaUrl} 
        alt="Scene content"
        className="w-auto h-auto max-w-full max-h-full"
        style={{
          ...mediaElementStyle,
          objectFit: 'contain',
          zIndex: 10,
          maxHeight: isCompactView ? '190px' : mediaElementStyle.maxHeight,
          pointerEvents: 'none' // Ensure all clicks pass through
        }}
        data-testid="fallback-image"
        onLoad={onImageLoad}
        onError={onImageError}
      />
      
      {/* Error display if image loading fails */}
      {imageLoadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white text-sm">
          <div className="text-center p-4">
            <div>Failed to load image</div>
            <div className="text-xs mt-1">Please check the image URL</div>
          </div>
        </div>
      )}
      
      {/* Show play/pause indicator in the center when playing or paused */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isPlaying ? (
          <PauseIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
        ) : (
          <PlayIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
        )}
      </div>
    </>
  );
}

export default ImageElement; 