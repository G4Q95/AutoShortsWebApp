import React from 'react';
import { LockClosedIcon, LockOpenIcon } from '@heroicons/react/24/solid';

interface LockButtonProps {
  isLocked: boolean;
  onToggle: () => void;
}

/**
 * LockButton - A button component to toggle a locked/unlocked state.
 */
export function LockButton({ isLocked, onToggle }: LockButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="text-gray-400 hover:text-white transition-colors p-1 rounded"
      aria-label={isLocked ? "Unlock scene position" : "Lock scene position"}
      title={isLocked ? "Unlock scene position (allow drag)" : "Lock scene position (prevent drag)"}
    >
      {isLocked ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
    </button>
  );
} 