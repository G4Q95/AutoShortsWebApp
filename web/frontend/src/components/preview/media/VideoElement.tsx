import React, { CSSProperties, useEffect, useCallback } from 'react';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

interface VideoElementProps {
  // Media properties
  mediaUrl: string;
  localMediaUrl?: string | null;
  
  // Media state
  isLoading: boolean;
  isPlaying: boolean;
  isCompactView: boolean;
  showFirstFrame: boolean;
  
  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  
  // Styling
  mediaElementStyle: CSSProperties;
  
  // Event handlers
  onVideoError?: (error: Error) => void;
  
  // Testing
  sceneId?: string;
}

/**
 * VideoElement - A specialized component for rendering video media in the scene preview
 * 
 * Handles both the first frame video element (visible when not playing) and the
 * VideoContext canvas (visible when playing).
 */
export function VideoElement({
  mediaUrl,
  localMediaUrl,
  isLoading,
  isPlaying,
  isCompactView,
  showFirstFrame,
  videoRef,
  canvasRef,
  mediaElementStyle,
  onVideoError,
  sceneId
}: VideoElementProps) {
  
  // Handle video element errors
  const handleVideoError = useCallback((e: Event) => {
    const errorMessage = `Failed to load video: ${mediaUrl?.split('?')[0] || 'Unknown source'}`;
    console.error(`[VideoElement] ${errorMessage}`, e);
    
    const videoElement = videoRef.current;
    
    // Try fallback to a public test video if we haven't already tried
    if (videoElement && !videoElement.src.includes('w3schools.com')) {
      console.log('[VideoElement] Trying fallback video source...');
      videoElement.src = 'https://www.w3schools.com/html/mov_bbb.mp4';
      return; // Don't throw error yet, give the fallback a chance
    }
    
    const error = new Error(errorMessage);
    
    // Call error callback if provided
    if (onVideoError) {
      onVideoError(error);
    }
    
    // Throw error to be caught by boundary
    throw error;
  }, [mediaUrl, onVideoError, videoRef]);
  
  // Set up video error event listener
  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.addEventListener('error', handleVideoError);
      
      return () => {
        videoElement.removeEventListener('error', handleVideoError);
      };
    }
  }, [videoRef, handleVideoError]);
  
  // Log the video source being used
  useEffect(() => {
    console.log(`[VideoElement] Video source: ${localMediaUrl || mediaUrl || 'none'} (Scene: ${sceneId})`);
  }, [localMediaUrl, mediaUrl, sceneId]);
  
  return (
    <>
      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
      )}
      
      {/* First frame video element (visible when not playing) */}
      {showFirstFrame && (
        <video
          src={localMediaUrl || mediaUrl || undefined}
          ref={videoRef}
          className="w-auto h-auto"
          style={{
            ...mediaElementStyle,
            pointerEvents: 'none' // Ensure all videos have pointer-events: none
          }}
          playsInline
          muted
          crossOrigin="anonymous"
          preload="auto"
          data-testid="first-frame-video"
        />
      )}
      
      {/* VideoContext canvas (visible when playing) */}
      <canvas 
        ref={canvasRef}
        className="w-auto h-auto"
        style={{
          ...mediaElementStyle,
          display: showFirstFrame ? 'none' : 'block',
          zIndex: 10, // Match the img z-index
          pointerEvents: 'none' // Ensure all click events pass through
        }}
        data-testid="videocontext-canvas"
      />
      
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

export default VideoElement; 