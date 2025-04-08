import { useCallback, useEffect, useRef, useState } from 'react';
import { VideoContext, type VideoContextValue } from './VideoContext';

// Custom error class for bridge-related errors
export class BridgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BridgeError';
  }
}

// State interface for the bridge
export interface VideoContextBridgeState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  isReady: boolean;
}

// Controls interface for the bridge
export interface VideoContextBridgeControls {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
}

// Main hook implementation
export function useVideoContextBridge(
  videoElement: HTMLVideoElement | null,
  onError?: (error: Error) => void
): [VideoContextBridgeState, VideoContextBridgeControls] {
  // Refs for managing state and cleanup
  const contextRef = useRef<VideoContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // State management
  const [state, setState] = useState<VideoContextBridgeState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    error: null,
    isReady: false,
  });

  // Initialize VideoContext when video element changes
  useEffect(() => {
    if (!videoElement) {
      return;
    }

    try {
      contextRef.current = new VideoContext(videoElement);
      
      // Update initial state
      setState(prev => ({
        ...prev,
        duration: videoElement.duration || 0,
        isReady: videoElement.readyState >= 2,
      }));

      // Set up periodic state updates
      intervalRef.current = setInterval(() => {
        if (contextRef.current) {
          setState(prev => ({
            ...prev,
            currentTime: videoElement.currentTime,
            isPlaying: !videoElement.paused,
            duration: videoElement.duration || 0,
            isReady: videoElement.readyState >= 2,
          }));
        }
      }, 100);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to initialize VideoContext');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      contextRef.current = null;
    };
  }, [videoElement, onError]);

  // Play control
  const play = useCallback(async () => {
    try {
      if (!contextRef.current) {
        throw new BridgeError('VideoContext not initialized');
      }
      await contextRef.current.play();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to play video');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      throw error;
    }
  }, [onError]);

  // Pause control
  const pause = useCallback(async () => {
    try {
      if (!contextRef.current) {
        throw new BridgeError('VideoContext not initialized');
      }
      await contextRef.current.pause();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to pause video');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      throw error;
    }
  }, [onError]);

  // Seek control
  const seek = useCallback(async (time: number) => {
    try {
      if (!contextRef.current) {
        throw new BridgeError('VideoContext not initialized');
      }
      await contextRef.current.seek(time);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to seek video');
      setState(prev => ({ ...prev, error: error.message }));
      onError?.(error);
      throw error;
    }
  }, [onError]);

  // Return state and controls
  return [
    state,
    {
      play,
      pause,
      seek,
    },
  ];
}