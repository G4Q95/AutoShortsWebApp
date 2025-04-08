import { useCallback, useState, RefObject, useEffect } from 'react';
import { useVideoContextBridge as useNewBridge } from './useVideoContextBridge';

/**
 * Bridge adapter to provide a consistent interface between 
 * the legacy bridge and new bridge implementations
 */
export function useBridgeAdapter({
  canvasRef,
  videoRef,
  mediaUrl,
  localMediaUrl,
  mediaType,
  initialMediaAspectRatio,
  showFirstFrame,
  onInitialLoad,
  onError,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  initialMediaAspectRatio?: number;
  showFirstFrame: boolean;
  onInitialLoad?: () => void;
  onError?: (error: Error) => void;
}) {
  // State that would normally be in the main component
  const [isReady, setIsReady] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [timeUpdateHandlers] = useState<Array<(time: number) => void>>([]);
  const [durationChangeHandlers] = useState<Array<(duration: number) => void>>([]);

  // Debugging
  console.log('[BridgeAdapter] Initializing with', {
    mediaUrl, 
    localMediaUrl,
    mediaType,
    hasCanvasRef: !!canvasRef.current,
    hasVideoRef: !!videoRef.current,
    showFirstFrame
  });

  // Create a new bridge instance
  const bridge = useNewBridge({
    canvasRef,
    videoRef,
    mediaUrl: mediaUrl || '',
    localMediaUrl: localMediaUrl || mediaUrl || '',
    mediaType: mediaType || 'video',
    initialMediaAspectRatio,
    showFirstFrame,
    
    // Callbacks to update component state
    onIsReadyChange: (ready: boolean) => {
      console.log(`[BridgeAdapter] isReady changed to ${ready}`);
      setIsReady(ready);
      if (ready && onInitialLoad) {
        onInitialLoad();
      }
    },
    onDurationChange: (newDuration: number) => {
      console.log(`[BridgeAdapter] duration changed to ${newDuration}`);
      setDuration(newDuration);
      durationChangeHandlers.forEach(handler => handler(newDuration));
    },
    onTimeUpdate: (time: number) => {
      setCurrentTime(time);
      timeUpdateHandlers.forEach(handler => handler(time));
    },
    onError: (error: Error) => {
      console.error('[BridgeAdapter] Error from bridge:', error);
      if (onError) {
        onError(error);
      }
    },
  });

  // Create adapter functions to match legacy API
  const legacyPlay = useCallback(async () => {
    try {
      console.log('[BridgeAdapter] Play called');
      await bridge.play();
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Play error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return false;
    }
  }, [bridge, onError]);

  const legacyPause = useCallback(async () => {
    try {
      console.log('[BridgeAdapter] Pause called');
      await bridge.pause();
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Pause error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return false;
    }
  }, [bridge, onError]);

  const legacySeek = useCallback(async (time: number) => {
    try {
      console.log(`[BridgeAdapter] Seek called with time ${time}`);
      await bridge.seek(time);
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Seek error:', error);
      if (onError && error instanceof Error) {
        onError(error);
      }
      return false;
    }
  }, [bridge, onError]);

  // Add helper methods for event handling
  const registerTimeUpdateHandler = useCallback((handler: (time: number) => void) => {
    if (!timeUpdateHandlers.includes(handler)) {
      timeUpdateHandlers.push(handler);
    }
    return () => {
      const index = timeUpdateHandlers.indexOf(handler);
      if (index !== -1) {
        timeUpdateHandlers.splice(index, 1);
      }
    };
  }, [timeUpdateHandlers]);

  const registerDurationChangeHandler = useCallback((handler: (duration: number) => void) => {
    if (!durationChangeHandlers.includes(handler)) {
      durationChangeHandlers.push(handler);
    }
    return () => {
      const index = durationChangeHandlers.indexOf(handler);
      if (index !== -1) {
        durationChangeHandlers.splice(index, 1);
      }
    };
  }, [durationChangeHandlers]);

  // Return an object that mimics the legacy bridge interface
  return {
    // Bridge status
    videoContext: {}, // Placeholder to match interface
    isReady,
    duration,
    currentTime,
    
    // Methods
    play: legacyPlay,
    pause: legacyPause,
    seek: legacySeek,
    
    // Event registration helpers
    registerTimeUpdateHandler,
    registerDurationChangeHandler,
    
    // Debug info
    isInitializing: bridge.isInitializing,
    hasError: bridge.hasError,
    errorMessage: bridge.errorMessage,
  };
} 