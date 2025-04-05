import { useState, useRef, useEffect, Dispatch, SetStateAction, MutableRefObject } from 'react';

interface UseTrimControlsProps {
  initialTrimStart: number;
  initialTrimEnd: number;
  initialDuration: number; // Needed to initialize trimEnd correctly
}

interface UseTrimControlsReturn {
  trimStart: number;
  setTrimStart: Dispatch<SetStateAction<number>>;
  trimEnd: number;
  setTrimEnd: Dispatch<SetStateAction<number>>;
  activeHandle: 'start' | 'end' | null;
  setActiveHandle: Dispatch<SetStateAction<'start' | 'end' | null>>;
  trimManuallySet: boolean;
  setTrimManuallySet: Dispatch<SetStateAction<boolean>>;
  userTrimEndRef: MutableRefObject<number | null>;
  timeBeforeDrag: number;
  setTimeBeforeDrag: Dispatch<SetStateAction<number>>;
}

/**
 * Custom hook to manage the state associated with video trimming controls.
 * This initial version only extracts the state variables and setters.
 * Handlers and effects remain in the component for now.
 *
 * @param initialTrimStart - The initial start trim time from props.
 * @param initialTrimEnd - The initial end trim time from props.
 * @param initialDuration - The initial media duration.
 * @returns An object containing trim-related state and setters.
 */
export const useTrimControls = ({
  initialTrimStart,
  initialTrimEnd,
  initialDuration, // Use initialDuration passed from component state
}: UseTrimControlsProps): UseTrimControlsReturn => {
  // State for trim values
  const [trimStart, setTrimStart] = useState<number>(initialTrimStart);
  // Ensure trimEnd is initialized correctly, defaulting to duration if 0 or undefined
  const [trimEnd, setTrimEnd] = useState<number>(initialTrimEnd || initialDuration);
  
  // State for tracking which handle is being dragged
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  
  // State to track if trim was manually set (might be removable later)
  const [trimManuallySet, setTrimManuallySet] = useState<boolean>(false);
  
  // Ref to store the user-intended end trim value during dragging
  const userTrimEndRef = useRef<number | null>(null);
  
  // State to store the time before starting a drag operation
  const [timeBeforeDrag, setTimeBeforeDrag] = useState<number>(0);
  
  // Effect to update trimEnd if initialDuration changes AFTER initial mount
  // and trimEnd hasn't been set yet (was 0).
  // This might be needed if duration loads async.
  useEffect(() => {
      if (initialDuration > 0 && trimEnd === 0) {
          setTrimEnd(initialDuration);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDuration]); // Only run when initialDuration becomes available

  // Effect to synchronize state if initial props change
  // This ensures the hook reflects external updates to the trim prop.
  useEffect(() => {
    console.log(`[useTrimControls Effect] Props changed: start=${initialTrimStart}, end=${initialTrimEnd}, duration=${initialDuration}`);
    setTrimStart(initialTrimStart);
    // Only update trimEnd from props if it's valid and user hasn't manually set it yet
    if (initialTrimEnd > 0 && !trimManuallySet) {
      console.log(`[useTrimControls Effect] Setting trimEnd from prop: ${initialTrimEnd}`);
      setTrimEnd(initialTrimEnd);
      // Update ref only if prop end is valid
      userTrimEndRef.current = initialTrimEnd; 
    } else if (initialDuration > 0 && !trimManuallySet && userTrimEndRef.current === null) {
      // If initialTrimEnd is 0/invalid, and duration becomes available, and user hasn't touched it, set end to duration
      console.log(`[useTrimControls Effect] Setting trimEnd to duration: ${initialDuration}`);
      setTrimEnd(initialDuration);
      userTrimEndRef.current = initialDuration;
    } else {
       console.log(`[useTrimControls Effect] Not updating trimEnd. Current value: ${trimEnd}, initialTrimEnd: ${initialTrimEnd}, initialDuration: ${initialDuration}, trimManuallySet: ${trimManuallySet}, userTrimEndRef: ${userTrimEndRef.current}`);
    }
  }, [initialTrimStart, initialTrimEnd, initialDuration]); // Rerun if initial values change

  console.log(`[useTrimControls Render] Values: start=${trimStart}, end=${trimEnd}, active=${activeHandle}, manuallySet=${trimManuallySet}, userEndRef=${userTrimEndRef.current}`);

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
}; 