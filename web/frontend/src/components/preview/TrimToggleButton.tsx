import React from 'react';
import { ScissorsIcon, CheckIcon } from 'lucide-react';

interface TrimToggleButtonProps {
  isActive: boolean;
  onToggle: () => void;
}

/**
 * TrimToggleButton - A simple button to toggle trim mode on/off
 * This component only handles the button UI and click event
 * It does not contain any logic related to the trim brackets themselves
 */
export function TrimToggleButton({ isActive, onToggle }: TrimToggleButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="text-white hover:opacity-100 focus:outline-none"
      data-testid="toggle-trim-button"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
    >
      {isActive ? (
        <CheckIcon className="w-3 h-3" />
      ) : (
        <ScissorsIcon className="w-3 h-3" />
      )}
    </button>
  );
} 