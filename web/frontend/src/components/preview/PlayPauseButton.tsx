import React from 'react';
import { PlayIcon, PauseIcon } from 'lucide-react';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  isReady: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  disabled?: boolean;
}

export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  isPlaying,
  isReady,
  onClick,
  className = '',
  disabled = false
}) => {
  const handleClick = (e: React.MouseEvent) => {
    console.log(`[PLAY BUTTON DEBUG] Button clicked, current state: isPlaying=${isPlaying}, isReady=${isReady}, disabled=${disabled}`);
    if (!disabled && onClick) {
      console.log('[PLAY BUTTON DEBUG] Calling parent onClick handler');
      onClick(e);
    }
  };

  return (
    <button
      className={`${className} flex items-center justify-center rounded-full bg-black/50 w-8 h-8 text-white hover:bg-black/70 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={handleClick}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause' : 'Play'}
      disabled={disabled}
    >
      {isPlaying ? (
        <PauseIcon className="w-4 h-4" />
      ) : (
        <PlayIcon className="w-4 h-4" />
      )}
    </button>
  );
};

export default PlayPauseButton; 