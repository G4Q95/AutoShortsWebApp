/**
 * VideoContextPreview.tsx
 * 
 * Part of the VideoContext integration (Phase 2)
 * 
 * A component that displays the VideoContext canvas output with playback controls.
 * This is specifically for the VideoContext implementation and should not be confused
 * with the original ScenePreviewPlayer component.
 */

import React, { useRef, useEffect, useState } from 'react';
import { useVideoContext } from '../../contexts/VideoContextProvider';

interface VideoContextPreviewProps {
  width?: number;
  height?: number;
  showControls?: boolean;
  aspectRatio?: 'portrait' | 'landscape' | 'square';
  className?: string;
}

const VideoContextPreview: React.FC<VideoContextPreviewProps> = ({
  width = 320,
  height = 568, // Default to portrait 9:16 ratio for shorts
  showControls = true,
  aspectRatio = 'portrait',
  className = '',
}) => {
  const { state, actions } = useVideoContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width, height });
  
  // Calculate dimensions based on aspect ratio
  useEffect(() => {
    let calculatedWidth = width;
    let calculatedHeight = height;
    
    if (aspectRatio === 'portrait') {
      // 9:16 ratio (vertical video)
      calculatedHeight = calculatedWidth * (16/9);
    } else if (aspectRatio === 'landscape') {
      // 16:9 ratio (horizontal video)
      calculatedHeight = calculatedWidth * (9/16);
    } else if (aspectRatio === 'square') {
      // 1:1 ratio
      calculatedHeight = calculatedWidth;
    }
    
    setDimensions({
      width: calculatedWidth,
      height: calculatedHeight
    });
  }, [width, aspectRatio]);
  
  // Set up canvas for VideoContext output
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.manager) return;
    
    // Set canvas dimensions
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    // Create a copy of the hidden canvas to this visible canvas
    const renderFrame = () => {
      if (!state.manager || !state.isReady) return requestAnimationFrame(renderFrame);
      
      try {
        const hiddenCanvas = state.manager.videoContext.canvas;
        const ctx = canvas.getContext('2d');
        
        if (ctx && hiddenCanvas && hiddenCanvas instanceof HTMLCanvasElement) {
          // Draw the VideoContext output to our visible canvas
          ctx.drawImage(
            hiddenCanvas, 
            0, 0, hiddenCanvas.width, hiddenCanvas.height, 
            0, 0, canvas.width, canvas.height
          );
        }
      } catch (error) {
        console.error('Error rendering frame:', error);
      }
      
      // Continue the render loop
      requestAnimationFrame(renderFrame);
    };
    
    // Start the render loop
    const animationFrame = requestAnimationFrame(renderFrame);
    
    // Clean up on unmount
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [state.manager, dimensions, state.isReady]);
  
  // Format time display (MM:SS)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle play/pause toggle
  const togglePlayPause = () => {
    if (state.isPlaying) {
      actions.pause();
    } else {
      actions.play();
    }
  };
  
  // Handle seeking in the timeline
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    actions.seek(seekTime);
  };
  
  return (
    <div className={`videocontext-preview ${className}`}>
      <div className="video-container relative overflow-hidden rounded-lg bg-black">
        <canvas 
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="video-canvas w-full h-auto"
          data-testid="videocontext-preview-canvas"
        />
        
        {/* Loading indicator */}
        {!state.isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="text-white">Loading...</div>
          </div>
        )}
      </div>
      
      {/* Playback controls */}
      {showControls && state.isReady && (
        <div className="video-controls mt-2">
          <div className="flex items-center justify-between mb-1">
            <button 
              onClick={togglePlayPause}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1 rounded-md"
              data-testid="videocontext-play-pause-button"
            >
              {state.isPlaying ? 'Pause' : 'Play'}
            </button>
            
            <div className="time-display text-sm text-gray-700">
              {formatTime(state.currentTime)} / {formatTime(state.duration)}
            </div>
          </div>
          
          {/* Timeline scrubber */}
          <input
            type="range"
            min="0"
            max={state.duration || 1}
            step="0.1"
            value={state.currentTime}
            onChange={handleSeek}
            className="w-full"
            data-testid="videocontext-timeline-scrubber"
          />
        </div>
      )}
    </div>
  );
};

export default VideoContextPreview; 