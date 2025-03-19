/**
 * TrimControls - Component for adjusting media duration with trim handles
 * 
 * This component provides a UI for trimming the beginning and end of media content.
 */

import React, { useState, useEffect } from 'react';

interface TrimControlsProps {
  duration: number;
  trimStart: number;
  trimEnd: number;
  onChange: (start: number, end: number) => void;
  className?: string;
  compact?: boolean;
}

const TrimControls = ({
  duration,
  trimStart,
  trimEnd,
  onChange,
  className = '',
  compact = false,
}: TrimControlsProps) => {
  // State
  const [startPosition, setStartPosition] = useState<number>(trimStart);
  const [endPosition, setEndPosition] = useState<number>(trimEnd || duration);
  
  // Update positions when props change
  useEffect(() => {
    setStartPosition(trimStart);
    setEndPosition(trimEnd || duration);
  }, [trimStart, trimEnd, duration]);
  
  // Calculate percentages for UI
  const startPercent = (startPosition / duration) * 100;
  const endPercent = (endPosition / duration) * 100;
  const rangePercent = endPercent - startPercent;
  
  // Handle start trim change
  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseFloat(e.target.value);
    // Ensure start < end
    if (newStart < endPosition) {
      setStartPosition(newStart);
      onChange(newStart, endPosition);
    }
  };
  
  // Handle end trim change
  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = parseFloat(e.target.value);
    // Ensure end > start
    if (newEnd > startPosition) {
      setEndPosition(newEnd);
      onChange(startPosition, newEnd);
    }
  };
  
  // Format time (mm:ss)
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  return (
    <div className={`${compact ? 'p-2' : 'p-4'} ${className}`} data-testid="trim-controls">
      <div className="flex justify-between mb-2 text-white text-xs">
        <div>Trim Media</div>
        <div>Duration: {formatTime(endPosition - startPosition)}</div>
      </div>
      
      {/* Timeline visualization */}
      <div className={`relative ${compact ? 'h-6' : 'h-8'} bg-gray-700 rounded mb-2`} data-testid="trim-timeline">
        {/* Total duration bar */}
        <div className="absolute inset-0 rounded bg-gray-600"></div>
        
        {/* Selected range */}
        <div 
          className="absolute h-full bg-blue-500 rounded"
          style={{ 
            left: `${startPercent}%`, 
            width: `${rangePercent}%` 
          }}
          data-testid="trim-range"
        ></div>
        
        {/* Start handle */}
        <div 
          className="absolute h-full w-2 bg-white rounded-l cursor-ew-resize"
          style={{ left: `${startPercent}%` }}
          data-testid="trim-start-handle"
        ></div>
        
        {/* End handle */}
        <div 
          className="absolute h-full w-2 bg-white rounded-r cursor-ew-resize"
          style={{ left: `${endPercent}%` }}
          data-testid="trim-end-handle"
        ></div>
      </div>
      
      {/* Controls */}
      <div className="flex justify-between gap-2">
        {/* Start control */}
        <div className="flex-1">
          <div className="flex justify-between text-white text-xs mb-1">
            <label htmlFor="trim-start">Start</label>
            <span>{formatTime(startPosition)}</span>
          </div>
          <input
            id="trim-start"
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={startPosition}
            onChange={handleStartChange}
            className="w-full h-1.5 rounded-full bg-gray-600 appearance-none"
            data-testid="trim-start-input"
          />
        </div>
        
        {/* End control */}
        <div className="flex-1">
          <div className="flex justify-between text-white text-xs mb-1">
            <label htmlFor="trim-end">End</label>
            <span>{formatTime(endPosition)}</span>
          </div>
          <input
            id="trim-end"
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={endPosition}
            onChange={handleEndChange}
            className="w-full h-1.5 rounded-full bg-gray-600 appearance-none"
            data-testid="trim-end-input"
          />
        </div>
      </div>
      
      {/* Reset button */}
      <button
        onClick={() => onChange(0, duration)}
        className={`mt-2 px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-500`}
        data-testid="trim-reset-button"
      >
        Reset Trim
      </button>
    </div>
  );
};

export default TrimControls; 