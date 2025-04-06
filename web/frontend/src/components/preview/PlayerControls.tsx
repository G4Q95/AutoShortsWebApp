import React from 'react';
import { PlayIcon, PauseIcon, LockIcon, UnlockIcon, ScissorsIcon, CheckIcon } from 'lucide-react';

// Define InfoIcon locally for now, or import if moved to a shared location
const InfoIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

// Define formatTime locally or import
const formatTime = (seconds: number, showTenths: boolean = false): string => {
  if (isNaN(seconds) || seconds < 0) {
    seconds = 0;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  
  if (showTenths) {
    const tenths = Math.floor((seconds - Math.floor(seconds)) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
  } else {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
};


interface PlayerControlsProps {
  isPlaying: boolean;
  currentTime: number;
  visualTime: number; // Use visualTime for scrubber value when dragging
  duration: number;
  trimStart: number;
  effectiveTrimEnd: number; // Pass the calculated effective end
  controlsLocked: boolean;
  trimActive: boolean;
  showAspectRatio: boolean;
  isDraggingScrubber: boolean;
  activeHandle: 'start' | 'end' | null; // Needed for time display logic

  onPlayPauseToggle: () => void;
  onScrubberMouseDown: () => void;
  onScrubberMouseUp: () => void;
  onScrubberChange: (event: React.ChangeEvent<HTMLInputElement>) => void; // Handler for visual update during drag
  onLockToggle: () => void;
  onAspectRatioToggle: () => void;
  onTrimToggle: () => void;
  
  // Pass refs if absolutely necessary, but prefer callbacks
  // timelineRef?: React.RefObject<HTMLInputElement>; 
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  currentTime,
  visualTime,
  duration,
  trimStart,
  effectiveTrimEnd,
  controlsLocked,
  trimActive,
  showAspectRatio,
  isDraggingScrubber,
  activeHandle,
  
  onPlayPauseToggle,
  onScrubberMouseDown,
  onScrubberMouseUp,
  onScrubberChange,
  onLockToggle,
  onAspectRatioToggle,
  onTrimToggle,
}) => {

  // Determine scrubber value: use visualTime if dragging, otherwise currentTime
  const scrubberValue = isDraggingScrubber ? visualTime : currentTime;
    
  return (
    <div 
      className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-1 pt-2 pb-1 rounded-b-md"
      style={{
        position: 'absolute',
        bottom: '0px',
        zIndex: 50, 
        pointerEvents: controlsLocked ? 'none' : 'auto' 
      }}
      onMouseDown={(e) => e.stopPropagation()}
      data-testid="player-controls-container"
    >
      {/* Control buttons row */}
      <div className="flex justify-between items-center px-1" 
           data-drag-handle-exclude="true" 
           style={{ position: 'relative', zIndex: 55, pointerEvents: 'auto' }}>
        {/* Left button section (Play/Pause) */}
        <div className="flex-shrink-0 w-14 flex justify-start">
           {/* Play/Pause button */}
           <button
             onClick={(e) => {
               e.stopPropagation();
               onPlayPauseToggle();
             }}
             className="text-white hover:opacity-100 focus:outline-none"
             data-testid="play-pause-button"
             onMouseDown={(e) => e.stopPropagation()}
             style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
           >
             {isPlaying ? (
               <PauseIcon className="w-4 h-4" /> // Slightly larger main button
             ) : (
               <PlayIcon className="w-4 h-4" />
             )}
           </button>
        </div>

        {/* Time display (center) */}
        <div className="flex-grow text-center text-white text-xs">
          {activeHandle === 'start' 
            ? `${formatTime(trimStart, true)} / ${formatTime(effectiveTrimEnd - trimStart)}`
            : activeHandle === 'end'
              ? `${formatTime(effectiveTrimEnd, true)} / ${formatTime(effectiveTrimEnd - trimStart)}`
              // Ensure calculated duration is not negative if trimStart > currentTime temporarily
              : `${formatTime(Math.max(0, currentTime - trimStart))} / ${formatTime(Math.max(0, effectiveTrimEnd - trimStart))}`
          }
        </div>
        
        {/* Right buttons section */}
        <div className="flex-shrink-0 w-auto flex justify-end space-x-1.5"> 
          {/* Lock button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onLockToggle();
            }}
            className="text-white hover:opacity-100 focus:outline-none"
            data-testid="toggle-lock-button"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
          >
            {controlsLocked ? (
              <LockIcon className="w-3 h-3" />
            ) : (
              <UnlockIcon className="w-3 h-3" />
            )}
          </button>
          {/* Aspect ratio info button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAspectRatioToggle();
            }}
            className={`text-white hover:opacity-100 focus:outline-none ${showAspectRatio ? 'opacity-100' : 'opacity-60'}`}
            data-testid="toggle-aspect-ratio"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
          >
            <InfoIcon />
          </button>
          
          {/* Scissor/Save button (Trim Toggle) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTrimToggle();
            }}
            className="text-white hover:opacity-100 focus:outline-none"
            data-testid="toggle-trim-button"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
          >
            {trimActive ? (
              <CheckIcon className="w-3 h-3" />
            ) : (
              <ScissorsIcon className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls; 