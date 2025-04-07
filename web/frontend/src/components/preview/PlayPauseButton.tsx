import React from 'react';
import { PlayIcon, PauseIcon } from 'lucide-react';

interface PlayPauseButtonProps {
  isPlaying: boolean;
  isReady: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

export const PlayPauseButton: React.FC<PlayPauseButtonProps> = ({
  isPlaying,
  isReady,
  onClick,
  className = ''
}) => {
  const handleClick = (e: React.MouseEvent) => {
    console.log(`[PLAY BUTTON DEBUG] Button clicked, current state: isPlaying=${isPlaying}, isReady=${isReady}`);
    if (onClick) {
      console.log('[PLAY BUTTON DEBUG] Calling parent onClick handler');
      onClick(e);
    }
  };

  return (
    <button
      className={`${className} flex items-center justify-center rounded-full bg-black/50 w-8 h-8 text-white hover:bg-black/70 transition focus:outline-none focus:ring-2 focus:ring-blue-500`}
      onClick={handleClick}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause' : 'Play'}
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