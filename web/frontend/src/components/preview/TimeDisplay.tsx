import React from 'react';

interface TimeDisplayProps {
  currentTime: number;
  duration: number;
  trimStart: number;
  effectiveTrimEnd: number;
  activeHandle: 'start' | 'end' | null;
}

// Utility function to format time
const formatTime = (seconds: number, showTenths: boolean = false): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (showTenths) {
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};

/**
 * TimeDisplay - Renders the current playback time and total duration/trimmed duration.
 */
export function TimeDisplay({ 
  currentTime, 
  duration, 
  trimStart, 
  effectiveTrimEnd, 
  activeHandle 
}: TimeDisplayProps) {
  return (
    <div className="flex-grow text-center text-white text-xs px-2 whitespace-nowrap">
      {activeHandle === 'start' 
        ? `${formatTime(trimStart, true)} / ${formatTime(effectiveTrimEnd - trimStart)}`
        : activeHandle === 'end'
          ? `${formatTime(effectiveTrimEnd, true)} / ${formatTime(effectiveTrimEnd - trimStart)}`
          : `${formatTime(Math.max(0, currentTime - trimStart))} / ${
              trimStart > 0 || effectiveTrimEnd < duration 
                ? formatTime(effectiveTrimEnd - trimStart) 
                : formatTime(duration)
            }`
      }
    </div>
  );
} 