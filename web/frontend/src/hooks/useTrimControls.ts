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
  timeBeforeDrag: number | null;
  setTimeBeforeDrag: Dispatch<SetStateAction<number | null>>;
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
  const [timeBeforeDrag, setTimeBeforeDrag] = useState<number | null>(null);
  
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
      setTrimStart(initialTrimStart);
      // Only update trimEnd from prop if it's not the default (0) or if duration is available
      if (initialTrimEnd !== 0 || initialDuration > 0) {
          setTrimEnd(initialTrimEnd || initialDuration);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTrimStart, initialTrimEnd, initialDuration]); // Rerun if props change

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