/**
 * SceneTrimControls component
 * Provides an interface for adjusting the start and end points of media content
 */
import React, { useState, useRef, useEffect } from 'react';
import { Scissors } from 'lucide-react';

interface SceneTrimControlsProps {
  /**
   * The total duration of the media in seconds
   */
  duration: number;
  
  /**
   * The current trim start point in seconds
   */
  trimStart: number;
  
  /**
   * The current trim end point in seconds
   */
  trimEnd: number;
  
  /**
   * Callback function for when trim points change
   * @param start The new start point in seconds
   * @param end The new end point in seconds
   */
  onTrimChange: (start: number, end: number) => void;
  
  /**
   * NEW: Optional callback for when trim interaction *ends* (mouse up)
   */
  onTrimChangeEnd?: (start: number, end: number) => void;
  
  /**
   * Callback function for when the user seeks to a specific position
   * @param time The time in seconds to seek to
   */
  onSeek?: (time: number) => void;
  
  /**
   * The current playback position in seconds
   */
  currentTime?: number;
  
  /**
   * Additional className to apply to the component
   */
  className?: string;
}

/**
 * A component for trimming media content with draggable handles
 */
export const SceneTrimControls: React.FC<SceneTrimControlsProps> = ({
  duration,
  trimStart,
  trimEnd,
  onTrimChange,
  onTrimChangeEnd,
  onSeek,
  currentTime = 0,
  className = '',
}) => {
  // State for trim handles dragging
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | 'position' | null>(null);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  
  // NEW: Local state for trim values during drag
  const [localTrimStart, setLocalTrimStart] = useState<number>(trimStart);
  const [localTrimEnd, setLocalTrimEnd] = useState<number>(trimEnd);
  
  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  // Store drag state
  const dragStateRef = useRef<{
    handleOffset: number;  // Offset between mouse and handle center
  }>({ handleOffset: 0 });
  
  // Sync local state with props
  useEffect(() => {
    setLocalTrimStart(trimStart);
  }, [trimStart]);

  useEffect(() => {
    setLocalTrimEnd(trimEnd);
  }, [trimEnd]);
  
  // Set up event listeners for trim handle dragging
  useEffect(() => {
    // Track if we're dragging
    let isDragging = false;
    
    let currentStart = localTrimStart; // Use local state within listeners
    let currentEnd = localTrimEnd;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeHandle || !timelineRef.current) return;
      
      // Mark as dragging on first move
      isDragging = true;
      
      // Prevent default behaviors
      e.preventDefault();
      
      const rect = timelineRef.current.getBoundingClientRect();
      
      // Get exact mouse position relative to timeline boundaries
      const exactMousePosition = e.clientX - rect.left;
      
      // Convert to normalized position (0-1) - exact mouse position
      let position = exactMousePosition / rect.width;
      
      // Clamp position to [0, 1]
      position = Math.max(0, Math.min(position, 1));
      const newTime = position * duration;
      
      if (activeHandle === 'start') {
        if (newTime < currentEnd - 0.5) { // Use currentEnd
          setLocalTrimStart(newTime); // Update local state
          currentStart = newTime; // Update listener variable
          // Optionally call onTrimChange if immediate parent feedback is needed
          // onTrimChange(newTime, currentEnd);
        }
      } else if (activeHandle === 'end') {
        if (newTime > currentStart + 0.5) { // Use currentStart
          setLocalTrimEnd(newTime); // Update local state
          currentEnd = newTime;
          // Optionally call onTrimChange if immediate parent feedback is needed
          // onTrimChange(currentStart, newTime);
        }
      } else if (activeHandle === 'position' && onSeek) {
        // Handle current position indicator drag - use exact mouse position
        onSeek(newTime);
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // If we're not actually dragging, treat it as a click
      if (!isDragging && activeHandle === 'position' && onSeek && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const clickPosition = (e.clientX - rect.left) / rect.width;
        const newTime = Math.max(0, Math.min(clickPosition, 1)) * duration;
        onSeek(newTime);
      }
      
      // --- Call onTrimChangeEnd when drag finishes --- 
      if (isDragging && (activeHandle === 'start' || activeHandle === 'end')) {
        if (onTrimChangeEnd) {
          onTrimChangeEnd(currentStart, currentEnd); // Use final values from listener
        } else {
          // Fallback: Call original onTrimChange if onTrimChangeEnd is not provided
          onTrimChange(currentStart, currentEnd);
        }
      }
      // --- End of new logic --- 

      isDragging = false;
      setActiveHandle(null);
      document.body.style.cursor = 'default';
    };
    
    if (activeHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      // Set cursor style based on active handle
      if (activeHandle === 'start' || activeHandle === 'end') {
        document.body.style.cursor = 'ew-resize';
      } else if (activeHandle === 'position') {
        document.body.style.cursor = 'grabbing';
      }
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [activeHandle, duration, onTrimChange, onSeek, localTrimStart, localTrimEnd, onTrimChangeEnd]);
  
  // Handler for timeline clicks
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || activeHandle) return;
    
    // Stop propagation to prevent scene dragging
    e.stopPropagation();
    
    const rect = timelineRef.current.getBoundingClientRect();
    
    // Get exact mouse position relative to timeline boundaries
    const exactMousePosition = e.clientX - rect.left;
    
    // Convert to normalized position (0-1) - exact mouse position
    let clickPosition = exactMousePosition / rect.width;
    
    // Clamp position to [0, 1]
    clickPosition = Math.max(0, Math.min(clickPosition, 1));
    
    // Calculate time based on exact position
    const newTime = clickPosition * duration;
    
    // Update current time if onSeek is provided
    if (onSeek) {
      onSeek(newTime);
    }
  };
  
  // Handler for position indicator mouse down
  const handlePositionIndicatorMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Set active handle
    setActiveHandle('position');
  };
  
  // Handler for trim handle mouse down
  const handleTrimHandleMouseDown = (handle: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent timeline click
    setActiveHandle(handle);
  };
  
  // Toggle trim mode
  const toggleTrimMode = () => {
    setTrimActive(!trimActive);
  };
  
  // Helper function to format time
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Calculate trim duration
  const trimDuration = localTrimEnd - localTrimStart;
  
  return (
    <div className={`scene-trim-controls ${className}`} data-testid="scene-trim-controls">
      <div className="flex items-center mb-1 justify-between">
        <div className="text-xs text-gray-700 font-medium flex items-center">
          <button
            onClick={toggleTrimMode}
            className={`mr-1 p-0.5 rounded ${trimActive ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            aria-label={trimActive ? "Disable trim mode" : "Enable trim mode"}
            title={trimActive ? "Disable trim mode" : "Enable trim mode"}
            data-testid="toggle-trim-mode"
          >
            <Scissors className="h-3 w-3" />
          </button>
          <span>Trim: {formatTime(trimDuration)}</span>
        </div>
        <div className="text-xs text-gray-500">
          {formatTime(localTrimStart)} - {formatTime(localTrimEnd)}
        </div>
      </div>
      
      {/* Timeline with trim controls */}
      <div 
        ref={timelineRef}
        className="relative h-8 flex items-center cursor-pointer bg-gray-100 rounded-sm"
        onClick={handleTimelineClick}
        onMouseDown={(e) => e.stopPropagation()} // Prevent drag from reaching scene container
        data-testid="trim-timeline"
      >
        {/* Timeline track */}
        <div className="absolute w-full h-1 bg-gray-300 rounded-full"></div>
        
        {/* Active region between trim points */}
        <div 
          className={`absolute h-1 rounded-full ${trimActive ? 'bg-blue-400' : 'bg-red-400'}`}
          style={{ 
            left: `${(localTrimStart / duration) * 100}%`, 
            width: `${(localTrimEnd - localTrimStart) / duration * 100}%` 
          }}
          data-testid="active-trim-region"
        ></div>
        
        {/* Current position indicator */}
        {onSeek && (
          <div
            className="absolute w-4 h-6 bg-white border border-gray-400 rounded-sm cursor-grab z-10"
            style={{ 
              left: `${(currentTime / duration) * 100}%`, 
              transform: "translate(-50%, -1px)",  // Center the indicator on the position
              boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
            }}
            data-testid="position-indicator"
            onMouseDown={handlePositionIndicatorMouseDown}
          ></div>
        )}
        
        {/* Start trim handle */}
        <div 
          className={`absolute h-6 w-3 rounded-sm cursor-ew-resize z-20 ${trimActive ? 'bg-blue-500' : 'bg-red-500'}`}
          style={{ 
            left: `${(localTrimStart / duration) * 100}%`,
            transform: "translate(-50%, 0)",  // Center the handle on the position exactly
            top: '0',
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
          }}
          onMouseDown={(e) => handleTrimHandleMouseDown('start', e)}
          data-testid="trim-start-handle"
        >
        </div>
        
        {/* End trim handle */}
        <div 
          className={`absolute h-6 w-3 rounded-sm cursor-ew-resize z-20 ${trimActive ? 'bg-blue-500' : 'bg-red-500'}`}
          style={{ 
            left: `${(localTrimEnd / duration) * 100}%`,
            transform: "translate(-50%, 0)",  // Center the handle on the position exactly
            top: '0',
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)"
          }}
          onMouseDown={(e) => handleTrimHandleMouseDown('end', e)}
          data-testid="trim-end-handle"
        >
        </div>
        
        {/* Time markers */}
        <div className="absolute w-full flex justify-between px-1 text-[8px] text-gray-500 -bottom-4">
          <span>{formatTime(0)}</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}; 