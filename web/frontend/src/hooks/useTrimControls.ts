import { useState, useRef, useEffect, useCallback } from 'react';

// Define the structure for the hook's props
interface UseTrimControlsProps {
  initialTrimStart?: number;
  initialTrimEnd?: number;
  initialDuration?: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  duration: number;
  seek?: (time: number) => void; // Function to seek to a specific time using the bridge
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  onTrimChange?: (start: number, end: number) => void;
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
  seek,
  audioRef,
  isPlaying,
  onTrimChange,
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
  const handleTrimDragMove = useCallback((event: MouseEvent) => {
    if (!activeHandle || !containerRef.current || duration <= 0) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    let newTime = (x / rect.width) * duration;
    newTime = Math.max(0, Math.min(newTime, duration)); // Clamp within 0 to duration

    let newStart = trimStart;
    let newEnd = trimEnd;

    if (activeHandle === 'start') {
      // If dragging start handle
      newStart = Math.min(newTime, trimEnd - 0.1);
      setTrimStart(newStart);
      
      // Log direct manipulation
      console.log(`[TrimDrag Start] Setting video time to ${newStart.toFixed(3)}`);
      
      // Update video position through videoRef
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = newStart;
        } catch (e) {
          console.error('[DEBUG][TrimDrag Start] Error setting video time:', e);
        }
      }
      
      // Use the seek function instead of directly accessing videoContext
      if (seek) {
        seek(newStart);
      }
      
      if (onTrimChange) {
        onTrimChange(newStart, trimEnd);
      }
    } else { // activeHandle === 'end'
      newEnd = Math.max(newTime, trimStart + 0.1); // Ensure end doesn't pass start
      newEnd = Math.min(duration, newEnd); // Ensure end doesn't exceed duration
      setTrimEnd(newEnd);
      userTrimEndRef.current = newEnd; // Update ref when manually dragging end handle
      
      // Log direct manipulation
      console.log(`[TrimDrag End] Setting video time to ${newEnd.toFixed(3)}`);
      
      // Update video position through videoRef
      if (videoRef.current) {
        try {
          videoRef.current.currentTime = newEnd;
        } catch (e) {
          console.error('[DEBUG][TrimDrag End] Error setting video time:', e);
        }
      }
      
      // Use the seek function instead of directly accessing videoContext
      if (seek) {
        seek(newEnd);
      }
      
      if (onTrimChange) {
        onTrimChange(trimStart, newEnd);
      }
    }
    
    // Pause playback while dragging
    if (isPlaying) {
      setIsPlaying(false);
    }

  }, [activeHandle, containerRef, duration, trimStart, trimEnd, videoRef, seek, isPlaying, setIsPlaying, onTrimChange]);

  const handleTrimDragEnd = useCallback(() => {
    if (!activeHandle) return;
    setActiveHandle(null);
    setTrimManuallySet(true); // Mark trim as manually set after dragging
    onTrimChange?.(trimStart, trimEnd);
    
    // --- Restore playback time AFTER drag --- 
    const restoreTime = trimStart;
    // Use seek function instead of directly accessing videoContext
    if (seek) {
      seek(restoreTime);
    }
    if (audioRef.current) {
      try { audioRef.current.currentTime = restoreTime; } 
      catch(e) { console.warn("[TrimEnd] Error setting audio time:", e); }
    }
    // --- END Restore playback time --- 

    // Set the flag to force reset playback position on the next play command
    forceResetOnPlayRef.current = true; 

    // Reset cursor style
    if (containerRef.current?.ownerDocument) {
      containerRef.current.ownerDocument.body.style.cursor = 'default';
    }
  }, [
      activeHandle, trimStart, trimEnd, onTrimChange, 
      audioRef, containerRef, seek, forceResetOnPlayRef
  ]);

  // --- Global Listener Effect ---
  // Effect to add/remove global mouse listeners for dragging trim handles
  useEffect(() => {
    if (!activeHandle || !containerRef.current) return;

    const ownerDocument = containerRef.current.ownerDocument;
    if (!ownerDocument) return;

    // Change cursor while dragging
    ownerDocument.body.style.cursor = 'ew-resize';

    const moveHandler = (event: MouseEvent) => {
      handleTrimDragMove(event);
    };
    const endHandler = () => {
      handleTrimDragEnd();
    };

    ownerDocument.addEventListener('mousemove', moveHandler);
    ownerDocument.addEventListener('mouseup', endHandler);
    // Add mouseleave on the documentElement as a safety catch-all
    ownerDocument.documentElement.addEventListener('mouseleave', endHandler);

    return () => {
      ownerDocument.removeEventListener('mousemove', moveHandler);
      ownerDocument.removeEventListener('mouseup', endHandler);
      ownerDocument.documentElement.removeEventListener('mouseleave', endHandler);
      // Always reset cursor on cleanup for safety
      ownerDocument.body.style.cursor = 'default';
    };
    // Dependencies: The handlers defined in this hook and the state/props they depend on.
    // activeHandle is state internal to this hook.
    // containerRef is a prop.
  }, [activeHandle, handleTrimDragMove, handleTrimDragEnd, containerRef]);

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
    handleTrimDragMove,
    handleTrimDragEnd
  };
} 