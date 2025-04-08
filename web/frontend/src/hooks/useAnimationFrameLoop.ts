import { useEffect, useRef } from 'react';

/**
 * Props for the useAnimationFrameLoop hook
 */
interface UseAnimationFrameLoopProps {
  // Core control props
  isPlaying: boolean;
  isReady: boolean;
  
  // Time management
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  
  // Update callbacks
  onUpdate: (newTime: number) => void; 
  onPause: () => void;
  
  // Media type flag
  isImageType: boolean;
  
  // Refs that will be controlled by the hook
  animationFrameRef: React.MutableRefObject<number | null>;
  forceResetOnPlayRef: React.MutableRefObject<boolean>;
  
  // Optional additional references needed for specific media types
  bridge?: any;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  isDraggingScrubber?: boolean;
  userTrimEndRef?: React.MutableRefObject<number | null>;
  justResetRef: React.MutableRefObject<boolean>;
}

/**
 * Return type for the useAnimationFrameLoop hook
 */
interface UseAnimationFrameLoopReturn {
  // Currently nothing is returned as the hook manages side effects only
}

/**
 * useAnimationFrameLoop - Custom Hook for Managing Animation Frame Loop
 * 
 * This hook encapsulates the requestAnimationFrame loop logic used for tracking and updating
 * media playback time. It handles both video and image media types, with appropriate timing logic
 * for each. The hook also manages playback boundaries, time synchronization, and cleanup.
 * 
 * Key features:
 * - Handles requestAnimationFrame setup and cleanup
 * - Manages different time update strategies for video vs image content
 * - Enforces trim boundaries (start/end times)
 * - Handles time reset when forceResetOnPlayRef is true
 * - Synchronizes media elements (bridge.videoContext, audio) with current time
 * - Provides time updates through callback for parent component state management
 * 
 * @param props Configuration object for the animation frame loop
 * @returns Empty object (the hook primarily manages side effects)
 * 
 * @example
 * // Basic usage
 * useAnimationFrameLoop({
 *   isPlaying, 
 *   isReady,
 *   currentTime: bridge.currentTime,
 *   trimStart,
 *   trimEnd,
 *   onUpdate: (newTime) => setCurrentTime(newTime),
 *   onPause: handlePause,
 *   isImageType: mediaType === 'image',
 *   animationFrameRef,
 *   forceResetOnPlayRef,
 *   bridge
 * });
 */
export function useAnimationFrameLoop({
  isPlaying,
  isReady,
  currentTime,
  trimStart,
  trimEnd,
  onUpdate,
  onPause,
  isImageType,
  animationFrameRef,
  forceResetOnPlayRef,
  bridge,
  audioRef,
  isDraggingScrubber = false,
  userTrimEndRef,
  justResetRef,
}: UseAnimationFrameLoopProps): UseAnimationFrameLoopReturn {
  // Internal ref to track active state across renders
  const isActiveRef = useRef(true);
  // Ref to track playing state for use in the rAF callback
  const isPlayingRef = useRef(isPlaying);
  
  // Sync ref with prop
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
  // Main effect for animation frame loop management
  useEffect(() => {
    // Mark as active when the effect runs
    isActiveRef.current = true;
    
    // Log the current state for debugging
    console.log(`[useAnimationFrameLoop] isPlaying=${isPlaying}, isReady=${isReady}`);
    
    // Define the update function for the animation frame
    const updateTime = () => {
      // Handle reset flag if set
      if (forceResetOnPlayRef.current) {
        const startTime = trimStart;
        console.log(`[rAF] Force reset flag is TRUE. Resetting time to trimStart: ${startTime.toFixed(3)}`);
        
        // Call onUpdate to reset the component's time state
        onUpdate(startTime);
        
        // Consume the flag
        forceResetOnPlayRef.current = false;
        
        // Continue to next frame if still playing
        if (isActiveRef.current && isPlayingRef.current) {
          animationFrameRef.current = requestAnimationFrame(updateTime);
        }
        return;
      }
      
      // Stop the loop if not active, not playing, or not ready
      if (!isActiveRef.current || !isPlayingRef.current || !isReady) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }
      
      // *** USE currentTime PROP for boundary checks ***
      // The timeupdate listener is handling the actual state advancement.
      // The loop only needs to check boundaries based on the current state.
      const newTime = bridge && typeof bridge.currentTime === 'number' ? bridge.currentTime : currentTime;
      
      // Check justResetRef before processing boundary
      if (justResetRef.current) {
        console.log(`[rAF] Ignoring first update after reset (currentTime: ${newTime.toFixed(3)}). Resetting justResetRef.`);
        justResetRef.current = false; // Consume the flag
      } else {
        // ** ONLY CALL onUpdate for BOUNDARY CHECKS, not every frame **
        // onUpdate(newTime); // COMMENTED OUT main update call
        
        // Handle end of media boundary
        const actualTrimEndCheck = userTrimEndRef?.current ?? trimEnd;
        if (newTime >= actualTrimEndCheck) {
          // Set the reset flag for next play command
          forceResetOnPlayRef.current = true;
          console.log(`[rAF] Playback reached trimEnd (${actualTrimEndCheck.toFixed(3)}). Setting forceReset flag.`);
          
          // Call onPause to stop playback
          onPause();
          
          // Update time to the end position
          onUpdate(actualTrimEndCheck); // << KEEP: Force time to boundary
          
          return; // Stop the loop
        } else if (newTime < trimStart) {
          // Handle case where time somehow got behind trimStart
          console.warn(`[DEBUG][rAF Boundary] newTime (${newTime.toFixed(3)}) < trimStart (${trimStart.toFixed(3)}). Forcing to trimStart.`); // LOG
          
          // UPDATED: Use bridge.seek instead of direct videoContext access
          if (bridge && typeof bridge.seek === 'function') {
            try { 
              bridge.seek(trimStart);
            } catch(e) { 
              console.warn("[rAF SeekForward] Error seeking using bridge:", e); 
            }
          }
          
          // Update time to the start position
          onUpdate(trimStart); // << KEEP: Force time to boundary
        }
      }
      
      // Continue the loop if still active and playing
      if (isActiveRef.current && isPlayingRef.current) {
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };
    
    // Start or stop the animation frame loop based on props
    if (isPlaying && isReady) {
      // Start the loop
      isPlayingRef.current = true;
      
      // Cancel any previous frame before starting a new one
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Request the first animation frame
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      // Stop the loop
      isPlayingRef.current = false;
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    // Cleanup function to stop the loop and mark inactive
    return () => {
      isActiveRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [
    // Dependencies for the rAF loop
    isPlaying, 
    isReady,
    bridge,
    trimStart, 
    trimEnd,
    currentTime,
    isDraggingScrubber,
    onUpdate,
    onPause,
    isImageType,
    audioRef,
    forceResetOnPlayRef,
    animationFrameRef,
    userTrimEndRef,
    justResetRef
  ]);
  
  // Return empty object for now
  return {};
} 