import React from 'react';
import { PlayIcon, PauseIcon } from 'lucide-react';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
}

export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  isPlaying,
  onToggle,
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // Prevent clicks bubbling up
        onToggle();
      }}
      className="text-white hover:opacity-100 focus:outline-none"
      data-testid="play-pause-button"
      onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on button
      style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }} // Styles from original
    >
      {isPlaying ? (
        <PauseIcon className="w-4 h-4" /> // Size from original
      ) : (
        <PlayIcon className="w-4 h-4" /> // Size from original
      )}
    </button>
  );
};

export default PlayPauseButton; 