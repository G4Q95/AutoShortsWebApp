import React from 'react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onSeek?: (time: number) => void;
  currentTime?: number;
  duration?: number;
  disabled?: boolean;
  className?: string;
}

export function PlaybackControls({
  isPlaying,
  onPlayPause,
  onSeek,
  currentTime = 0,
  duration = 0,
  disabled = false,
  className = '',
}: PlaybackControlsProps) {
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onSeek) {
      onSeek(parseFloat(e.target.value));
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <button
        onClick={onPlayPause}
        disabled={disabled}
        className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          </svg>
        )}
      </button>
      
      {onSeek && (
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={handleSeek}
          disabled={disabled}
          className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-gray-200 disabled:opacity-50"
          data-drag-handle-exclude="true"
        />
      )}
      
      <div className="text-sm text-gray-600">
        {Math.floor(currentTime)}s / {Math.floor(duration)}s
      </div>
    </div>
  );
} 