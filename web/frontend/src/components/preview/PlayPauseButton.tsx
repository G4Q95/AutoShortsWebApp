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
      className={`${className} text-white hover:opacity-100 focus:outline-none`}
      onClick={handleClick}
      aria-label={isPlaying ? 'Pause' : 'Play'}
      title={isPlaying ? 'Pause' : 'Play'}
      onMouseDown={(e) => e.stopPropagation()}
      style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
    >
      {isPlaying ? (
        <PauseIcon className="w-3 h-3" />
      ) : (
        <PlayIcon className="w-3 h-3" />
      )}
    </button>
  );
};

export default PlayPauseButton; 