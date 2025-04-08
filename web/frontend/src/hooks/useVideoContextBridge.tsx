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
  // Avoid excessive logging on every render
  const isInitialRender = useRef(true);
  if (isInitialRender.current) {
    console.log('[VideoContextBridge] Initializing with:', { 
      mediaUrl, 
      localMediaUrl, 
      mediaType, 
      showFirstFrame,
      hasVideoRef: !!videoRef?.current,
      hasCanvasRef: !!canvasRef?.current
    });
    isInitialRender.current = false;
  }

  // Internal state
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<any | null>(null);
  
  // Keep reference to the bridge instance
  const bridgeRef = useRef<VideoContext | null>(null);
  
  // Track if initialization has been attempted
  const initAttempted = useRef(false);
  
  // Track current media URL to avoid re-initializing for the same URL
  const currentMediaUrlRef = useRef<string | null | undefined>(null);
  const currentLocalMediaUrlRef = useRef<string | null | undefined>(null);

  // Initialize bridge instance when refs or media URL changes
  useEffect(() => {
    // Skip if no media URL available
    if (!mediaUrl && !localMediaUrl) {
      console.warn('[VideoContextBridge] No media URL provided, bridge will not be initialized');
      return;
    }
    
    // Skip if URLs haven't changed
    const mediaUrlChanged = mediaUrl !== currentMediaUrlRef.current;
    const localMediaUrlChanged = localMediaUrl !== currentLocalMediaUrlRef.current;
    
    if (!mediaUrlChanged && !localMediaUrlChanged && bridgeRef.current && initAttempted.current) {
      console.log('[VideoContextBridge] Skipping initialization as URLs have not changed');
      return;
    }
    
    // Update URL refs
    currentMediaUrlRef.current = mediaUrl;
    currentLocalMediaUrlRef.current = localMediaUrl;
    
    console.log('[VideoContextBridge] Setting up bridge adapter with media:', { 
      mediaUrl, 
      localMediaUrl,
      effectiveUrl: localMediaUrl || mediaUrl,
      mediaType,
      videoRefExists: !!videoRef?.current,
      canvasRefExists: !!canvasRef?.current
    });
    
    // Set loading state
    setIsLoading(true);
    setHasError(false);
    setErrorMessage(null);
    
    // Add a small delay to ensure React has had time to attach refs
    const initTimeout = setTimeout(async () => {
      const initBridge = async () => {
        try {
          initAttempted.current = true;

          // Ensure videoRef is available
          if (!videoRef?.current) {
            console.warn('[Bridge Init Warning]: Video element reference not available yet, will try again on next render');
            setIsLoading(false);
            return;
          }

          // If we already have a bridge instance, destroy it first
          if (bridgeRef.current) {
            bridgeRef.current.destroy();
            bridgeRef.current = null;
          }

          // Create new bridge instance with debug mode
          const bridge = new VideoContext(true);
          
          // Set the video element
          bridge.setVideo(videoRef.current);
          
          // Optional: Set canvas if available
          if (canvasRef?.current) {
            bridge.setCanvas(canvasRef.current);
          }

          // Store bridge instance
          bridgeRef.current = bridge;

          // Initialize the bridge, explicitly passing both URLs
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

      // Initialize regardless of canvas availability
      await initBridge();
    }, 100); // Add a short delay to let React finish rendering

    // Cleanup
    return () => {
      clearTimeout(initTimeout);
    };
  }, [
    videoRef, 
    canvasRef, 
    mediaUrl, 
    localMediaUrl, 
    onIsReadyChange, 
    onDurationChange, 
    onError, 
    onReady
  ]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
      }
    };
  }, []);

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

  // Time update effect - only set up once bridge is ready
  useEffect(() => {
    if (!bridgeRef.current || !onTimeUpdate || !isReady) return;

    const handleTimeUpdate = () => {
      const currentTime = bridgeRef.current?.getCurrentTime() || 0;
      onTimeUpdate(currentTime);
    };

    // Set up time update interval
    const intervalId = setInterval(handleTimeUpdate, 1000 / 30); // 30fps updates

    return () => {
      clearInterval(intervalId);
    };
  }, [onTimeUpdate, isReady]);

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