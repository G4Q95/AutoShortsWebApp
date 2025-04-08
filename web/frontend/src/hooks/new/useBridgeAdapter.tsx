import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { VideoContext } from '@/contexts/VideoContext';

interface UseBridgeAdapterProps {
  // DOM Refs - Allow potential null references which is how React.useRef works
  canvasRef: RefObject<HTMLCanvasElement | null> | RefObject<HTMLCanvasElement>;
  videoRef: RefObject<HTMLVideoElement | null> | RefObject<HTMLVideoElement>;
  
  // Media Info (read-only)
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  
  // Visual State (read-only)
  showFirstFrame: boolean;
  
  // Callbacks (for state changes)
  onIsReadyChange?: (isReady: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (time: number) => void;
}

interface UseBridgeAdapterReturn {
  // Actions (methods only, no state)
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // Status info (derived from internal implementation)
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

export function useBridgeAdapter({
  canvasRef,
  videoRef,
  mediaUrl,
  localMediaUrl,
  mediaType,
  showFirstFrame,
  onIsReadyChange,
  onDurationChange,
  onError,
  onTimeUpdate
}: UseBridgeAdapterProps): UseBridgeAdapterReturn {
  // Internal state
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Keep reference to the bridge instance
  const bridgeRef = useRef<VideoContext | null>(null);

  // Initialize bridge instance
  useEffect(() => {
    const initBridge = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage(null);

        // Create new bridge instance
        const bridge = new VideoContext();
        
        // Set the video and canvas elements
        if (videoRef.current) {
          bridge.setVideo(videoRef.current);
        } else {
          throw new Error('Video element not available');
        }
        
        if (canvasRef.current) {
          bridge.setCanvas(canvasRef.current);
        }

        // Store bridge instance
        bridgeRef.current = bridge;

        // Wait for bridge to be ready
        await bridge.initialize(mediaUrl, localMediaUrl);
        
        // Notify ready state change
        onIsReadyChange?.(true);
        
        // Get and notify duration
        const duration = bridge.getDuration();
        if (duration) {
          onDurationChange?.(duration);
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[Bridge Init Error]:', err);
        setHasError(true);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during bridge initialization';
        setErrorMessage(errorMsg);
        onError?.(err instanceof Error ? err : new Error('Bridge initialization failed'));
        setIsLoading(false);
      }
    };

    initBridge();

    // Cleanup
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
      }
    };
  }, [canvasRef, videoRef, mediaUrl, localMediaUrl, onIsReadyChange, onDurationChange, onError]);

  // Bridge actions
  const play = useCallback(async () => {
    if (showFirstFrame) {
      console.warn('[Bridge] Cannot play - canvas is hidden! Check component state.');
      return Promise.reject(new Error('Canvas not visible'));
    }

    if (!bridgeRef.current) {
      console.error('[Bridge] No bridge instance available');
      return Promise.reject(new Error('Bridge not initialized'));
    }

    try {
      await bridgeRef.current.play();
      return Promise.resolve();
    } catch (err) {
      console.error('[Bridge Play Error]:', err);
      const error = err instanceof Error ? err : new Error('Play failed');
      onError?.(error);
      return Promise.reject(error);
    }
  }, [showFirstFrame, onError]);

  const pause = useCallback(async () => {
    if (!bridgeRef.current) {
      console.error('[Bridge] No bridge instance available');
      return Promise.reject(new Error('Bridge not initialized'));
    }

    try {
      await bridgeRef.current.pause();
      return Promise.resolve();
    } catch (err) {
      console.error('[Bridge Pause Error]:', err);
      const error = err instanceof Error ? err : new Error('Pause failed');
      onError?.(error);
      return Promise.reject(error);
    }
  }, [onError]);

  const seek = useCallback(async (time: number) => {
    if (!bridgeRef.current) {
      console.error('[Bridge] No bridge instance available');
      return Promise.reject(new Error('Bridge not initialized'));
    }

    try {
      await bridgeRef.current.seek(time);
      return Promise.resolve();
    } catch (err) {
      console.error('[Bridge Seek Error]:', err);
      const error = err instanceof Error ? err : new Error('Seek failed');
      onError?.(error);
      return Promise.reject(error);
    }
  }, [onError]);

  // Time update effect
  useEffect(() => {
    if (!bridgeRef.current || !onTimeUpdate) return;

    const handleTimeUpdate = () => {
      const currentTime = bridgeRef.current?.getCurrentTime() || 0;
      onTimeUpdate(currentTime);
    };

    // Set up time update interval
    const intervalId = setInterval(handleTimeUpdate, 1000 / 30); // 30fps updates

    return () => {
      clearInterval(intervalId);
    };
  }, [onTimeUpdate]);

  return {
    play,
    pause,
    seek,
    isLoading,
    hasError,
    errorMessage
  };
} 