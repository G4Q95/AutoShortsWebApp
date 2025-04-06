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

export function usePlaybackState({}: UsePlaybackStateProps = {}): UsePlaybackStateReturn {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  // Initialize visualTime based on initial currentTime
  const [visualTime, setVisualTime] = useState<number>(currentTime);

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