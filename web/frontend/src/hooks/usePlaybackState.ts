import { useState } from 'react';

// No props needed for this simple version yet
interface UsePlaybackStateProps {}

interface UsePlaybackStateReturn {
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  currentTime: number;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  visualTime: number;
  setVisualTime: React.Dispatch<React.SetStateAction<number>>;
}

/**
 * usePlaybackState - Custom Hook for Managing Playback State Variables
 *
 * Encapsulates the useState calls for isPlaying, currentTime, and visualTime.
 * This hook intentionally *does not* contain complex logic like the rAF loop,
 * boundary checks, or event handlers, which remain in the consuming component.
 */
export function usePlaybackState({}: UsePlaybackStateProps = {}): UsePlaybackStateReturn {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [visualTime, setVisualTime] = useState<number>(0);

  // Effect to sync visualTime will remain in parent for now,
  // Or could be added here if needed later, depending on currentTime dependency.

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    visualTime,
    setVisualTime,
  };
} 