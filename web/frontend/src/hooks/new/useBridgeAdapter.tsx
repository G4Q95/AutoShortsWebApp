import React, { useEffect, useRef, MutableRefObject, useState, useCallback, RefObject } from 'react';
import { VideoContext, VideoContextValue } from './VideoContext';

interface UseBridgeAdapterProps {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  videoSrc?: string;
  mediaUrl?: string;
  localMediaUrl?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (time: number) => void;
  startWithFirstFrame?: boolean;
}

export function useBridgeAdapter({
  videoRef,
  canvasRef,
  videoSrc: externalVideoSrc,
  mediaUrl,
  localMediaUrl,
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

  // Determine the video source - prioritize external provided source, then local, then remote
  const videoSrc = externalVideoSrc || localMediaUrl || mediaUrl || '';

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

      // Make sure canvas dimensions match video
      syncCanvasSize();
      
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
    const canvasElement = canvasRef?.current;
    
    if (!videoElement || !canvasElement) return;
    
    if (videoElement.videoWidth && videoElement.videoHeight) {
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;
      return true;
    }
    
    return false;
  };
  
  // Handle resize events
  const handleResize = () => {
    if (videoRef.current && canvasRef?.current && showFirstFrame) {
      syncCanvasSize();
      drawFrameToCanvas();
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

  // First frame visibility handling effect
  useEffect(() => {
    const videoElement = videoRef.current;
    const canvasElement = canvasRef?.current;
    
    if (!videoElement || !canvasElement) return;
    
    if (showFirstFrame) {
      // When showing first frame: show canvas, hide video
      canvasElement.style.display = 'block';
      videoElement.style.visibility = 'hidden';
      
      // Draw frame if video is ready
      if (videoElement.readyState >= 2) {
        drawFrameToCanvas();
      }
    } else {
      // When showing video: hide canvas, show video
      canvasElement.style.display = 'none';
      videoElement.style.visibility = 'visible';
    }
  }, [videoRef, canvasRef, showFirstFrame, drawFrameToCanvas]);

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
    if (videoElement.src !== videoSrc && videoSrc) {
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
    const canvasElement = canvasRef?.current;
    if (!showFirstFrame && canvasElement) {
      if (drawFrameToCanvas()) {
        setShowFirstFrame(true);
      }
    } else {
      setShowFirstFrame(false);
    }
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