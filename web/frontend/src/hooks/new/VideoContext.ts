import { createContext } from 'react';

export interface VideoContextState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isReady: boolean;
  error: Error | null;
}

export interface VideoContextActions {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  setError: (error: Error | null) => void;
}

export interface VideoContextValue extends VideoContextState {
  actions: VideoContextActions;
}

// Create context with a default value
export const VideoContext = createContext<VideoContextValue>({
  // Default state
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  isReady: false,
  error: null,
  // Default actions (no-ops)
  actions: {
    play: async () => {},
    pause: async () => {},
    seek: async () => {},
    setError: () => {},
  },
}); 