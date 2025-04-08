import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { VideoContext } from '../contexts/VideoContext';

/**
 * Props for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeProps {
  // Original props from the old implementation
  videoContextInstance?: any; // For backward compatibility
  initialMediaAspectRatio?: number; // For backward compatibility
  
  // DOM Refs - Allow potential null references which is how React.useRef works
  canvasRef: RefObject<HTMLCanvasElement | null> | RefObject<HTMLCanvasElement>;
  videoRef?: RefObject<HTMLVideoElement | null> | RefObject<HTMLVideoElement>;
  
  // Media Info (read-only)
  mediaUrl?: string;
  localMediaUrl?: string | null;
  mediaType?: string;
  
  // Visual State (read-only)
  showFirstFrame?: boolean;
  
  // Callbacks (for state changes)
  onReady?: () => void; // For backward compatibility
  onIsReadyChange?: (isReady: boolean) => void;
  onDurationChange?: (duration: number) => void;
  onError?: (error: Error) => void;
  onTimeUpdate?: (time: number) => void;
}

/**
 * Return type for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeReturn {
  // Video context instance and basic state
  videoContext: VideoContext | null;
  isReady: boolean;
  duration: number;
  
  // Core playback methods
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // Legacy methods for backward compatibility
  createVideoSourceNode: (ctx: any) => any | null;
  prepareVideoContext: (baseSize?: number) => Promise<any | null>;
  activeSource: any | null;
  
  // Status info
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * useVideoContextBridge - Hook to abstract VideoContext interactions
 * Enhanced with backward compatibility for the old implementation
 */
export function useVideoContextBridge({
  videoContextInstance,
  videoRef,
  canvasRef,
  mediaUrl,
  localMediaUrl,
  mediaType,
  initialMediaAspectRatio,
  showFirstFrame = false,
  onReady,
  onIsReadyChange,
  onDurationChange,
  onError,
  onTimeUpdate
}: UseVideoContextBridgeProps): UseVideoContextBridgeReturn {
  // Internal state
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<any | null>(null);
  
  // Keep reference to the bridge instance
  const bridgeRef = useRef<VideoContext | null>(null);

  // Initialize bridge instance
  useEffect(() => {
    // Skip if we don't have all required dependencies
    if (!canvasRef.current || !mediaUrl) {
      return;
    }
    
    const initBridge = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage(null);
        setIsReady(false);

        // Create new bridge instance
        const bridge = new VideoContext();
        
        // Set the video and canvas elements
        if (videoRef?.current) {
          bridge.setVideo(videoRef.current);
        }
        
        if (canvasRef.current) {
          bridge.setCanvas(canvasRef.current);
        }

        // Store bridge instance
        bridgeRef.current = bridge;

        // Only initialize if we have a mediaUrl
        if (mediaUrl) {
          // Wait for bridge to be ready
          await bridge.initialize(mediaUrl, localMediaUrl);
          
          // Notify ready state change
          setIsReady(true);
          onIsReadyChange?.(true);
          onReady?.(); // For backward compatibility
          
          // Get and notify duration
          const durationValue = bridge.getDuration();
          if (durationValue) {
            setDuration(durationValue);
            onDurationChange?.(durationValue);
          }
        }

        setIsLoading(false);
      } catch (err) {
        console.error('[Bridge Init Error]:', err);
        setHasError(true);
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during bridge initialization';
        setErrorMessage(errorMsg);
        setIsReady(false);
        onError?.(err instanceof Error ? err : new Error('Bridge initialization failed'));
        setIsLoading(false);
      }
    };

    // Only initialize if we have the necessary elements
    if (canvasRef.current) {
      initBridge();
    }

    // Cleanup
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
      }
    };
  }, [canvasRef, videoRef, mediaUrl, localMediaUrl, onIsReadyChange, onDurationChange, onError, onReady]);

  // Bridge actions
  const play = useCallback(async () => {
    if (showFirstFrame) {
      console.warn('[Bridge] Cannot play - showFirstFrame is true. Canvas may be hidden or in snapshot mode.');
      return Promise.reject(new Error('Canvas not visible or in snapshot mode'));
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

  // Legacy methods for backward compatibility
  const createVideoSourceNode = useCallback((ctx: any) => {
    console.log('[Bridge] Using createVideoSourceNode - legacy compatibility mode');
    // Return a dummy source that won't break the existing code
    setActiveSource({ connect: () => {}, start: () => {}, stop: () => {} });
    return { connect: () => {}, start: () => {}, stop: () => {} };
  }, []);

  const prepareVideoContext = useCallback(async (baseSize: number = 1920): Promise<any | null> => {
    console.log('[Bridge] Using prepareVideoContext - legacy compatibility mode');
    return null;
  }, []);

  return {
    videoContext: bridgeRef.current,
    isReady,
    duration,
    play,
    pause,
    seek,
    isLoading,
    hasError,
    errorMessage,
    // Legacy methods
    createVideoSourceNode,
    prepareVideoContext,
    activeSource
  };
} 