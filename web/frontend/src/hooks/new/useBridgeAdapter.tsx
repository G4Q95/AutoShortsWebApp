import { useCallback, useState, RefObject } from 'react';
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
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  initialMediaAspectRatio?: number;
  showFirstFrame: boolean;
  onInitialLoad?: () => void;
}) {
  // State that would normally be in the main component
  const [isReady, setIsReady] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // Create a new bridge instance
  const bridge = useNewBridge({
    canvasRef,
    videoRef,
    mediaUrl,
    localMediaUrl,
    mediaType,
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
    },
    onTimeUpdate: (time: number) => {
      setCurrentTime(time);
    },
    onError: (error: Error) => {
      console.error('[BridgeAdapter] Error from bridge:', error);
    },
  });

  // Create adapter functions to match legacy API
  const legacyPlay = useCallback(async () => {
    try {
      await bridge.play();
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Play error:', error);
      return false;
    }
  }, [bridge]);

  const legacyPause = useCallback(async () => {
    try {
      await bridge.pause();
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Pause error:', error);
      return false;
    }
  }, [bridge]);

  const legacySeek = useCallback(async (time: number) => {
    try {
      await bridge.seek(time);
      return true;
    } catch (error) {
      console.error('[BridgeAdapter] Seek error:', error);
      return false;
    }
  }, [bridge]);

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
    
    // Debug info
    isInitializing: bridge.isInitializing,
    hasError: bridge.hasError,
    errorMessage: bridge.errorMessage,
  };
} 