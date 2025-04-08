import { useCallback, useEffect, useRef, useState, RefObject } from 'react';
import { VideoContext } from '@/contexts/VideoContext';

// Custom error class for bridge-related errors
export class BridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeError';
  }
}

export interface UseVideoContextBridgeProps {
  // DOM Refs (read-only)
  canvasRef: RefObject<HTMLCanvasElement>;
  videoRef: RefObject<HTMLVideoElement>;
  
  // Media Info (read-only)
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  
  // Visual State (read-only)
  showFirstFrame: boolean;
  
  // Callbacks (for state changes)
  onIsReadyChange: (isReady: boolean) => void;
  onDurationChange: (duration: number) => void;
  onError: (error: Error) => void;
  onTimeUpdate: (time: number) => void;
}

export interface UseVideoContextBridgeReturn {
  // Actions (methods only, no state)
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // Status info (derived from internal implementation)
  isInitializing: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

export function useVideoContextBridge({
  canvasRef,
  videoRef,
  mediaUrl,
  localMediaUrl,
  mediaType,
  showFirstFrame,
  onIsReadyChange,
  onDurationChange,
  onError,
  onTimeUpdate,
}: UseVideoContextBridgeProps): UseVideoContextBridgeReturn {
  // Internal state
  const [isInitializing, setIsInitializing] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Refs
  const contextRef = useRef<VideoContext | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  // Initialize VideoContext when dependencies change
  useEffect(() => {
    const initializeContext = async () => {
      setIsInitializing(true);
      setHasError(false);
      setErrorMessage(null);

      try {
        // Clear existing context
        if (contextRef.current) {
          contextRef.current.destroy();
          contextRef.current = null;
        }

        // Ensure we have required refs
        if (!videoRef.current || !canvasRef.current) {
          throw new BridgeError('Video or canvas element not available');
        }

        // Create new context
        const context = new VideoContext();
        context.setVideo(videoRef.current);
        context.setCanvas(canvasRef.current);
        
        // Initialize with media
        await context.initialize(mediaUrl, localMediaUrl);
        
        // Store context
        contextRef.current = context;
        
        // Set up time update interval
        if (timeUpdateIntervalRef.current) {
          window.clearInterval(timeUpdateIntervalRef.current);
        }
        
        timeUpdateIntervalRef.current = window.setInterval(() => {
          if (contextRef.current) {
            onTimeUpdate(contextRef.current.getCurrentTime());
            onDurationChange(contextRef.current.getDuration());
            onIsReadyChange(true);
          }
        }, 100) as unknown as number;

        setIsInitializing(false);
        onIsReadyChange(true);
        
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to initialize VideoContext');
        setHasError(true);
        setErrorMessage(error.message);
        onError(error);
        setIsInitializing(false);
      }
    };

    initializeContext();

    // Cleanup
    return () => {
      if (timeUpdateIntervalRef.current) {
        window.clearInterval(timeUpdateIntervalRef.current);
      }
      if (contextRef.current) {
        contextRef.current.destroy();
        contextRef.current = null;
      }
    };
  }, [mediaUrl, localMediaUrl, videoRef, canvasRef, onIsReadyChange, onDurationChange, onTimeUpdate, onError]);

  // Play control
  const play = useCallback(async () => {
    if (showFirstFrame) {
      throw new BridgeError('Cannot play while showing first frame');
    }
    
    if (!contextRef.current) {
      throw new BridgeError('VideoContext not initialized');
    }

    try {
      await contextRef.current.play();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to play video');
      onError(error);
      throw error;
    }
  }, [showFirstFrame, onError]);

  // Pause control
  const pause = useCallback(async () => {
    if (!contextRef.current) {
      throw new BridgeError('VideoContext not initialized');
    }

    try {
      await contextRef.current.pause();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to pause video');
      onError(error);
      throw error;
    }
  }, [onError]);

  // Seek control
  const seek = useCallback(async (time: number) => {
    if (!contextRef.current) {
      throw new BridgeError('VideoContext not initialized');
    }

    try {
      await contextRef.current.seek(time);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to seek video');
      onError(error);
      throw error;
    }
  }, [onError]);

  return {
    play,
    pause,
    seek,
    isInitializing,
    hasError,
    errorMessage,
  };
}