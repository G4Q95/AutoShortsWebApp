import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';

// --- Define Props --- 
// Remove dependencies needed only by handlers/effects for now
interface UseTrimControlsProps {
  initialTrimStart: number;
  initialTrimEnd: number;
  initialDuration: number;
}

// --- Define Return Type ---
// Return state values AND their setters
interface UseTrimControlsReturn {
  trimStart: number;
  setTrimStart: React.Dispatch<React.SetStateAction<number>>;
  trimEnd: number;
  setTrimEnd: React.Dispatch<React.SetStateAction<number>>;
  activeHandle: 'start' | 'end' | null;
  setActiveHandle: React.Dispatch<React.SetStateAction<'start' | 'end' | null>>;
  trimManuallySet: boolean;
  setTrimManuallySet: React.Dispatch<React.SetStateAction<boolean>>;
  userTrimEndRef: RefObject<number | null>; // Keep ref accessible if needed
  timeBeforeDrag: number;
  setTimeBeforeDrag: React.Dispatch<React.SetStateAction<number>>;
}

// --- Hook Implementation ---
export function useTrimControls({
  initialTrimStart,
  initialTrimEnd,
  initialDuration // Keep initialDuration for setting initial trimEnd if needed
}: UseTrimControlsProps): UseTrimControlsReturn {
  // --- State Definitions --- 
  // Move state definitions here
  const [trimStart, setTrimStart] = useState<number>(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState<number>(initialTrimEnd > 0 ? initialTrimEnd : initialDuration); // Use initialDuration if initialTrimEnd is invalid
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [trimManuallySet, setTrimManuallySet] = useState<boolean>(false);
  const [timeBeforeDrag, setTimeBeforeDrag] = useState<number>(0);
  const userTrimEndRef = useRef<number | null>(initialTrimEnd > 0 ? initialTrimEnd : initialDuration); // Initialize ref too

  // --- Handlers & Effects (REMOVED FOR PHASE 1) ---
  // const handleTrimDragMove = useCallback(...); // REMOVED
  // const handleTrimDragEnd = useCallback(...); // REMOVED
  // useEffect(() => { ... listener effect ... }, [...]); // REMOVED

  // --- Return Values ---
  // Return state values AND their setters
  return {
    trimStart,
    setTrimStart,
    trimEnd,
    setTrimEnd,
    activeHandle,
    setActiveHandle,
    trimManuallySet,
    setTrimManuallySet,
    userTrimEndRef,
    timeBeforeDrag,
    setTimeBeforeDrag,
  };
} 