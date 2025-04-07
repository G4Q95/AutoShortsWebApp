import React from 'react';
import { Maximize, Minimize } from 'lucide-react';

// Props interface for the MediumViewButton component
interface MediumViewButtonProps {
  /**
   * Whether the player is currently in compact view mode
   */
  isCompactView: boolean;
  
  /**
   * Callback function to toggle between compact and expanded view modes
   */
  onToggle: () => void;
}

/**
 * MediumViewButton - Toggles between compact and expanded (medium) view modes
 * 
 * This button switches between a smaller compact view and a larger expanded view.
 * Unlike the FullscreenButton, this doesn't trigger browser fullscreen mode.
 */
export function MediumViewButton({ isCompactView, onToggle }: MediumViewButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70 transition-opacity"
      style={{
        zIndex: 100, // Use a very high z-index to ensure it's above all other elements
        pointerEvents: 'auto' // Explicitly ensure it captures pointer events
      }}
      data-testid="view-mode-toggle"
    >
      {isCompactView ? (
        <Maximize className="h-4 w-4" />
      ) : (
        <Minimize className="h-4 w-4" />
      )}
    </button>
  );
} 