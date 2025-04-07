import { useState, useRef, useEffect, useCallback } from 'react';

// Define the structure for the hook's props
interface UseTrimControlsProps {
  initialTrimStart?: number;
  initialTrimEnd?: number;
  initialDuration?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  videoContext: any; // Type for VideoContext instance
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  onTrimChange?: (start: number, end: number) => void;
  setVisualTime: (time: number) => void; // Setter for visual representation
  setCurrentTime: (time: number) => void; // Setter for actual playback time
  setIsPlaying: (playing: boolean) => void; // Setter for play state
  forceResetOnPlayRef: React.MutableRefObject<boolean>;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

// Define the structure for the hook's return value
interface UseTrimControlsReturn {
  trimStart: number;
  setTrimStart: React.Dispatch<React.SetStateAction<number>>;
  trimEnd: number;
  setTrimEnd: React.Dispatch<React.SetStateAction<number>>;
  activeHandle: 'start' | 'end' | null;
  setActiveHandle: React.Dispatch<React.SetStateAction<'start' | 'end' | null>>;
  trimManuallySet: boolean;
  setTrimManuallySet: React.Dispatch<React.SetStateAction<boolean>>;
  userTrimEndRef: React.MutableRefObject<number | null>;
  timeBeforeDrag: number;
  setTimeBeforeDrag: React.Dispatch<React.SetStateAction<number>>;
  handleTrimDragMove: (event: MouseEvent) => void;
  handleTrimDragEnd: () => void;
}

/**
 * useTrimControls - Custom Hook for Managing Trim Handles and State
 *
 * Encapsulates the state and logic for trimming video/audio content,
 * including drag handlers and effect for global mouse listeners.
 */
export function useTrimControls({
  initialTrimStart = 0,
  initialTrimEnd = 0,
  initialDuration = 0,
  containerRef,
  duration,
  videoContext,
  audioRef,
  isPlaying,
  onTrimChange,
  setVisualTime,
  setCurrentTime,
  setIsPlaying,
  forceResetOnPlayRef,
  videoRef,
}: UseTrimControlsProps): UseTrimControlsReturn {
  // --- State Management ---
  const [trimStart, setTrimStart] = useState<number>(initialTrimStart);
  const [trimEnd, setTrimEnd] = useState<number>(initialTrimEnd);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [trimManuallySet, setTrimManuallySet] = useState<boolean>(false);
  const userTrimEndRef = useRef<number | null>(null);
  const [timeBeforeDrag, setTimeBeforeDrag] = useState<number>(0);

  // --- Effects ---
  // Update state if initial props change (e.g., loading new scene data)
  useEffect(() => {
    setTrimStart(initialTrimStart);
  }, [initialTrimStart]);

  useEffect(() => {
    if (initialTrimEnd > 0) {
      setTrimEnd(initialTrimEnd);
      // Initialize userTrimEndRef only if the initial value is valid
      if (userTrimEndRef.current === null || userTrimEndRef.current === 0) {
        userTrimEndRef.current = initialTrimEnd;
      }
    } else if (initialDuration > 0) {
      // Fallback to duration if initialTrimEnd is not set
      setTrimEnd(initialDuration);
      if (userTrimEndRef.current === null || userTrimEndRef.current === 0) {
        userTrimEndRef.current = initialDuration;
      }
    }
    // This effect should run when either initialTrimEnd or initialDuration changes,
    // but only update if the incoming values are valid.
  }, [initialTrimEnd, initialDuration]);

  // Update state based on calculated duration
  useEffect(() => {
    // Only update trimEnd based on duration if it hasn't been manually set
    // or if the initial prop didn't provide a valid value.
    if (duration > 0 && (trimEnd === 0 || trimEnd === 10) && !trimManuallySet) {
      setTrimEnd(duration);
      if (userTrimEndRef.current === null || userTrimEndRef.current === 0) {
        userTrimEndRef.current = duration;
      }
    }
  }, [duration, trimManuallySet, trimEnd]); // Depend on duration and trimManuallySet

  // --- Event Handlers ---
  // REMOVED handleTrimDragMove and the global listener useEffect
  // Native inputs in TimelineControl now handle the drag updates via props

  // This handler might still be needed if called by parent for some reason,
  // but its logic based on MouseEvent is obsolete. Keep stubbed for now.
  const handleTrimDragMove = useCallback((event: MouseEvent) => {
    // This logic is now handled by native onInput events in TimelineControl
    // console.warn("handleTrimDragMove called unexpectedly");
  }, []);

  // This handler might also be called by parent, keep stubbed.
  // Logic is now handled by native onMouseUp events in TimelineControl
  const handleTrimDragEnd = useCallback(() => {
    // This logic is now handled by native onMouseUp events in TimelineControl
    // console.warn("handleTrimDragEnd called unexpectedly");
     // If cleanup logic like resetting cursor is needed, it could go here
     // or be handled by the onTrimHandleMouseUp in the parent component.
     // Reset cursor style
     // if (containerRef.current?.ownerDocument) {
     //   containerRef.current.ownerDocument.body.style.cursor = 'default';
     // }
  }, []);

  // --- Global Listener Effect ---
  // REMOVED - Native inputs handle drag

  // --- Return Values ---
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
    // Return STUBBED handlers - they shouldn't be called by TimelineControl anymore
    handleTrimDragMove,
    handleTrimDragEnd, 
  };
} 