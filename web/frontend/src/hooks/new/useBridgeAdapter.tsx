import React, { useEffect, useRef, MutableRefObject, useState, useCallback, RefObject } from 'react';
import { VideoContext, VideoContextValue } from './VideoContext';

interface UseBridgeAdapterProps {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  videoSrc: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (time: number) => void;
  startWithFirstFrame?: boolean;
}

export function useBridgeAdapter({
  videoRef,
  canvasRef,
  videoSrc,
  onReady,
  onError: externalOnError,
  onTimeUpdate,
  startWithFirstFrame = true,
}: UseBridgeAdapterProps): VideoContextValue {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showFirstFrame, setShowFirstFrame] = useState(startWithFirstFrame);
  const [error, setError] = useState<Error | null>(null);

  // Handle errors both internally and pass to external handler if provided
  const handleError = (err: Error) => {
    setError(err);
    if (externalOnError) {
      externalOnError(err);
    }
    console.error('Video error:', err);
  };

  // Function to draw the current frame to canvas
  const drawFrameToCanvas = () => {
    const videoElement = videoRef.current;
    
    if (!videoElement) {
      console.log('Missing video element for drawing frame');
      return false;
    }
    
    // Early return if canvas is not available
    if (!canvasRef?.current) {
      console.log('No canvas element available for drawing frame');
      return false;
    }

    try {
      const context = canvasRef.current.getContext('2d');
      if (!context) {
        console.error('Could not get 2D context from canvas');
        return false;
      }

      // Set canvas dimensions to match video
      canvasRef.current.width = videoElement.videoWidth;
      canvasRef.current.height = videoElement.videoHeight;
      
      // Draw the video frame
      context.drawImage(videoElement, 0, 0, canvasRef.current.width, canvasRef.current.height);
      return true;
    } catch (err) {
      console.error('Error drawing frame to canvas:', err);
      return false;
    }
  };

  // Function to ensure canvas size matches video dimensions
  const syncCanvasSize = () => {
    const videoElement = videoRef.current;
    // Early return if video or canvas is not available
    if (!videoElement || !canvasRef?.current) return;
    
    if (
      canvasRef.current.width !== videoElement.videoWidth ||
      canvasRef.current.height !== videoElement.videoHeight
    ) {
      canvasRef.current.width = videoElement.videoWidth;
      canvasRef.current.height = videoElement.videoHeight;
    }
  };
  
  // Handle resize events
  const handleResize = () => {
    if (videoRef.current && canvasRef?.current) {
      syncCanvasSize();
      if (showFirstFrame) {
        drawFrameToCanvas();
      }
    }
  };

  // Handle metadata loaded
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleLoadedMetadata = () => {
      console.log('Metadata loaded for video');
      setDuration(videoElement.duration);
      
      // Sync canvas size once we have video dimensions
      if (canvasRef?.current) {
        syncCanvasSize();
      }
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [videoRef, canvasRef]);

  // Handle time updates
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleTimeUpdate = () => {
      setCurrentTime(videoElement.currentTime);
      
      if (onTimeUpdate) {
        onTimeUpdate(videoElement.currentTime);
      }
    };

    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [videoRef, onTimeUpdate]);

  // Toggle visibility based on showFirstFrame
  useEffect(() => {
    if (!videoRef.current) return;
    
    // Make the video invisible if showing first frame
    if (showFirstFrame) {
      videoRef.current.style.display = 'none';
      if (canvasRef?.current) {
        canvasRef.current.style.display = 'block';
      }
    } else {
      videoRef.current.style.display = 'block';
      if (canvasRef?.current) {
        canvasRef.current.style.display = 'none';
      }
    }
  }, [showFirstFrame, videoRef, canvasRef]);

  // Draw the first frame to canvas once video is ready
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement || !canvasRef?.current) return;

    // Function to check if video is ready to draw
    const checkReadyToDraw = () => {
      // Video must have dimensions and at least some data loaded
      if (
        showFirstFrame && 
        videoElement.readyState >= 2 && 
        videoElement.videoWidth > 0 && 
        videoElement.videoHeight > 0
      ) {
        drawFrameToCanvas();
      }
    };

    // Try to draw immediately if already loaded
    checkReadyToDraw();

    // Listen for ready state changes
    const handleCanPlay = () => {
      console.log('Video can play');
      setIsReady(true);
      checkReadyToDraw();
      if (onReady) onReady();
    };

    videoElement.addEventListener('canplay', handleCanPlay);
    
    return () => {
      videoElement.removeEventListener('canplay', handleCanPlay);
    };
  }, [videoRef, canvasRef, showFirstFrame, onReady]);

  // Set up video src and error handling
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    // Handle errors
    const onVideoError = () => {
      handleError(new Error('Video loading failed'));
    };

    // Add error listener
    videoElement.addEventListener('error', onVideoError);
    
    // Set video source if changed
    if (videoElement.src !== videoSrc) {
      console.log('Setting video source:', videoSrc);
      videoElement.src = videoSrc;
      setIsReady(false);
    }

    return () => {
      videoElement.removeEventListener('error', onVideoError);
    };
  }, [videoRef, videoSrc]);

  // Handle window resize
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [videoRef, canvasRef, showFirstFrame]);

  // Video control functions
  const play = async (): Promise<void> => {
    console.log('Play requested');
    try {
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error('No video element available');
      }

      // If showing first frame, hide it and show video
      if (showFirstFrame) {
        setShowFirstFrame(false);
      }

      await videoElement.play();
      setIsPlaying(true);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error playing video');
      handleError(error);
      throw error;
    }
  };

  const pause = async (): Promise<void> => {
    console.log('Pause requested');
    try {
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error('No video element available');
      }

      videoElement.pause();
      setIsPlaying(false);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error pausing video');
      handleError(error);
      throw error;
    }
  };

  const seek = async (time: number): Promise<void> => {
    console.log('Seek requested to', time);
    try {
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error('No video element available');
      }

      // Update video time
      videoElement.currentTime = time;
      setCurrentTime(time);

      // If showing first frame and video is ready, draw it to canvas
      if (showFirstFrame && videoElement.readyState >= 2 && canvasRef?.current) {
        drawFrameToCanvas();
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error seeking video');
      handleError(error);
      throw error;
    }
  };

  const toggleFirstFrame = () => {
    if (!showFirstFrame && canvasRef?.current) {
      drawFrameToCanvas();
    }
    setShowFirstFrame(!showFirstFrame);
  };

  // Return the VideoContext interface
  return {
    isPlaying,
    currentTime,
    duration,
    isReady,
    error,
    actions: {
      play,
      pause,
      seek,
      setError,
    },
  };
} 