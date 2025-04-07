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
      const newStart = Math.min(newTime, trimEnd - 0.1);
      console.log('[DEBUG][TrimDrag Start] Calculated newStart:', newStart.toFixed(3)); // LOG
      setTrimStart(newStart);
      
      // Update video currentTime to match the trim start
      console.log('[DEBUG][TrimDrag Start] Setting state: setCurrentTime/setVisualTime to', newStart.toFixed(3)); // LOG
      setCurrentTime(newStart);
      setVisualTime(newStart);
      
      // Also update video element directly if available
      if (videoRef.current) {
        try {
          console.log(`[DEBUG][TrimDrag Start] Attempting to set videoRef time to ${newStart.toFixed(3)}...`);
          videoRef.current.currentTime = newStart;
          console.log('[DEBUG][TrimDrag Start] videoRef time AFTER set:', videoRef.current.currentTime.toFixed(3));
        } catch (e) {
          console.error('[DEBUG][TrimDrag Start] Error setting video time:', e);
        }
      }
      
      // Update the video context if available
      if (videoContext) {
        try {
          console.log(`[DEBUG][TrimDrag Start] Attempting to set videoContext time to ${newStart.toFixed(3)}...`); // LOG
          videoContext.currentTime = newStart;
          // Reading context time immediately after setting might be unreliable, skip logging it here
        } catch (e) {
          console.error('[DEBUG][TrimDrag Start] Error setting videoContext time:', e);
        }
      }
      
      if (onTrimChange) {
        onTrimChange(newStart, trimEnd);
      }
    } else { // activeHandle === 'end'
      newEnd = Math.max(newTime, trimStart + 0.1); // Ensure end doesn't pass start
      newEnd = Math.min(duration, newEnd); // Ensure end doesn't exceed duration
      console.log(`[TrimDrag][End] Calculated newEnd: ${newEnd.toFixed(3)} (Current trimEnd: ${trimEnd.toFixed(3)}, userTrimEndRef: ${userTrimEndRef.current?.toFixed(3)})`);
      setTrimEnd(newEnd);
      userTrimEndRef.current = newEnd; // Update ref when manually dragging end handle
      
      // Update visual time AND actual video time
      setVisualTime(newEnd); 
      if (videoRef.current) {
        try {
          console.log(`[DEBUG][TrimDrag End] Attempting to set videoRef time to ${newEnd.toFixed(3)}...`);
          videoRef.current.currentTime = newEnd;
          console.log('[DEBUG][TrimDrag End] videoRef time AFTER set:', videoRef.current.currentTime.toFixed(3));
        } catch (e) {
          console.error('[DEBUG][TrimDrag End] Error setting video time:', e);
        }
      }
      if (videoContext) {
         try {
           console.log(`[DEBUG][TrimDrag End] Attempting to set videoContext time to ${newEnd.toFixed(3)}...`);
           videoContext.currentTime = newEnd;
         } catch (e) {
           console.error('[DEBUG][TrimDrag End] Error setting videoContext time:', e);
         }
      }
      // console.log(`[TrimDrag][End] Moved to: ${newEnd.toFixed(3)}s`);
    }
    
    // Pause playback while dragging
    if (isPlaying) {
      setIsPlaying(false);
    }

  }, [activeHandle, containerRef, duration, trimStart, trimEnd, videoRef, videoContext, audioRef, isPlaying, setIsPlaying, setVisualTime]);

  const handleTrimDragEnd = useCallback(() => {
    if (!activeHandle) return;
    console.log(`[TrimDragEnd START] Active: ${activeHandle}, Current Start: ${trimStart.toFixed(3)}, End: ${trimEnd.toFixed(3)}, Ref: ${userTrimEndRef.current?.toFixed(3)})`);
    // console.log(`[TrimDrag][${activeHandle}] Drag End. Final Start: ${trimStart.toFixed(3)}, End: ${trimEnd.toFixed(3)}`);
    setActiveHandle(null);
    setTrimManuallySet(true); // Mark trim as manually set after dragging
    console.log(`[useTrimControls] Setting trimManuallySet to TRUE in handleTrimDragEnd`);
    onTrimChange?.(trimStart, trimEnd);
    
    // --- Restore playback time AFTER drag --- 
    const restoreTime = trimStart;
    setCurrentTime(restoreTime);
    setVisualTime(restoreTime);
    if (videoContext) {
      try { videoContext.currentTime = restoreTime; } 
      catch(e) { console.warn("[TrimEnd] Error setting video context time:", e); }
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
      setCurrentTime, setVisualTime,
      videoContext, audioRef, containerRef, forceResetOnPlayRef
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
      // console.log("[TrimDrag][Global Move] Event Triggered");
      handleTrimDragMove(event);
    };
    const endHandler = () => {
      // console.log("[TrimDrag][Global Up/Leave] Event Triggered");
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
    // Return handlers
    handleTrimDragMove,
    handleTrimDragEnd,
  };
} 