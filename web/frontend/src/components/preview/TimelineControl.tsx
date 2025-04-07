import React, { useRef, ChangeEvent, MouseEvent } from 'react';

// Define the structure for the hook's props
interface TimelineControlProps {
  visualTime: number;
  duration: number;
  trimStart: number;
  effectiveTrimEnd: number;
  activeHandle: 'start' | 'end' | null;
  trimActive: boolean;
  
  // Callbacks for native input events (REQUIRED)
  onScrubberInput: (newTime: number) => void;
  onTrimStartInput: (newStartTime: number) => void;
  onTrimEndInput: (newEndTime: number) => void;
  
  // State management callbacks (REQUIRED)
  onScrubberDragStart: () => void; 
  onScrubberDragEnd: () => void;
  onTrimHandleMouseDown: (handle: 'start' | 'end') => void;
  onTrimHandleMouseUp: () => void;

  // Utility functions/data passed down (if still needed)
  getEffectiveTrimEnd: () => number; 
  
  // Optional styling
  className?: string; 
  
  // Obsolete props - REMOVED
  // onTimeUpdate?: (newTime: number) => void; 
  // setActiveHandle?: (handle: 'start' | 'end' | null) => void; 
  // setTimeBeforeDrag?: (time: number) => void;
  // isDraggingScrubber?: boolean; // State managed via handlers now
}

/**
 * TimelineControl - Uses native HTML input ranges for precise dragging.
 */
export function TimelineControl({
  // Destructure ONLY the props defined above
  visualTime,
  duration,
  trimStart,
  effectiveTrimEnd,
  activeHandle,
  trimActive,
  onScrubberInput,
  onTrimStartInput,
  onTrimEndInput,
  onScrubberDragStart,
  onScrubberDragEnd,
  onTrimHandleMouseDown,
  onTrimHandleMouseUp,
  getEffectiveTrimEnd,
  className
}: TimelineControlProps) {
  const timelineContainerRef = useRef<HTMLDivElement>(null);

  // Convert time position (0 to duration) to percentage (0 to 100)
  const positionToPercent = (position: number): number => {
    return duration > 0 ? (position / duration) * 100 : 0;
  };
  
  // Convert percentage (0 to 100) from input value to time position (0 to duration)
  const percentValueToPosition = (percentValue: string | number): number => {
     const percent = typeof percentValue === 'string' ? parseFloat(percentValue) : percentValue;
     return (percent / 100) * duration;
  };

  // --- Native Input Event Handlers ---
  const handleMainScrubberInput = (event: ChangeEvent<HTMLInputElement>) => {
    const newTime = percentValueToPosition(event.target.value);
    onScrubberInput(newTime); // Pass calculated time to parent
  };
  
  const handleTrimStartRangeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const newStartTime = percentValueToPosition(event.target.value);
    // Add clamping relative to end handle if needed, or let parent handle it
    onTrimStartInput(newStartTime); 
  };

  const handleTrimEndRangeInput = (event: ChangeEvent<HTMLInputElement>) => {
    const newEndTime = percentValueToPosition(event.target.value);
    // Add clamping relative to start handle if needed, or let parent handle it
    onTrimEndInput(newEndTime);
  };
  
  // Mouse down/up handlers just manage state via props now
  const handleMainScrubberMouseDown = (event: MouseEvent<HTMLInputElement>) => {
     event.stopPropagation(); // Prevent interfering with other potential listeners
     if (!activeHandle) {
       onScrubberDragStart();
     }
  };
  
  const handleMainScrubberMouseUp = () => {
    if (!activeHandle) { // Check if activeHandle needed here or just isDraggingScrubber
       onScrubberDragEnd();
    }
  };
  
   const handleTrimStartMouseDown = (event: MouseEvent<HTMLInputElement>) => {
     event.stopPropagation();
     onTrimHandleMouseDown('start');
   };
   
   const handleTrimEndMouseDown = (event: MouseEvent<HTMLInputElement>) => {
     event.stopPropagation();
     onTrimHandleMouseDown('end');
   };
   
   // Unified mouse up for trim handles
   const handleAnyTrimMouseUp = () => {
     onTrimHandleMouseUp();
   };
  // --- End Native Input Handlers ---

  const mainScrubberPercent = positionToPercent(visualTime);
  const trimStartPercent = positionToPercent(trimStart);
  const trimEndPercent = positionToPercent(effectiveTrimEnd);

  return (
    <div 
       className={`relative h-4 ${className || ''}`}
       ref={timelineContainerRef}
     > 
      {/* 1. Background Track (Visual Only) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 w-full h-1 rounded-lg bg-gray-700"
        style={{ pointerEvents: 'none', zIndex: 50 }} 
      />
      
      {/* 2. Progress Fill (Visual Only) */}
      <div 
        className="absolute top-1/2 -translate-y-1/2 left-0 h-1 rounded-lg bg-blue-500"
        style={{ 
            width: `${mainScrubberPercent}%`, 
            pointerEvents: 'none', 
            zIndex: 51 
        }}
      />
      
      {/* 3. Main Scrubber (Visible Input Range) */}
      <input
        type="range"
        min="0"
        max="100"
        step="any"
        value={mainScrubberPercent}
        className={`absolute top-0 left-0 w-full h-full appearance-none bg-transparent small-thumb ${activeHandle ? 'pointer-events-none opacity-50' : 'cursor-pointer'}`}
        style={{ 
            zIndex: 55,
            pointerEvents: activeHandle ? 'none' : 'auto',
            margin: 0,
            padding: 0
        }}
        data-testid="timeline-scrubber"
        onInput={handleMainScrubberInput}
        onMouseDown={handleMainScrubberMouseDown}
        onMouseUp={handleMainScrubberMouseUp}
      />
      
      {/* 4. Trim Controls (Only if trimActive) */}
      {trimActive && duration > 0 ? (
        <>
          {/* Left Bracket Visual Handle */}
          <div 
            className="absolute top-0 h-full w-3"
            style={{ 
              left: `${trimStartPercent}%`,
              transform: 'translateX(-50%)',
              zIndex: 60,
              pointerEvents: 'none',
            }}
            data-testid="trim-start-visual"
          >
            <div className="w-0.5 h-full bg-blue-500 mx-auto" />
          </div>
          
          {/* Left Bracket Hidden Input Range */}
          <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={trimStartPercent}
            className="absolute top-0 h-full appearance-none bg-transparent w-4"
            style={{
              left: `${trimStartPercent}%`,
              transform: 'translateX(-50%)',
              zIndex: 61,
              opacity: 0,
              pointerEvents: 'auto',
              cursor: 'ew-resize'
            }}
            onInput={handleTrimStartRangeInput}
            onMouseDown={handleTrimStartMouseDown}
            onMouseUp={handleAnyTrimMouseUp}
            data-testid="trim-start-input"
          />

          {/* Right Bracket Visual Handle */}
          <div 
            className="absolute top-0 h-full w-3" 
            style={{ 
              left: `${trimEndPercent}%`,
              transform: 'translateX(-50%)', 
              zIndex: 60, 
              pointerEvents: 'none',
            }}
            data-testid="trim-end-visual"
          >
             <div className="w-0.5 h-full bg-blue-500 mx-auto" />
          </div>
          
          {/* Right Bracket Hidden Input Range */}
           <input
            type="range"
            min="0"
            max="100"
            step="any"
            value={trimEndPercent}
            className="absolute top-0 h-full appearance-none bg-transparent w-4"
            style={{
              left: `${trimEndPercent}%`,
              transform: 'translateX(-50%)', 
              zIndex: 61, 
              opacity: 0, 
              pointerEvents: 'auto', 
              cursor: 'ew-resize'
            }}
            onInput={handleTrimEndRangeInput}
            onMouseDown={handleTrimEndMouseDown}
            onMouseUp={handleAnyTrimMouseUp}
            data-testid="trim-end-input"
          />
          
          {/* Gray overlay for trimmed areas */}
          <div 
             className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-black bg-opacity-50 rounded-l-lg"
             style={{ width: `${trimStartPercent}%`, zIndex: 52, pointerEvents: 'none' }}
           />
           <div 
             className="absolute top-1/2 -translate-y-1/2 right-0 h-1 bg-black bg-opacity-50 rounded-r-lg"
             style={{ width: `${100 - trimEndPercent}%`, zIndex: 52, pointerEvents: 'none' }}
           />
        </>
      ) : null}
    </div>
  );
} 