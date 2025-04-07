import { useState, useEffect, useCallback, RefObject } from 'react';

// TODO: Define actual types based on VideoContext and component needs
type VideoContextInstance = any; 

/**
 * Props for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeProps {
  // Actual VideoContext instance passed from the parent
  videoContextInstance: VideoContextInstance | null;
  
  // Canvas reference for rendering
  canvasRef: RefObject<HTMLCanvasElement | null>;
  localMediaUrl?: string | null;
  mediaType: string;
  initialMediaAspectRatio?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onDurationChange?: (duration: number) => void;
}

/**
 * Return type for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeReturn {
  // Video context instance and basic state
  videoContext: VideoContextInstance | null;
  isReady: boolean;
  duration: number;
  
  // Core playback methods
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  
  // Source and initialization methods
  createVideoSourceNode: (ctx: VideoContextInstance) => any | null;
  prepareVideoContext: (baseSize?: number) => Promise<VideoContextInstance | null>;
}

/**
 * useVideoContextBridge - Hook to abstract VideoContext interactions
 */
export function useVideoContextBridge({
  videoContextInstance,
  canvasRef,
  localMediaUrl,
  mediaType,
  initialMediaAspectRatio,
  onReady,
  onError,
  onDurationChange,
}: UseVideoContextBridgeProps): UseVideoContextBridgeReturn {
  
  // --- Internal State ---
  const [isReady, setIsReady] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);

  // --- Effects ---
  useEffect(() => {
    console.log("[useVideoContextBridge] Hook mounted (no-op)");
    return () => {
      console.log("[useVideoContextBridge] Hook unmounted (no-op)");
    };
  }, []); 

  // --- Methods ---
  // Helper function to check if media type is video
  function isVideoType(type: string): boolean {
    return type === 'video';
  }

  const play = useCallback(() => {
    if (videoContextInstance && typeof videoContextInstance.play === 'function') {
      try {
        console.log("[useVideoContextBridge] Calling videoContextInstance.play()");
        videoContextInstance.play();
      } catch (error) {
        console.error("[useVideoContextBridge] Error calling play():", error);
        onError?.(error instanceof Error ? error : new Error('Playback error'));
      }
    } else {
      console.warn("[useVideoContextBridge] Play called but videoContextInstance is null or invalid");
    }
  }, [videoContextInstance, onError]);

  const pause = useCallback(() => {
    if (videoContextInstance && typeof videoContextInstance.pause === 'function') {
      try {
        console.log("[useVideoContextBridge] Calling videoContextInstance.pause()");
        videoContextInstance.pause();
      } catch (error) {
        console.error("[useVideoContextBridge] Error calling pause():", error);
        onError?.(error instanceof Error ? error : new Error('Pause error'));
      }
    } else {
      console.warn("[useVideoContextBridge] Pause called but videoContextInstance is null or invalid");
    }
  }, [videoContextInstance, onError]);

  const seek = useCallback((time: number) => {
    if (videoContextInstance && typeof videoContextInstance.currentTime !== 'undefined') {
      try {
        const contextDuration = videoContextInstance.duration || duration;
        const clampedTime = Math.max(0, Math.min(time, contextDuration > 0 ? contextDuration : Infinity));
        
        console.log(`[useVideoContextBridge] Attempting to seek to ${time.toFixed(3)} (clamped: ${clampedTime.toFixed(3)})`);
        videoContextInstance.currentTime = clampedTime;
      } catch (error) {
        console.error("[useVideoContextBridge] Error during seek:", error);
        onError?.(error instanceof Error ? error : new Error('Seek error'));
      }
    } else {
      console.warn(`[useVideoContextBridge] Seek called but videoContextInstance is null or currentTime is not available. Time: ${time}`);
    }
  }, [videoContextInstance, duration, onError]);

  const createVideoSourceNode = useCallback((ctx: VideoContextInstance) => {
    if (mediaType === 'video' && localMediaUrl && ctx) {
      console.log(`[useVideoContextBridge] Creating video source node for: ${localMediaUrl}`);
      try {
        const source = ctx.video(localMediaUrl);
        if (!source) throw new Error('Failed to create video source node in bridge');

        source.connect(ctx.destination);
        source.start(0);
        // Set a reasonable default stop time, can be adjusted later if needed
        source.stop(300); // e.g., 5 minutes max, adjust as necessary

        source.registerCallback('loaded', () => {
          console.log("[useVideoContextBridge] Source 'loaded' callback triggered.");
          setIsReady(true); // Update hook's internal readiness state
          onReady?.(); // Notify parent component
          if (source.element) {
            const videoElement = source.element as HTMLVideoElement;
            const videoDuration = videoElement.duration;
            if (videoDuration && isFinite(videoDuration)) {
              setDuration(videoDuration); // Update hook's internal duration state
              onDurationChange?.(videoDuration); // Notify parent component
            }
          }
        });
          
        source.registerCallback('error', (err: any) => {
          console.error("[useVideoContextBridge] Source 'error' callback triggered:", err);
          setIsReady(false);
          const error = err instanceof Error ? err : new Error('Video source loading error');
          onError?.(error); // Notify parent component
        });
        
        // Return the created source node
        return source;

      } catch (error) {
        console.error("[useVideoContextBridge] Error creating video source node:", error);
        setIsReady(false);
        onError?.(error instanceof Error ? error : new Error('Video source creation failed'));
        return null;
      }
    } else {
      console.warn("[useVideoContextBridge] createVideoSourceNode called but conditions not met (not video, no URL, or no context)");
      return null;
    }
  }, [localMediaUrl, mediaType, onReady, onError, onDurationChange]);

  /**
   * Prepares a VideoContext instance on the canvas
   * This method handles the canvas setup and dynamic import of VideoContext
   * but doesn't handle the full initialization (source nodes, etc.)
   */
  const prepareVideoContext = useCallback(async (baseSize: number = 1920): Promise<VideoContextInstance | null> => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[useVideoContextBridge] Cannot prepare VideoContext - canvas ref is null');
      return null;
    }
    
    try {
      // Dynamically import VideoContext
      const VideoContextModule = await import('videocontext');
      const VideoContext = VideoContextModule.default || VideoContextModule;
      
      // Calculate dimensions based on aspect ratio
      let canvasWidth: number, canvasHeight: number;
      
      // Use initialMediaAspectRatio from props if available, otherwise use a default
      const initialRatioForCanvas = initialMediaAspectRatio || (9 / 16);
      if (initialRatioForCanvas >= 1) {
        canvasWidth = baseSize;
        canvasHeight = Math.round(baseSize / initialRatioForCanvas);
      } else {
        canvasHeight = baseSize;
        canvasWidth = Math.round(baseSize * initialRatioForCanvas);
      }
      
      // Set canvas internal resolution
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // Create the VideoContext instance
      const ctx = new VideoContext(canvas);
      if (!ctx) {
        throw new Error('Failed to create VideoContext instance');
      }
      
      console.log('[useVideoContextBridge] Successfully prepared VideoContext');
      return ctx;
    } catch (error) {
      console.error('[useVideoContextBridge] Error preparing VideoContext:', error);
      onError?.(error instanceof Error ? error : new Error('VideoContext preparation failed'));
      return null;
    }
  }, [canvasRef, initialMediaAspectRatio, onError]);

  return {
    videoContext: videoContextInstance,
    isReady,
    duration,
    play,
    pause,
    seek,
    createVideoSourceNode,
    prepareVideoContext,
  };
}
