import React, { useRef } from 'react';

// Props for the TimelineControl component
interface TimelineControlProps {
  /**
   * Visual time shown on the timeline (may differ during dragging)
   */
  visualTime: number;
  
  /**
   * Total media duration in seconds
   */
  duration: number;
  
  /**
   * Start time for trimming (in seconds)
   */
  trimStart: number;
  
  /**
   * User reference to manually set trim end point
   */
  effectiveTrimEnd: number;
  
  /**
   * Whether user is currently dragging the scrubber
   */
  isDraggingScrubber: boolean;
  
  /**
   * Whether trim mode is active
   */
  trimActive: boolean;
  
  /**
   * Currently active trim handle ('start', 'end', or null)
   */
  activeHandle: 'start' | 'end' | null;
  
  /**
   * Callback when the time is updated (e.g., by scrubbing)
   */
  onTimeUpdate: (time: number) => void;
  
  /**
   * Callback when user starts dragging the scrubber
   */
  onScrubberDragStart: () => void;
  
  /**
   * Callback when user stops dragging the scrubber
   */
  onScrubberDragEnd: () => void;

  /**
   * Callback to set active trim handle (start/end)
   */
  setActiveHandle: (handle: 'start' | 'end' | null) => void;

  /**
   * Callback to set time before drag operation
   */
  setTimeBeforeDrag: (time: number) => void;

  /**
   * Callback to set original playback time
   */
  setOriginalPlaybackTime?: (time: number) => void;

  /**
   * Function to get effective trim end value
   */
  getEffectiveTrimEnd: () => number;

  /**
   * NEW: Callback fired continuously during scrubber drag (value 0-100)
   */
  onScrubberInput?: (newValue: number) => void;

  /**
   * NEW: Callback fired during left bracket drag (value 0-100)
   */
  onTrimStartInput?: (newValue: number) => void;

  /**
   * NEW: Callback fired during right bracket drag (value 0-100)
   */
  onTrimEndInput?: (newValue: number) => void;

  className?: string; // Add optional className prop
}

/**
 * TimelineControl - Component handling timeline scrubber and trim brackets
 * 
 * This component handles the display and interaction with the video timeline,
 * including the progress bar and trim brackets. Time display is handled separately.
 */
export function TimelineControl({
  visualTime,
  duration,
  trimStart,
  effectiveTrimEnd,
  activeHandle,
  trimActive,
  isDraggingScrubber,
  onTimeUpdate,
  onScrubberDragStart,
  onScrubberDragEnd,
  setActiveHandle,
  setTimeBeforeDrag,
  setOriginalPlaybackTime,
  getEffectiveTrimEnd,
  onScrubberInput,
  onTrimStartInput,
  onTrimEndInput,
  className
}: TimelineControlProps) {
  const scrubberRef = useRef<HTMLInputElement>(null);
  
  // Convert time (seconds) to percentage for the range input
  const timeToPercent = (time: number): number => {
    return duration > 0 ? (time / duration) * 100 : 0;
  };
  
  // Convert percentage from range input to time (seconds)
  const percentToTime = (percent: number): number => {
    return (percent / 100) * duration;
  };
  
  // Calculate percentages for positioning
  const currentPercent = timeToPercent(visualTime);
  const trimStartPercent = timeToPercent(trimStart);
  const trimEndPercent = timeToPercent(getEffectiveTrimEnd());
  
  // Logging for debugging
  console.log(`[TimelineControl] Rendering with trimActive=${trimActive}, trimStart=${trimStart}, trimEnd=${getEffectiveTrimEnd()}, duration=${duration}`);
  
  return (
    <div className={`relative ${className || ''}`}>
      <div className="relative h-8 flex items-center">
        {/* Background track */}
        <div
          className="absolute inset-0 h-2 bg-gray-700 rounded-full cursor-pointer"
          style={{
            top: '50%',
            transform: 'translateY(-50%)'
          }}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full bg-blue-500 rounded-full pointer-events-none"
            style={{ width: `${currentPercent}%` }}
          />
          
          {/* Trim start area (grayed out) */}
          {trimActive && (
            <div
              className="absolute top-0 left-0 h-full bg-black/50 pointer-events-none"
              style={{ 
                width: `${trimStartPercent}%`,
                display: trimActive ? 'block' : 'none'
              }}
            />
          )}
          
          {/* Trim end area (grayed out) */}
          {trimActive && (
            <div
              className="absolute top-0 right-0 h-full bg-black/50 pointer-events-none"
              style={{ 
                left: `${trimEndPercent}%`,
                width: `${100 - trimEndPercent}%`,
                display: trimActive ? 'block' : 'none'
              }}
            />
          )}
          
          {/* Visual scrubber indicator */}
          <div
            className="absolute top-1/2 w-3 h-3 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none shadow-md"
            style={{ left: `${currentPercent}%` }}
          />
        </div>
        
        {/* Native range input (fully covers the track, transparent) */}
        <input
          ref={scrubberRef}
          type="range"
          min="0"
          max="100"
          step="0.01"
          value={currentPercent}
          className="absolute w-full h-8 cursor-pointer opacity-0"
          style={{ 
            pointerEvents: activeHandle ? 'none' : 'auto',
            zIndex: 5
          }}
          data-testid="timeline-scrubber"
          data-drag-handle-exclude="true"
          onMouseDown={(e) => {
            console.log("[TimelineControl] Scrubber onMouseDown triggered");
            e.stopPropagation();
            if (!activeHandle) {
              onScrubberDragStart();
            }
          }}
          onChange={(e) => {
            if (activeHandle) return;
            const newPercent = parseFloat(e.target.value);
            const newTime = percentToTime(newPercent);
            onTimeUpdate(newTime);
          }}
          onInput={(e) => {
            // New onInput handler for continuous drag events
            const newValue = parseFloat((e.target as HTMLInputElement).value);
            if (onScrubberInput) {
              onScrubberInput(newValue);
            }
          }}
          onMouseUp={() => {
            if (!activeHandle) onScrubberDragEnd();
          }}
          onMouseLeave={() => {
            if (isDraggingScrubber && !activeHandle) onScrubberDragEnd();
          }} 
        />
      </div>
      
      {/* Trim brackets */}
      {trimActive && duration > 0 && (
        <>
          {/* Left trim bracket */}
          <div 
            className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize"
            style={{ 
              left: `${trimStartPercent}%`,
              zIndex: 10,
              height: '100%'
            }}
            data-drag-handle-exclude="true"
            data-testid="trim-start-bracket"
              onMouseDown={(e) => {
                e.stopPropagation();
                console.log("[Trim Bracket] Left Handle MouseDown");
                setActiveHandle('start');
              setTimeBeforeDrag(visualTime);
                if (setOriginalPlaybackTime) {
                setOriginalPlaybackTime(visualTime);
                }
              }}
<<<<<<< HEAD
          >
            <div className="bg-blue-500 w-0.5 h-4" />
=======
              onChange={(e) => {
                e.stopPropagation();
              }}
              onInput={(e) => {
                e.stopPropagation();
                const newValue = parseFloat((e.target as HTMLInputElement).value);
                if (onTrimStartInput) {
                  onTrimStartInput(newValue);
                }
              }}
              data-testid="trim-start-range"
              data-drag-handle-exclude="true"
            />
            {/* Visual bracket overlay */}
            <div 
              className="absolute w-0.5 bg-blue-500"
              style={{ 
                left: '6px',
                top: '1px', // Adjust visual indicator slightly
                height: '14px',
                pointerEvents: 'none',
                boxShadow: 'none',
              }}
            />
>>>>>>> 95457d0
          </div>
              
          {/* Right trim bracket */}
          <div 
            className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-ew-resize"
            style={{ 
              left: `${trimEndPercent}%`,
              zIndex: 10,
              height: '100%'
            }}
            data-drag-handle-exclude="true"
            data-testid="trim-end-bracket"
              onMouseDown={(e) => {
                e.stopPropagation();
                console.log("[Trim Bracket] Right Handle MouseDown");
                setActiveHandle('end');
              setTimeBeforeDrag(visualTime);
                if (setOriginalPlaybackTime) {
                setOriginalPlaybackTime(visualTime);
                }
              }}
<<<<<<< HEAD
          >
            <div className="bg-blue-500 w-0.5 h-4" />
=======
              onChange={(e) => {
                e.stopPropagation();
              }}
              onInput={(e) => {
                e.stopPropagation();
                const newValue = parseFloat((e.target as HTMLInputElement).value);
                if (onTrimEndInput) {
                  onTrimEndInput(newValue);
                }
              }}
              data-testid="trim-end-range"
              data-drag-handle-exclude="true"
            />
            {/* Visual bracket overlay */}
            <div 
              className="absolute w-0.5 bg-blue-500"
              style={{ 
                left: '6px',
                top: '1px', // Adjust visual indicator slightly
                height: '14px', 
                pointerEvents: 'none',
                boxShadow: 'none',
              }}
            />
>>>>>>> 95457d0
          </div>
        </>
      )}
    </div>
  );
} 