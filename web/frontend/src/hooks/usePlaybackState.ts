import { useState } from 'react';

// No props needed for this simple version yet
interface UsePlaybackStateProps {}

interface UsePlaybackStateReturn {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  // Removed currentTime and setCurrentTime since bridge.currentTime is the source of truth
}

/**
 * usePlaybackState - Custom Hook for Managing Playback State Variables
 *
 * Encapsulates the useState call for isPlaying.
 * This hook intentionally *does not* contain complex logic like the rAF loop,
 * boundary checks, or event handlers, which remain in the consuming component.
 * 
 * NOTE: currentTime has been removed as bridge.currentTime is now the source of truth
 */
export function usePlaybackState({}: UsePlaybackStateProps = {}): UsePlaybackStateReturn {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Removed currentTime state as we're using bridge.currentTime

  return {
    isPlaying,
    setIsPlaying,
  };
} 