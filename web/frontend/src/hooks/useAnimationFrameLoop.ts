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
  onUpdate: (newTime: number, isDraggingScrubber: boolean) => void; 
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
  justResetRef: React.MutableRefObject<boolean>;
  isResumingRef: React.MutableRefObject<boolean>;
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
 * - Synchronizes media elements (videoContext, audio) with current time
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
 *   currentTime,
 *   trimStart,
 *   trimEnd,
 *   onUpdate: (newTime) => setCurrentTime(newTime),
 *   onPause: handlePause,
 *   isImageType: mediaType === 'image',
 *   animationFrameRef,
 *   forceResetOnPlayRef,
 *   videoContext
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
  videoContext,
  audioRef,
  isDraggingScrubber = false,
  userTrimEndRef,
  justResetRef,
  isResumingRef,
}: UseAnimationFrameLoopProps): UseAnimationFrameLoopReturn {
  // Internal ref to track active state across renders
  const isActiveRef = useRef(true);
  // Ref to track playing state for use in the rAF callback
  const isPlayingRef = useRef(isPlaying);
  // Ref to track the last animation frame timestamp for calculating delta time
  const lastFrameTimeRef = useRef<number>(0);
  // Ref to track the last video context time to detect changes
  const lastVideoContextTimeRef = useRef<number>(0);
  
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
      const isFirstResumeFrame = isResumingRef.current;
      if (isFirstResumeFrame) {
        isResumingRef.current = false; // Consume the flag
      }
      
      // Add diagnostic logging
      if (videoContext && typeof videoContext.getCurrentTime === 'function') {
        // Only log every 2 seconds for readability
        if (Math.floor(currentTime) % 2 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
          console.log(`[rAF Diagnostic] videoContext.getCurrentTime=${videoContext.getCurrentTime().toFixed(3)}, currentTime=${currentTime.toFixed(3)}, isPlaying=${isPlayingRef.current}, isReady=${isReady}`);
        }
      } else {
        // Only log every 2 seconds for readability
        if (Math.floor(currentTime) % 2 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
          console.log(`[rAF Diagnostic] No videoContext time. currentTime=${currentTime.toFixed(3)}, isPlaying=${isPlayingRef.current}, isReady=${isReady}`);
        }
      }
      
      // Handle reset flag if set
      if (forceResetOnPlayRef.current) {
        const startTime = trimStart;
        console.log(`[rAF] Force reset flag is TRUE. Resetting time to trimStart: ${startTime.toFixed(3)}`);
        
        // Call onUpdate to reset the component's time state
        onUpdate(startTime, isDraggingScrubber);
        
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
      
      // Get elapsed time since last frame
      const now = performance.now();
      const lastFrameTime = lastFrameTimeRef.current || now;
      const deltaTime = (now - lastFrameTime) / 1000; // convert to seconds
      lastFrameTimeRef.current = now;
      
      // Calculate new time value: Prioritize reading VideoContext, fallback to manual increment.
      let newTime = currentTime; // Start with previous state time
      const vcTime = videoContext && typeof videoContext.getCurrentTime === 'function' 
        ? videoContext.getCurrentTime() 
        : videoContext?.currentTime;
      
      // Add diagnosis for vcTime
      if (typeof vcTime === 'undefined' || vcTime === null) {
        if (Math.floor(currentTime) % 2 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
          console.log(`[rAF Debug] Video context time undefined. Using manual increment. videoContext:`, 
            videoContext ? typeof videoContext.getCurrentTime : 'null');
        }
      }

      if (typeof vcTime === 'number' && !isNaN(vcTime)) {
        // Always use the time from VideoContext if it's available
        newTime = vcTime;
        lastVideoContextTimeRef.current = vcTime; // Update the last read time
        
        // For debugging video updates
        if (Math.floor(vcTime) !== Math.floor(lastVideoContextTimeRef.current) && 
            Math.abs(vcTime - lastVideoContextTimeRef.current) > 0.5) {
          console.log(`[rAF] VideoContext time updated: ${vcTime.toFixed(3)}`);
        }
      } else {
        // VideoContext time not available, use manual increment for UI smoothness
        newTime = currentTime + deltaTime;
        
        // If we get here and isPlaying is true, we should check if video element exists but is hidden
        if (isPlayingRef.current && videoContext && 
            typeof videoContext.video?.style === 'object') {
          // Log visibility issue no more than once per second
          if (Math.floor(currentTime) !== Math.floor(lastFrameTimeRef.current / 1000)) {
            console.log(`[rAF] Video visibility check: display=${videoContext.video.style.display}, visibility=${videoContext.video.style.visibility}`);
            
            // Fix visibility if needed
            if (videoContext.video.style.display === 'none' || 
                videoContext.video.style.visibility === 'hidden') {
              console.log('[rAF] Fixing video visibility...');
              videoContext.video.style.display = 'block';
              videoContext.video.style.visibility = 'visible';
              
              // If there's a canvas, check if it's blocking the video
              if (videoContext.canvas && videoContext.canvas.style.display === 'block') {
                videoContext.canvas.style.display = 'none';
              }
            }
          }
        }
      }
      
      // Check justResetRef before processing boundary
      if (justResetRef.current) {
        console.log(`[rAF] Ignoring first update after reset (currentTime: ${newTime.toFixed(3)}). Resetting justResetRef.`);
        justResetRef.current = false; // Consume the flag
        // Still update state even when ignoring boundaries after reset
        onUpdate(newTime, isDraggingScrubber); // Pass dragging state
      } else {
        // ** CALL onUpdate for CONTINUOUS TIME UPDATES **
        onUpdate(newTime, isDraggingScrubber); // Pass dragging state
        
        // Handle end of media boundary
        const actualTrimEndCheck = userTrimEndRef?.current ?? trimEnd;
        if (newTime >= actualTrimEndCheck) {
          // Set the reset flag for next play command
          forceResetOnPlayRef.current = true;
          console.log(`[rAF] Playback reached trimEnd (${actualTrimEndCheck.toFixed(3)}). Setting forceReset flag.`);
          
          // Call onPause to stop playback
          onPause();
          
          // Update time to the end position
          onUpdate(actualTrimEndCheck, isDraggingScrubber); // << KEEP: Force time to boundary
          
          return; // Stop the loop
        } else if (newTime < trimStart) {
          // Handle case where time somehow got behind trimStart
          console.warn(`[DEBUG][rAF Boundary] newTime (${newTime.toFixed(3)}) < trimStart (${trimStart.toFixed(3)}). Forcing to trimStart.`); // LOG
          if (videoContext) {
            try { 
              videoContext.currentTime = trimStart; 
            } catch(e) { 
              console.warn("[rAF SeekForward] Error setting video context time:", e); 
            }
          }
          
          // Update time to the start position
          onUpdate(trimStart, isDraggingScrubber); // << KEEP: Force time to boundary
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
      
      // *** FIX: Reset last frame time on start/resume ***
      lastFrameTimeRef.current = performance.now(); // Reset timer for delta calculation
      
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
    userTrimEndRef,
    justResetRef,
    isResumingRef
  ]);
  
  // Return empty object for now
  return {};
}