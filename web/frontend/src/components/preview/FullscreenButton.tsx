import React from 'react';
import { Maximize2 as FullscreenIcon, Minimize2 as ExitFullscreenIcon } from 'lucide-react';

// Props interface for the FullscreenButton component
interface FullscreenButtonProps {
  /**
   * Whether the player is currently in fullscreen mode
   */
  isFullscreen: boolean;
  
  /**
   * Callback function to toggle fullscreen mode
   */
  onToggle: () => void;
}

/**
 * FullscreenButton - Toggles the player's fullscreen state
 * 
 * This button switches between fullscreen and normal view modes.
 * It's positioned in the top-right corner of the player.
 */
export function FullscreenButton({ isFullscreen, onToggle }: FullscreenButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="absolute top-0 right-px bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70 transition-opacity"
      style={{
        zIndex: 100, // Use a very high z-index to ensure it's above all other elements
        pointerEvents: 'auto' // Explicitly ensure it captures pointer events
      }}
      data-testid="fullscreen-toggle"
      title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
    >
      {isFullscreen ? (
        <ExitFullscreenIcon className="h-4 w-4" />
      ) : (
        <FullscreenIcon className="h-4 w-4" />
      )}
    </button>
  );
} 