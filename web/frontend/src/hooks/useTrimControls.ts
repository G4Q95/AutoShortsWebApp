import { useState, useRef, useCallback, useEffect } from 'react';
import type { RefObject } from 'react';

// --- Define Props --- 
// Remove dependencies needed only by handlers/effects for now
// Add dependencies needed for the handlers we are moving in
interface UseTrimControlsProps {
  initialTrimStart: number;
  initialTrimEnd: number;
  initialDuration: number;
  // Dependencies for handlers:
  containerRef: RefObject<HTMLDivElement | null>;
  duration: number; // Need current duration
  videoContext: any; // Need VideoContext for seeking
  audioRef?: RefObject<HTMLAudioElement | null>; // Allow null
  isPlaying?: boolean; // Optional playing state
  onTrimChange?: (start: number, end: number) => void; // Callback prop
  setVisualTime: React.Dispatch<React.SetStateAction<number>>; // State setters from parent
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  forceResetOnPlayRef: RefObject<boolean>; // Ref from parent
}

// --- Define Return Type ---
// Return state values AND their setters
// Also return the handlers
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
  // Moved handlers:
  handleTrimDragMove: (event: MouseEvent) => void;
  handleTrimDragEnd: () => void;
}

// --- Hook Implementation ---
export function useTrimControls({
  initialTrimStart,
  initialTrimEnd,
  initialDuration,
  // Destructure new props
  containerRef,
  duration,
  videoContext,
  audioRef,
  isPlaying,
  onTrimChange,
  setVisualTime,
  setCurrentTime,
  setIsPlaying,
  forceResetOnPlayRef
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
  // --- Handlers (MOVED IN FOR PHASE 2) ---
  const handleTrimDragMove = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Use activeHandle from hook state
    if (!activeHandle || !containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const percentPosition = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const newTime = (percentPosition / 100) * duration;
    let visualUpdateTime = newTime;

    if (activeHandle === 'start') {
      const newStart = Math.max(0, Math.min(newTime, trimEnd - 0.1));
      setTrimStart(newStart); // Use hook setter
      if (onTrimChange) onTrimChange(newStart, trimEnd); // Use prop callback
      visualUpdateTime = newStart;
      // Seek video only if context available
      if (videoContext) videoContext.currentTime = visualUpdateTime;
      // NOTE: Removed audioRef seeking during drag for performance/simplicity
    } else { // activeHandle === 'end'
      const newEnd = Math.min(duration, Math.max(newTime, trimStart + 0.1));
      setTrimEnd(newEnd); // Use hook setter
      userTrimEndRef.current = newEnd; // Update ref directly here
      if (onTrimChange) onTrimChange(trimStart, newEnd); // Use prop callback
      visualUpdateTime = newEnd;
      // Seek video only if context available
      if (videoContext) videoContext.currentTime = visualUpdateTime; 
      // NOTE: Removed audioRef seeking during drag for performance/simplicity
    }

    setVisualTime(visualUpdateTime); // Use setter from props
    setTrimManuallySet(true); // Use setter from hook state

  }, [
    activeHandle, containerRef, duration, trimEnd, trimStart, // State from hook
    onTrimChange, videoContext, // Props
    setTrimStart, setTrimEnd, userTrimEndRef, setTrimManuallySet, // Setters/refs from hook
    setVisualTime // Setter from props
  ]);

  const handleTrimDragEnd = useCallback(() => {
    // Use activeHandle from hook state
    if (!activeHandle) return;
    
    const wasHandleActive = activeHandle;
    setActiveHandle(null); // Use setter from hook state
    document.body.style.cursor = 'default';

    const currentValidTrimStart = trimStart; // Use state from hook
    
    if (wasHandleActive === 'end') {
        // Use callbacks/refs/setters from props
        console.warn(`[TrimDragEnd Hook] Right handle released. Forcing pause...`);
        setIsPlaying(false); 
        forceResetOnPlayRef.current = true; 
        
        // Seek video if available
        if (videoContext) videoContext.currentTime = currentValidTrimStart;
        setCurrentTime(currentValidTrimStart); 
        setVisualTime(currentValidTrimStart); 
    } else {
      // Use ref from props
      forceResetOnPlayRef.current = false; 
    }
    
    setTimeBeforeDrag(0); // Use setter from hook state
    
  }, [
    activeHandle, trimStart, // State from hook
    setActiveHandle, setTimeBeforeDrag, // Setters from hook
    videoContext, setIsPlaying, forceResetOnPlayRef, setCurrentTime, setVisualTime // Updated Props
  ]);

  // --- Listener Effect (MOVED IN FOR PHASE 3) ---
  useEffect(() => {
    // Only attach listeners if a handle is active
    if (!activeHandle) return;

    const ownerDocument = containerRef.current?.ownerDocument || document;

    // Use the handlers defined within this hook
    const moveHandler = (e: MouseEvent) => handleTrimDragMove(e);
    const endHandler = () => handleTrimDragEnd();

    ownerDocument.body.style.cursor = 'ew-resize';
    ownerDocument.addEventListener('mousemove', moveHandler);
    ownerDocument.addEventListener('mouseup', endHandler);
    ownerDocument.addEventListener('mouseleave', endHandler);

    return () => {
      // Cleanup listeners
      ownerDocument.removeEventListener('mousemove', moveHandler);
      ownerDocument.removeEventListener('mouseup', endHandler);
      ownerDocument.removeEventListener('mouseleave', endHandler);
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