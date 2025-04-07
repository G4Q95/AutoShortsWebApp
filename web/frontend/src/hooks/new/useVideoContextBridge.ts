import { useState, useEffect, useCallback, RefObject, useMemo } from 'react';

// Define VideoContext types
type VideoContextInstance = any; // Will use any for now, but should be properly typed later

/**
 * Props for the useVideoContextBridge hook with redesigned interface
 * - Keeps state in the component, not in the bridge
 * - Bridge responds to component state, not the other way around
 * - Uses callbacks for state changes
 */
interface UseVideoContextBridgeProps {
  // DOM Refs (read-only)
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>; // For first frame
  
  // Media Info (read-only)
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  initialMediaAspectRatio?: number;
  
  // Visual State (read-only)
  showFirstFrame: boolean;  // Critical for coordination
  
  // Callbacks (for state changes)
  onIsReadyChange: (isReady: boolean) => void;
  onDurationChange: (duration: number) => void;
  onTimeUpdate?: (time: number) => void;
  onError: (error: Error) => void;
}

/**
 * Return type for the useVideoContextBridge hook
 * - Methods return Promises for proper async handling
 * - No state except minimal status indicators
 */
interface UseVideoContextBridgeReturn {
  // Actions - all return Promises for proper async handling
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  
  // Status info (minimal internal state)
  isInitializing: boolean;
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Helper functions
 */
const isVideoType = (mediaType: string): boolean => mediaType === 'video';

/**
 * useVideoContextBridge - Redesigned hook to abstract VideoContext interactions
 * 
 * Key improvements:
 * 1. State remains in the component, not duplicated in the bridge
 * 2. All methods return Promises for proper async handling
 * 3. Bridge is aware of DOM state (showFirstFrame)
 * 4. Error handling is comprehensive
 * 5. Clear separation of responsibilities
 */
export function useVideoContextBridge({
  canvasRef,
  videoRef,
  mediaUrl,
  localMediaUrl,
  mediaType,
  initialMediaAspectRatio,
  showFirstFrame, // Critical for coordination
  onIsReadyChange,
  onDurationChange,
  onTimeUpdate,
  onError,
}: UseVideoContextBridgeProps): UseVideoContextBridgeReturn {
  // --- Minimal Internal State ---
  // Only track initialization status and errors
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Private state not exposed in return value
  const [videoContext, setVideoContext] = useState<VideoContextInstance | null>(null);
  const [videoSource, setVideoSource] = useState<any | null>(null);
  
  // --- Error Handling Utility ---
  const handleError = useCallback((error: unknown, message: string) => {
    console.error(`[Bridge Error] ${message}:`, error);
    const finalError = error instanceof Error ? error : new Error(`${message}: ${error}`);
    setHasError(true);
    setErrorMessage(finalError.message);
    onError(finalError);
    return finalError;
  }, [onError]);
  
  // --- VideoContext Initialization ---
  // Only initializes - doesn't manage ongoing state
  useEffect(() => {
    // Skip non-video media types
    if (!isVideoType(mediaType)) {
      return;
    }
    
    // Skip if missing required refs
    if (!canvasRef.current) {
      handleError(new Error('Canvas reference is not available'), 'Initialization failed');
      return;
    }
    
    if (!localMediaUrl) {
      handleError(new Error('Media URL is not available'), 'Initialization failed');
      return;
    }
    
    // Flag for cleanup if effect re-runs
    let isActive = true;
    
    const initializeContext = async () => {
      setIsInitializing(true);
      setHasError(false);
      setErrorMessage(null);
      
      try {
        // Import VideoContext dynamically
        const VideoContextModule = await import('videocontext');
        const VideoContext = VideoContextModule.default || VideoContextModule;
        
        // Configure canvas dimensions
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas reference no longer available');
        
        const baseSize = 1920; // Default high quality
        let canvasWidth: number, canvasHeight: number;
        const ratio = initialMediaAspectRatio || (9 / 16);
        
        if (ratio >= 1) {
          canvasWidth = baseSize; 
          canvasHeight = Math.round(baseSize / ratio);
        } else {
          canvasHeight = baseSize; 
          canvasWidth = Math.round(baseSize * ratio);
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // Create context
        const ctx = new VideoContext(canvas);
        if (!ctx) throw new Error('Failed to create VideoContext instance');
        
        // Only continue if effect is still active
        if (!isActive) return;
        
        setVideoContext(ctx);
        
        // Create video source
        const source = ctx.video(localMediaUrl);
        if (!source) throw new Error('Failed to create video source node');
        
        // Connect to destination and set time range (0 to 300 seconds)
        source.connect(ctx.destination);
        source.start(0);
        source.stop(300); // Reasonable upper limit for short videos
        
        if (!isActive) return;
        
        setVideoSource(source);
        
        // Register callbacks on source
        source.registerCallback('loaded', () => {
          if (!isActive) return;
          
          // Get video duration
          let videoDuration = 0;
          if (source && source.element) {
            const videoElement = source.element as HTMLVideoElement;
            videoDuration = videoElement.duration;
          }
          
          if (videoDuration && isFinite(videoDuration) && videoDuration > 0) {
            console.log(`[Bridge] Video loaded with duration: ${videoDuration}`);
            onDurationChange(videoDuration);
            onIsReadyChange(true);
          } else {
            console.warn(`[Bridge] Invalid video duration: ${videoDuration}`);
            onIsReadyChange(false);
            handleError(
              new Error(`Invalid video duration: ${videoDuration}`),
              'Video loaded with invalid duration'
            );
          }
          
          setIsInitializing(false);
        });
        
        source.registerCallback('error', (function(err: any) {
          if (!isActive) return;
          handleError(err, 'Video source error');
          onIsReadyChange(false);
          setIsInitializing(false);
        }) as any);
        
      } catch (error) {
        if (!isActive) return;
        handleError(error, 'VideoContext initialization failed');
        onIsReadyChange(false);
        setIsInitializing(false);
      }
    };
    
    // Start initialization
    initializeContext();
    
    // Cleanup function
    return () => {
      isActive = false;
      
      // Clean up VideoContext
      if (videoContext) {
        try {
          videoContext.reset();
          if (typeof videoContext.dispose === 'function') {
            videoContext.dispose();
          }
        } catch (error) {
          console.error('[Bridge] Error during cleanup:', error);
        }
      }
      
      // Reset state
      setVideoContext(null);
      setVideoSource(null);
      setIsInitializing(false);
      onIsReadyChange(false);
    };
  }, [
    mediaType,
    canvasRef,
    localMediaUrl,
    initialMediaAspectRatio,
    handleError,
    onIsReadyChange,
    onDurationChange,
  ]);
  
  // --- Core Playback Methods ---
  
  // PLAY - Returns a Promise that resolves when play succeeds or rejects on error
  const play = useCallback(async (): Promise<void> => {
    // First check if canvas is visible (critical coordination check)
    if (showFirstFrame === true) {
      const error = new Error('Cannot play video - canvas is hidden (showFirstFrame=true)');
      console.warn('[Bridge Play]', error.message);
      return Promise.reject(error);
    }
    
    if (!videoContext) {
      const error = new Error('Cannot play - VideoContext not initialized');
      console.error('[Bridge Play]', error.message);
      return Promise.reject(error);
    }
    
    try {
      // Log canvas visibility state for debugging
      const canvas = canvasRef.current;
      if (canvas) {
        const computedStyle = window.getComputedStyle(canvas);
        console.log(`[Bridge Play] Canvas display: ${computedStyle.display}, visibility: ${computedStyle.visibility}`);
      }
      
      // Try to play
      videoContext.play();
      
      // Force a render frame immediately
      if (typeof videoContext.update === 'function') {
        videoContext.update(videoContext.currentTime);
      }
      
      console.log('[Bridge Play] VideoContext play successful');
      return Promise.resolve();
    } catch (error) {
      const playError = handleError(error, 'Error during play');
      return Promise.reject(playError);
    }
  }, [videoContext, canvasRef, showFirstFrame, handleError]);
  
  // PAUSE - Returns a Promise that resolves when pause succeeds or rejects on error
  const pause = useCallback(async (): Promise<void> => {
    if (!videoContext) {
      const error = new Error('Cannot pause - VideoContext not initialized');
      console.error('[Bridge Pause]', error.message);
      return Promise.reject(error);
    }
    
    try {
      videoContext.pause();
      console.log('[Bridge Pause] VideoContext pause successful');
      return Promise.resolve();
    } catch (error) {
      const pauseError = handleError(error, 'Error during pause');
      return Promise.reject(pauseError);
    }
  }, [videoContext, handleError]);
  
  // SEEK - Returns a Promise that resolves when seek succeeds or rejects on error
  const seek = useCallback(async (time: number): Promise<void> => {
    if (!videoContext) {
      const error = new Error('Cannot seek - VideoContext not initialized');
      console.error('[Bridge Seek]', error.message);
      return Promise.reject(error);
    }
    
    try {
      // Clamp time to valid range
      const currentDuration = videoContext.duration || Infinity;
      const clampedTime = Math.max(0, Math.min(time, currentDuration));
      
      // Set time
      videoContext.currentTime = clampedTime;
      
      // Force a frame render if paused
      if (videoContext.state !== 'playing' && typeof videoContext.update === 'function') {
        videoContext.update(clampedTime);
      }
      
      // Notify component of time update
      if (onTimeUpdate) {
        onTimeUpdate(clampedTime);
      }
      
      console.log(`[Bridge Seek] Successful seek to ${clampedTime}`);
      return Promise.resolve();
    } catch (error) {
      const seekError = handleError(error, 'Error during seek');
      return Promise.reject(seekError);
    }
  }, [videoContext, handleError, onTimeUpdate]);
  
  // --- Animation Frame Loop for Time Updates ---
  useEffect(() => {
    // Only set up time tracking if VideoContext is initialized and we have a time update callback
    if (!videoContext || !onTimeUpdate || !isVideoType(mediaType)) {
      return;
    }
    
    let animationFrameId: number | null = null;
    let isActive = true;
    
    // Time update function
    const updateTime = () => {
      if (!isActive || !videoContext) return;
      
      try {
        const currentTime = videoContext.currentTime;
        if (currentTime !== undefined && onTimeUpdate) {
          onTimeUpdate(currentTime);
        }
      } catch (error) {
        console.warn('[Bridge TimeUpdate] Error getting current time:', error);
      }
      
      // Continue loop if active
      animationFrameId = requestAnimationFrame(updateTime);
    };
    
    // Start loop
    animationFrameId = requestAnimationFrame(updateTime);
    
    // Cleanup
    return () => {
      isActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [videoContext, onTimeUpdate, mediaType]);
  
  // --- Return API ---
  return useMemo(() => ({
    // Async methods
    play,
    pause,
    seek,
    
    // Status indicators
    isInitializing,
    hasError,
    errorMessage,
  }), [
    play,
    pause,
    seek,
    isInitializing,
    hasError,
    errorMessage,
  ]);
} 