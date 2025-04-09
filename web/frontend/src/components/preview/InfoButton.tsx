import React from 'react';

// Info icon for aspect ratio display toggle
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

// Props interface for the InfoButton component
interface InfoButtonProps {
  /**
   * Whether the info display is currently active/visible
   */
  isActive: boolean;
  
  /**
   * Callback function to toggle the info display visibility
   */
  onToggle: () => void;
}

/**
 * InfoButton - Toggles the visibility of aspect ratio information
 * 
 * This button is used in the video player to show/hide technical information
 * about the media's aspect ratio, dimensions, and letterboxing.
 */
export function InfoButton({ isActive, onToggle }: InfoButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`text-white hover:opacity-100 focus:outline-none`}
      data-testid="toggle-aspect-ratio"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto', marginRight: '4px' }}
    >
      <InfoIcon />
    </button>
  );
} 