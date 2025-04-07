import { useState, useEffect, useCallback, RefObject } from 'react';

// TODO: Define actual types based on VideoContext and component needs
type VideoContextInstance = any; 

/**
 * Props for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeProps {
  // Actual VideoContext instance passed from the parent
  videoContextInstance: VideoContextInstance | null;
  
  // Placeholder: Define necessary props from the component
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
  // Placeholder: Define methods and state to be returned
  videoContext: VideoContextInstance | null;
  isReady: boolean;
  duration: number;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  createVideoSourceNode: (ctx: VideoContextInstance) => any | null;
  // Add other necessary return values as logic is moved
}

/**
 * useVideoContextBridge - Hook to abstract VideoContext interactions
 * 
 * (Structure updated for Step 4 - Source creation logic added)
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
  
  // --- Internal State (Placeholders - Still managed by parent for now) ---
  const [isReady, setIsReady] = useState<boolean>(false); // Hook might manage this later
  const [duration, setDuration] = useState<number>(0);   // Hook might manage this later

  // --- Effects (Placeholders) ---
  useEffect(() => {
    console.log("[useVideoContextBridge] Hook mounted (no-op)");
    return () => {
      console.log("[useVideoContextBridge] Hook unmounted (no-op)");
    };
  }, []); 

  // --- Methods ---
  const play = useCallback(() => {
    if (videoContextInstance && typeof videoContextInstance.play === 'function') {
      try {
        console.log("[useVideoContextBridge] Calling videoContextInstance.play()");
        videoContextInstance.play();
      } catch (error) {
        console.error("[useVideoContextBridge] Error calling play():", error);
        // Optionally call onError prop
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
        // Optionally call onError prop
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

  // STEP 4: Add method for creating the video source node
  const createVideoSourceNode = useCallback((ctx: VideoContextInstance) => {
    if (mediaType === 'video' && localMediaUrl && ctx) {
      console.log(`[useVideoContextBridge] Creating video source node for: ${localMediaUrl}`);
      // Placeholder: Add source creation logic
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
  }, [localMediaUrl, mediaType, onReady, onError, onDurationChange]); // Dependencies for source creation logic

  return {
    videoContext: videoContextInstance,
    isReady,
    duration,
    play,
    pause,
    seek,
    createVideoSourceNode,
  };
}
