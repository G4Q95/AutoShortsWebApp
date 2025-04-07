import React, { CSSProperties } from 'react';
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
  sceneId
}: VideoElementProps) {
  
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