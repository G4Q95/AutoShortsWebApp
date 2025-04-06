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
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="text-white hover:opacity-100 focus:outline-none"
      onMouseDown={(e) => e.stopPropagation()}
      style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
    >
      {isLocked ? <LockClosedIcon className="w-3 h-3" /> : <LockOpenIcon className="w-3 h-3" />}
    </button>
  );
} 