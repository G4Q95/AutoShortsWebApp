import React from 'react';
import { Maximize, Minimize } from 'lucide-react';

interface ViewModeToggleButtonProps {
  /**
   * Whether the view is compact or expanded
   */
  isCompactView: boolean;
  
  /**
   * Handler for view mode toggle
   */
  onToggleViewMode: () => void;
}

/**
 * Button component for toggling between compact and expanded view modes
 * Designed to be placed within MediaContainer for proper stacking context
 */
export function ViewModeToggleButton({ isCompactView, onToggleViewMode }: ViewModeToggleButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation(); // Prevent click from bubbling up
        onToggleViewMode();
      }}
      className="absolute top-9 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70 transition-opacity"
      style={{
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