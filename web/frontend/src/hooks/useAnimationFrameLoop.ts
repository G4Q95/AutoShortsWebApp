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
  videoContext?: any;
  audioRef?: React.RefObject<HTMLAudioElement | null>;
  isDraggingScrubber?: boolean;
  userTrimEndRef?: React.MutableRefObject<number | null>;
}

/**
 * Return type for the useAnimationFrameLoop hook
 */
interface UseAnimationFrameLoopReturn {
  // For now, we're not returning anything, just managing side effects
}

/**
 * useAnimationFrameLoop - Custom Hook for Managing Animation Frame Loop
 * 
 * This hook encapsulates the requestAnimationFrame loop logic for media playback,
 * handling both video and image playback timing, boundary checks, and time updates.
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
  videoContext,
  audioRef,
  isDraggingScrubber = false,
  userTrimEndRef
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
        
        // Call onUpdate to reset the component's time state
        onUpdate(startTime);
        
        // Reset media elements if available
        if (videoContext) {
          try { 
            videoContext.currentTime = startTime; 
          } catch(e) { 
            console.warn("[rAF Reset] Error setting video context time:", e); 
          }
        }
        
        if (audioRef?.current) {
          try { 
            audioRef.current.currentTime = startTime; 
          } catch(e) { 
            console.warn("[rAF Reset] Error setting audio time:", e); 
          }
        }
        
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
      
      // Calculate the new time based on media type
      let newTime = 0;
      
      if (isImageType) {
        // For images, increment time manually
        const effectiveEnd = userTrimEndRef?.current ?? trimEnd;
        newTime = Math.min(currentTime + 1 / 60, effectiveEnd);
      } else if (videoContext) {
        // For videos, read time from VideoContext
        newTime = videoContext.currentTime;
      }
      
      // Call onUpdate with the new time
      // The callback should update state in the parent component
      onUpdate(newTime);
      
      // Handle end of media boundary
      const actualTrimEndCheck = userTrimEndRef?.current ?? trimEnd;
      if (newTime >= actualTrimEndCheck) {
        // Set the reset flag for next play command
        forceResetOnPlayRef.current = true;
        
        // Call onPause to stop playback
        onPause();
        
        // Update time to the end position
        onUpdate(actualTrimEndCheck);
        
        return; // Stop the loop
      } else if (newTime < trimStart) {
        // Handle case where time somehow got behind trimStart
        if (videoContext) {
          try { 
            videoContext.currentTime = trimStart; 
          } catch(e) { 
            console.warn("[rAF SeekForward] Error setting video context time:", e); 
          }
        }
        
        // Update time to the start position
        onUpdate(trimStart);
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
    videoContext,
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
    userTrimEndRef
  ]);
  
  // Return empty object for now
  return {};
} 