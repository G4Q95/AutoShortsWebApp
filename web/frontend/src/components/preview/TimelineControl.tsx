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
export const TimelineControl: React.FC<TimelineControlProps> = React.memo(({
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
}: TimelineControlProps) => {
  const timelineRef = useRef<HTMLInputElement>(null);
  
  const timelineValueToPosition = (value: number): number => {
    // When trim handles are being dragged, use current visualTime
    if (activeHandle) {
      return visualTime; // Return the visualTime parameter
    }
    // Check if duration is valid and positive
    if (!duration || duration <= 0) {
      return 0; // Return 0 if duration is invalid
    }
    const position = (value / 100) * duration;
    return position;
  };
  
  const positionToTimelineValue = (position: number): number => {
    // Check if duration is valid and positive
    if (!duration || duration <= 0) {
      return 0; // Return 0 if duration is invalid
    }
    // When activeHandle is true, use the visualTime passed to the component
    if (activeHandle) {
      // Also check duration here to prevent NaN
      return (visualTime / duration) * 100; 
    }
    const value = (position / duration) * 100;
    return value;
  };
  
  console.log(`[TimelineControl] Rendering with trimActive=${trimActive}, trimStart=${trimStart}, trimEnd=${effectiveTrimEnd}, duration=${duration}`);
  
  return (
    <div className={`relative ${className || ''}`}> {/* Removed mb-1 */} 
      {/* Main timeline scrubber container */}
      <div className="flex items-center px-1 relative" 
          data-drag-handle-exclude="true"
          style={{ zIndex: 51, pointerEvents: 'auto', height: '16px' /* Ensure container has height */ }}>
        {/* Timeline scrubber input */}
        <input
          ref={timelineRef}
          type="range"
          min="0"
          max="100"
          value={positionToTimelineValue(visualTime)}
          className={`w-full h-1 rounded-lg appearance-none cursor-pointer bg-gray-700 small-thumb ${activeHandle ? 'pointer-events-none' : ''}`}
          style={{ 
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${positionToTimelineValue(visualTime)}%, #4b5563 ${positionToTimelineValue(visualTime)}%, #4b5563 100%)`,
            height: '4px',
            opacity: activeHandle ? 0.4 : 1, 
            WebkitAppearance: 'none',
            appearance: 'none',
            zIndex: 52,
            pointerEvents: activeHandle ? 'none' : 'auto'
          }}
          data-testid="timeline-scrubber"
          data-drag-handle-exclude="true"
          onMouseDown={(e) => {
            console.log("[TimelineControl DEBUG] Scrubber onMouseDown triggered.");
            e.stopPropagation();
            if (!activeHandle) {
              console.log("[TimelineControl DEBUG] Calling onScrubberDragStart().");
              onScrubberDragStart();
            }
          }}
          onChange={(e) => {
            const newValue = parseFloat(e.target.value);
            const newTime = timelineValueToPosition(newValue);
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
            if (!activeHandle) onScrubberDragEnd();
          }} 
        />
      </div>
      
      {/* Trim brackets (position relative to the container above) */}
      {duration > 0 ? (
        <>
          {/* Left trim bracket */}
          <div 
            className="absolute"
            style={{ 
              left: `calc(${(trimStart / duration) * 100}% - 6px)`,
              top: '0px', // Position relative to the scrubber container
              height: '16px', // Match container height
              width: '12px',
              zIndex: 53,
              pointerEvents: trimActive ? 'auto' : 'none',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            data-drag-handle-exclude="true"
            data-testid="trim-start-bracket"
          >
            {/* Range input */}
            <input
              type="range"
              min="0"
              max="100"
              step="any"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize trim-bracket-range"
              aria-hidden="true"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.stopPropagation();
                console.log("[Trim Bracket] Left Handle MouseDown");
                setActiveHandle('start');
                // Need currentTime passed in if we want to set this properly
                setTimeBeforeDrag(visualTime); // Use visualTime as fallback?
                if (setOriginalPlaybackTime) {
                  // Need currentTime passed in
                  setOriginalPlaybackTime(visualTime); // Use visualTime as fallback?
                }
              }}
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
              className={`absolute w-0.5 ${trimActive ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ 
                left: '6px',
                top: '1px', // Adjust visual indicator slightly
                height: '14px',
                pointerEvents: 'none',
                boxShadow: 'none',
              }}
            />
          </div>
              
          {/* Right trim bracket */}
          <div 
            className="absolute"
            style={{ 
              left: `calc(${(getEffectiveTrimEnd() / duration) * 100}% - 6px)`,
              top: '0px', // Position relative to the scrubber container
              height: '16px', // Match container height
              width: '12px',
              zIndex: 53,
              pointerEvents: trimActive ? 'auto' : 'none',
              opacity: 1,
              transition: 'opacity 0.2s ease'
            }}
            data-drag-handle-exclude="true"
            data-testid="trim-end-bracket"
          >
            {/* Range input */}
            <input
              type="range"
              min="0"
              max="100"
              step="any"
              className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize trim-bracket-range"
              aria-hidden="true"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.stopPropagation();
                console.log("[Trim Bracket] Right Handle MouseDown");
                setActiveHandle('end');
                // Need currentTime passed in if we want to set this properly
                setTimeBeforeDrag(visualTime); // Use visualTime as fallback?
                if (setOriginalPlaybackTime) {
                  // Need currentTime passed in
                  setOriginalPlaybackTime(visualTime); // Use visualTime as fallback?
                }
              }}
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
              className={`absolute w-0.5 ${trimActive ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ 
                left: '6px',
                top: '1px', // Adjust visual indicator slightly
                height: '14px', 
                pointerEvents: 'none',
                boxShadow: 'none',
              }}
            />
          </div>
        </>
      ) : (
        <div style={{display: 'none'}} data-testid="trim-controls-hidden">
          Trim controls hidden - duration: {duration.toFixed(2)}
        </div>
      )}
    </div>
  );
});

// Optional: Add display name
TimelineControl.displayName = 'TimelineControl'; 