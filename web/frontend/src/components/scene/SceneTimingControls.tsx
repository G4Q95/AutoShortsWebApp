/**
 * SceneTimingControls component
 * Provides controls for adjusting scene duration and timing
 */
import React, { useState } from 'react';
import { Clock } from 'lucide-react';
import { formatDuration } from '../../lib/utils';

interface SceneTimingControlsProps {
  /**
   * The current duration of the scene in seconds (can be from media or audio)
   */
  duration: number;
  
  /**
   * Callback function for when duration changes
   * @param duration The new duration in seconds
   */
  onDurationChange: (duration: number) => void;
  
  /**
   * Optional minimum duration in seconds (default: 1)
   */
  minDuration?: number;
  
  /**
   * Optional maximum duration in seconds (default: 60)
   */
  maxDuration?: number;
  
  /**
   * Optional initial duration for new scenes in seconds (default: 5)
   */
  defaultDuration?: number;
  
  /**
   * Additional className to apply to the component
   */
  className?: string;
}

/**
 * A component for managing scene timing and duration
 */
export const SceneTimingControls: React.FC<SceneTimingControlsProps> = ({
  duration,
  onDurationChange,
  minDuration = 1,
  maxDuration = 60,
  defaultDuration = 5,
  className = '',
}) => {
  // Local state for the duration input
  const [localDuration, setLocalDuration] = useState<string>(duration.toString());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  
  // Handle increment/decrement duration by 1 second
  const adjustDuration = (amount: number) => {
    const newDuration = Math.max(minDuration, Math.min(maxDuration, duration + amount));
    onDurationChange(newDuration);
  };
  
  // Handle direct input of duration
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalDuration(e.target.value);
  };
  
  // When input loses focus, validate and commit the change
  const handleDurationBlur = () => {
    let newDuration = parseFloat(localDuration);
    
    // Handle invalid inputs
    if (isNaN(newDuration) || newDuration < minDuration) {
      newDuration = minDuration;
    } else if (newDuration > maxDuration) {
      newDuration = maxDuration;
    }
    
    setLocalDuration(newDuration.toString());
    onDurationChange(newDuration);
    setIsEditing(false);
  };
  
  // Handle key press in input field
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleDurationBlur();
    } else if (e.key === 'Escape') {
      setLocalDuration(duration.toString());
      setIsEditing(false);
    }
  };
  
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center text-gray-600">
        <Clock className="w-4 h-4 mr-1" />
        <span className="text-xs font-medium">Duration:</span>
      </div>
      
      {isEditing ? (
        <div className="relative flex items-center">
          <input
            type="number"
            value={localDuration}
            onChange={handleDurationChange}
            onBlur={handleDurationBlur}
            onKeyDown={handleKeyDown}
            className="w-16 h-6 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            min={minDuration}
            max={maxDuration}
            step="0.5"
            autoFocus
            data-testid="duration-input"
          />
          <span className="absolute right-10 text-xs text-gray-500">s</span>
        </div>
      ) : (
        <div 
          className="flex items-center cursor-pointer hover:bg-gray-100 rounded px-2 py-1"
          onClick={() => setIsEditing(true)}
          data-testid="duration-display"
        >
          <span className="text-sm font-medium">{formatDuration(duration)}</span>
        </div>
      )}
      
      <div className="flex items-center space-x-1">
        <button
          onClick={() => adjustDuration(-1)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"
          title="Decrease duration by 1 second"
          data-testid="decrease-duration-button"
        >
          <span className="text-lg font-bold">-</span>
        </button>
        <button
          onClick={() => adjustDuration(1)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-700"
          title="Increase duration by 1 second"
          data-testid="increase-duration-button"
        >
          <span className="text-lg font-bold">+</span>
        </button>
      </div>
      
      <button
        onClick={() => onDurationChange(defaultDuration)}
        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
        title={`Reset to default duration (${defaultDuration}s)`}
        data-testid="reset-duration-button"
      >
        Reset
      </button>
    </div>
  );
}; 