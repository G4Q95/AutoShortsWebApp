import React from 'react';
import { LockButton } from './LockButton';
import { TimeDisplay } from './TimeDisplay';
import { InfoButton } from './InfoButton';
import { TrimToggleButton } from './TrimToggleButton';
import { TimelineControl } from './TimelineControl';

// Define props based on the exact needs of the copied JSX
interface PlayerControlsProps {
  // Visibility Control
  isHovering: boolean;
  isPositionLocked: boolean;
  isMediumView: boolean;

  // Lock Button
  // isLocked prop is same as isPositionLocked
  onLockToggle: () => void;

  // Timeline Control
  visualTime: number;
  duration: number;
  trimStart: number;
  effectiveTrimEnd: number; // Note: Needs to be calculated/passed
  activeHandle: 'start' | 'end' | null;
  trimActive: boolean;
  getEffectiveTrimEnd: () => number; // Function to get the value

  // Time Display
  currentTime: number;

  // Info Button
  showAspectRatio: boolean;
  onInfoToggle: () => void;

  // Trim Toggle Button
  // Uses trimActive from above
  onTrimToggle: () => void;

  // New props
  isPlaying: boolean;
  isReady: boolean;

  // Native Input Callbacks
  onScrubberInput: (newTime: number) => void;
  onTrimStartInput: (newStartTime: number) => void;
  onTrimEndInput: (newEndTime: number) => void;
  onScrubberDragStart: () => void;
  onScrubberDragEnd: () => void;
  onTrimHandleMouseDown: (handle: 'start' | 'end') => void;
  onTrimHandleMouseUp: () => void;
  
  // Other handlers
  onPlayPauseToggle: () => void;

  // UI State
  isLocked: boolean;
  showLetterboxInfo: boolean;
  isCompactView: boolean;
  onLockButtonToggle: () => void;
  onFullscreenToggle: () => void;
}

export function PlayerControls({
  // Visibility props
  isHovering,
  isPositionLocked,
  isMediumView,
  // Lock Button
  onLockToggle,
  // Timeline props
  visualTime,
  duration,
  trimStart,
  effectiveTrimEnd,
  activeHandle,
  trimActive,
  getEffectiveTrimEnd,
  // Time Display props
  currentTime,
  // Info Button props
  showAspectRatio,
  onInfoToggle,
  // Trim Toggle Button props
  onTrimToggle,
  // New props
  isPlaying,
  isReady,
  // Native Input Callbacks
  onScrubberInput,
  onTrimStartInput,
  onTrimEndInput,
  onScrubberDragStart,
  onScrubberDragEnd,
  onTrimHandleMouseDown,
  onTrimHandleMouseUp,
  // Other handlers
  onPlayPauseToggle,
  // UI State
  isLocked,
  showLetterboxInfo,
  isCompactView,
  onLockButtonToggle,
  onFullscreenToggle,
}: PlayerControlsProps) {
  // Controls Overlay - updated to always show on hover regardless of view mode
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 transition-opacity duration-200 ${
        isHovering || isPositionLocked ? 'opacity-100' : 'opacity-0'
      }`}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 50, 
        pointerEvents: isHovering || isPositionLocked ? 'auto' : 'none', // Enable pointer events only when visible
        paddingTop: '0px',
        paddingRight: '8px',
        paddingBottom: '1px',
        paddingLeft: '8px',
        width: '100%',
        borderRadius: '4px',
      }}
      data-drag-handle-exclude="true"
    >
      {/* Re-add Wrapper div for relative positioning */}
      <div style={{ position: 'relative', top: '5px' }}> 
        {/* Timeline Control (Scrubber + Brackets) */}
        <TimelineControl
          visualTime={visualTime}
          duration={duration}
          trimStart={trimStart}
          effectiveTrimEnd={effectiveTrimEnd}
          activeHandle={activeHandle}
          trimActive={trimActive}
          onScrubberInput={onScrubberInput}
          onTrimStartInput={onTrimStartInput}
          onTrimEndInput={onTrimEndInput}
          onScrubberDragStart={onScrubberDragStart}
          onScrubberDragEnd={onScrubberDragEnd}
          onTrimHandleMouseDown={onTrimHandleMouseDown}
          onTrimHandleMouseUp={onTrimHandleMouseUp}
          getEffectiveTrimEnd={getEffectiveTrimEnd}
          className="flex-grow mx-2"
        />
      </div>

      {/* Control buttons row - Now includes Time Display */}
      <div className="flex justify-between items-center px-1 mt-1" /* Keep margin-top for spacing */
           data-drag-handle-exclude="true"
           style={{ position: 'relative', zIndex: 55, pointerEvents: 'auto' }}>

        {/* Left button section */}
        <div className="flex-shrink-0 w-14 flex justify-start items-center">
          <LockButton isLocked={isPositionLocked} onToggle={onLockToggle} />
        </div>

        {/* Center section: Time Display */}
        <TimeDisplay
          visualTime={visualTime}
          duration={duration}
          trimStart={trimStart}
          effectiveTrimEnd={effectiveTrimEnd}
          activeHandle={activeHandle}
        />

        {/* Right buttons section */}
        <div className="flex-shrink-0 w-14 flex justify-end items-center">
          <InfoButton
            isActive={showAspectRatio}
            onToggle={onInfoToggle} // Use prop directly
          />
          <TrimToggleButton
            isActive={trimActive}
            onToggle={onTrimToggle} // Use prop directly
          />
        </div>
      </div>
    </div>
  );
} 