import { useState, useEffect, useCallback, RefObject, useMemo } from 'react';

// TODO: Define actual types based on VideoContext and component needs
type VideoContextInstance = any; 

/**
 * Props for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeProps {
  // REMOVE: Actual VideoContext instance passed from the parent
  // videoContextInstance: VideoContextInstance | null;
  
  // Canvas reference for rendering
  canvasRef: RefObject<HTMLCanvasElement | null>;
  // ADD: Video element reference
  videoRef: RefObject<HTMLVideoElement | null>; 
  localMediaUrl?: string | null;
  mediaType: string;
  initialMediaAspectRatio?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
  // SIMPLIFY: Just report the duration, let parent handle trim logic
  onDurationChange?: (duration: number) => void;
}

/**
 * Return type for the useVideoContextBridge hook
 */
interface UseVideoContextBridgeReturn {
  // Video context instance and basic state
  videoContext: VideoContextInstance | null;
  isReady: boolean;
  duration: number;
  currentTime: number;
  
  // Core playback methods
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  
  // Source and initialization methods
  createVideoSourceNode: (ctx: VideoContextInstance) => any | null;
  prepareVideoContext: (baseSize?: number) => Promise<VideoContextInstance | null>;
  activeSource: any | null;
}

/**
 * useVideoContextBridge - Hook to abstract VideoContext interactions
 */
export function useVideoContextBridge({
  // REMOVE: videoContextInstance,
  canvasRef,
  videoRef,
  localMediaUrl,
  mediaType,
  initialMediaAspectRatio,
  onReady,
  onError,
  onDurationChange,
}: UseVideoContextBridgeProps): UseVideoContextBridgeReturn {
  
  // --- Internal State ---
  const [internalCtx, setInternalCtx] = useState<VideoContextInstance | null>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  // Add a reference to the created source node
  const [activeSource, setActiveSource] = useState<any | null>(null);

  // --- Methods (useCallbacks) ---
  // Helper function to check if media type is video
  const isVideoType = useCallback((type: string): boolean => {
    return type === 'video';
  }, []);
  
  // prepareVideoContext (modified slightly to be internal)
  const internalPrepareVideoContext = useCallback(async (baseSize: number = 1920): Promise<VideoContextInstance | null> => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.warn('[useVideoContextBridge Internal] Cannot prepare - canvas ref is null');
      return null;
    }
    try {
      console.log('[useVideoContextBridge Internal] Preparing context...');
      const VideoContextModule = await import('videocontext');
      const VideoContext = VideoContextModule.default || VideoContextModule;
      let canvasWidth: number, canvasHeight: number;
      const initialRatioForCanvas = initialMediaAspectRatio || (9 / 16);
      if (initialRatioForCanvas >= 1) {
        canvasWidth = baseSize; canvasHeight = Math.round(baseSize / initialRatioForCanvas);
      } else {
        canvasHeight = baseSize; canvasWidth = Math.round(baseSize * initialRatioForCanvas);
      }
      canvas.width = canvasWidth; canvas.height = canvasHeight;
      const ctx = new VideoContext(canvas);
      if (!ctx) throw new Error('Failed to create VideoContext instance');
      console.log('[useVideoContextBridge Internal] Context prepared successfully.');
      return ctx;
    } catch (error) {
      console.error('[useVideoContextBridge Internal] Error preparing context:', error);
      onError?.(error instanceof Error ? error : new Error('Internal VideoContext preparation failed'));
      return null;
    }
  }, [canvasRef, initialMediaAspectRatio, onError]); // Dependencies for preparing

  // internalCreateVideoSourceNode now just creates and returns the source
  const internalCreateVideoSourceNode = useCallback((ctx: VideoContextInstance) => {
    if (!isVideoType(mediaType) || !localMediaUrl || !ctx) {
      console.warn('[useVideoContextBridge Internal] Create source node conditions not met.');
      return null;
    }
    console.log(`[useVideoContextBridge Internal] Creating source node for: ${localMediaUrl}`);
    try {
      // Reset state for the new source attempt
      setIsReady(false);
      setDuration(0);

      const source = ctx.video(localMediaUrl);
      if (!source) throw new Error('Failed to create internal video source node');
      
      // Add detailed inspection of source node methods
      console.log('[VIDEOBRIDGE DEBUG] Source node created, inspecting properties:');
      console.log('[VIDEOBRIDGE DEBUG] source.connect exists:', typeof source.connect === 'function');
      console.log('[VIDEOBRIDGE DEBUG] source.start exists:', typeof source.start === 'function');
      console.log('[VIDEOBRIDGE DEBUG] source.stop exists:', typeof source.stop === 'function');
      console.log('[VIDEOBRIDGE DEBUG] source.play exists:', typeof source.play === 'function');
      console.log('[VIDEOBRIDGE DEBUG] source.pause exists:', typeof source.pause === 'function');
      
      try {
        // Method to inspect source internals
        console.log('[VIDEOBRIDGE DEBUG] source.element exists:', !!source.element);
        if (source.element) {
          const el = source.element as HTMLVideoElement;
          console.log('[VIDEOBRIDGE DEBUG] element.play exists:', typeof el.play === 'function');
          console.log('[VIDEOBRIDGE DEBUG] element.pause exists:', typeof el.pause === 'function');
        }
      } catch (e) {
        console.error('[VIDEOBRIDGE DEBUG] Error inspecting source element:', e);
      }

      source.connect(ctx.destination);
      source.start(0);
      source.stop(300); // Adjust as needed
      
      console.log('[useVideoContextBridge Internal] Source node INSTANCE created.');
      // Store the active source
      setActiveSource(source);
      return source; // Return the raw source node
      
    } catch (error) {
      console.error("[useVideoContextBridge Internal] Error creating source node instance:", error);
      setIsReady(false);
      setDuration(0);
      onError?.(error instanceof Error ? error : new Error('Internal source creation failed'));
      return null;
    }
  }, [localMediaUrl, mediaType, isVideoType, onError]); // Dependencies are only for creation itself

  // --- NEW: Internal Initialization Effect (Revised Structure) --- 
  useEffect(() => {
    console.log('[Bridge InitEffect] Running...');
    let isActive = true;
    let createdCtx: VideoContextInstance | null = null;
    let createdSource: any | null = null; // Hold source within effect scope

    const initialize = async () => {
      if (!isVideoType(mediaType) || !localMediaUrl || !canvasRef.current) {
        console.log('[Bridge InitEffect] Conditions not met, bailing out.');
        if (internalCtx) setInternalCtx(null);
        setIsReady(false);
        setDuration(0);
        return;
      }
      
      console.log('[Bridge InitEffect] Preparing internal context...');
      createdCtx = await internalPrepareVideoContext();

      if (!isActive || !createdCtx) {
        console.log(`[Bridge InitEffect] Bailing out after prepare (isActive: ${isActive}, createdCtx: ${!!createdCtx})`);
        if (createdCtx) { try { createdCtx.reset(); if (typeof createdCtx.dispose === 'function') createdCtx.dispose(); } catch (e) {} }
        return;
      }
      
      // Set the context state *before* creating the source that depends on it
      setInternalCtx(createdCtx);
      
      console.log('[Bridge InitEffect] Internal context set. Creating source node instance...');
      createdSource = internalCreateVideoSourceNode(createdCtx);

      if (!isActive || !createdSource) {
        console.log(`[Bridge InitEffect] Bailing out after source creation (isActive: ${isActive}, createdSource: ${!!createdSource})`);
        // If source creation failed, internalCreateVideoSourceNode already handled state reset/errors
        // If effect became inactive, context cleanup will happen below
        return;
      }

      console.log('[Bridge InitEffect] Registering callbacks on created source...');
      
      // Store the source in state so play/pause can access it
      setActiveSource(createdSource);
      
      // --- Register callbacks directly here --- 
      createdSource.registerCallback('loaded', () => {
          console.log("[Bridge InitEffect 'loaded'] Callback fired.");
          if (!isActive) { 
              console.warn("[Bridge InitEffect 'loaded'] Effect became inactive before processing.");
              return;
          }
          
          let videoDuration = 0;
          // Access the element from the source instance captured in this closure
          if (createdSource && createdSource.element) { 
              const videoElement = createdSource.element as HTMLVideoElement;
              videoDuration = videoElement.duration;
          }

          if (videoDuration && isFinite(videoDuration) && videoDuration > 0) {
              console.log(`[Bridge InitEffect 'loaded'] Valid duration: ${videoDuration}. Setting state.`);
              // Use setters from hook scope captured in closure
              setDuration(videoDuration);   
              // SIMPLIFY: Just call the callback with the duration
              onDurationChange?.(videoDuration);
              setIsReady(true);             
              onReady?.();
          } else {
              console.warn(`[Bridge InitEffect 'loaded'] Invalid duration (${videoDuration}). Not setting ready.`);
              setIsReady(false); // Ensure ready is false
              setDuration(0); // Ensure duration is 0
              // Optionally report error
              // onError?.(new Error(`Invalid video duration: ${videoDuration}`));
          }
      });

      createdSource.registerCallback('error', (err: any) => {
          console.error("[Bridge InitEffect 'error'] Callback fired:", err);
          if (!isActive) {
               console.warn("[Bridge InitEffect 'error'] Effect became inactive before processing.");
               return;
          }
          // Use setters from hook scope captured in closure
          setIsReady(false);          
          setDuration(0);             
          onError?.(err instanceof Error ? err : new Error('Internal video source error'));
      });

      console.log('[Bridge InitEffect] Callbacks registered.');
    };

    initialize();

    // Cleanup function
    return () => {
      console.log('[Bridge InitEffect] Cleanup running...');
      isActive = false;
      // Context cleanup (as before)
      const ctxToClean = createdCtx || internalCtx; 
      if (ctxToClean) {
        console.log('[Bridge InitEffect] Cleaning up internal context.');
        try {
          ctxToClean.reset(); // This should detach nodes
          if (typeof ctxToClean.dispose === 'function') {
             ctxToClean.dispose();
          }
          console.log('[Bridge InitEffect] Internal context cleanup successful.');
        } catch (error) {
          console.error('[Bridge InitEffect] Error during context cleanup:', error);
        }
      }
      // Explicitly nullify internal context state AFTER potential cleanup calls
      setInternalCtx(null); 
       
      // Reset other state - ensures next run starts clean
      setIsReady(false);
      setDuration(0);
      console.log('[Bridge InitEffect] Cleanup finished.');
    };
    // Dependencies: Now include the callbacks passed from parent
  }, [
      localMediaUrl, 
      mediaType, 
      canvasRef, 
      isVideoType, 
      internalPrepareVideoContext, 
      internalCreateVideoSourceNode, 
      onReady, // Add callback prop
      onError, // Add callback prop
      onDurationChange // Add callback prop
  ]); 

  // --- NEW: Effect to listen for time updates from context --- 
  useEffect(() => {
    // Get the raw video element
    const videoElement = videoRef.current;
    
    // Only run if we have a video element and the media type is video
    if (!videoElement || !isVideoType(mediaType)) return;

    const handleTimeUpdate = () => {
      // Read time directly from the video element
      if (videoElement && typeof videoElement.currentTime !== 'undefined') {
        // Update the internal hook state
        setCurrentTime(videoElement.currentTime);
        // console.log(`[Bridge TimeUpdate] New time from element: ${videoElement.currentTime.toFixed(3)}`); // DEBUG
      }
    };

    console.log("[Bridge TimeUpdate] Adding timeupdate listener to video element");
    // Use standard event listener on the video element
    videoElement.addEventListener('timeupdate', handleTimeUpdate);

    // Cleanup
    return () => {
      console.log("[Bridge TimeUpdate] Removing timeupdate listener from video element");
      // Use standard removeEventListener
      if (videoElement) {
        try {
          videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        } catch (e) {
          console.warn("[Bridge TimeUpdate] Error removing listener:", e);
        }
      }
    };

  }, [videoRef, isVideoType, mediaType, setCurrentTime]); // ADD videoRef and setCurrentTime, remove internalCtx

  // --- Playback Methods (using internalCtx or videoContextInstance?) ---
  // TODO: Decide whether these should operate on internalCtx or videoContextInstance
  // For now, let's keep them using videoContextInstance to minimize changes in the component
  // BUT, the component's videoContextInstance SHOULD eventually be driven BY this hook's internalCtx
  const play = useCallback(() => {
    console.log("[Bridge Play] Attempting to play...");
    // USE INTERNAL CONTEXT ONLY
    const targetCtx = internalCtx;
    
    // Since we confirmed source.play doesn't exist (from logs), use context directly
    if (targetCtx && typeof targetCtx.play === 'function') {
      try { 
        console.log("[Bridge Play] Playing through context directly...");
        
        // VideoContext API controls should go through the context itself
        if (targetCtx.currentTime !== undefined && targetCtx.state !== undefined) {
          console.log(`[Bridge Play] Context current state: time=${targetCtx.currentTime}, state=${targetCtx.state}`);
          
          // Make sure sources are allowed to start playing
          if (targetCtx.destination && typeof targetCtx.destination.gain !== 'undefined') {
            targetCtx.destination.gain.value = 1.0; // Ensure audio is on (if applicable)
          }
          
          // CRITICAL: Ensure the source node is actually started
          if (activeSource && typeof activeSource.start === 'function') {
            try {
              // Re-start the source if it's stopped
              console.log("[Bridge Play] Re-starting source node");
              activeSource.start(0);
              activeSource.connect(targetCtx.destination);
            } catch (e) {
              // Ignore - it might already be started
              console.log("[Bridge Play] Source already started:", e);
            }
          }
          
          // Force a render frame before starting playback
          if (typeof targetCtx.update === 'function') {
            try {
              console.log("[Bridge Play] Forcing initial render frame");
              targetCtx.update(targetCtx.currentTime);
            } catch (e) {
              console.warn("[Bridge Play] Error during initial frame render:", e);
            }
          }
          
          // Now start playback
          targetCtx.play(); 
          console.log("[Bridge Play] Context play() called successfully");
          
          // Force another render immediately after starting playback
          if (typeof targetCtx.update === 'function') {
            try {
              setTimeout(() => {
                if (targetCtx) {
                  console.log("[Bridge Play] Forcing first playback frame after 50ms");
                  targetCtx.update(targetCtx.currentTime);
                }
              }, 50);
            } catch (e) {
              console.warn("[Bridge Play] Error during delayed frame render:", e);
            }
          }
        }
      } catch (e) { 
        console.error("Bridge Play Error:", e); 
        const error = e instanceof Error ? e : new Error('Unknown playback error during play');
        onError?.(error); 
      }
    } else { 
      console.warn("Bridge Play: No valid context available"); 
    }
  }, [internalCtx, onError, activeSource]); // REMOVE videoContextInstance dependency

  const pause = useCallback(() => {
    console.log("[Bridge Pause] Attempting to pause...");
    // USE INTERNAL CONTEXT ONLY
    const targetCtx = internalCtx;
    
    // Since we confirmed source.pause doesn't exist (from logs), use context directly
    if (targetCtx && typeof targetCtx.pause === 'function') {
      try { 
        console.log("[Bridge Pause] Pausing through context directly...");
        targetCtx.pause(); 
        console.log("[Bridge Pause] Context pause() called successfully");
      } catch (e) { 
        console.error("Bridge Pause Error:", e); 
        const error = e instanceof Error ? e : new Error('Unknown playback error during pause');
        onError?.(error); 
      }
    } else { 
      console.warn("Bridge Pause: No valid context available"); 
    }
  }, [internalCtx, onError]); // REMOVE videoContextInstance dependency

  const seek = useCallback((time: number) => {
    const targetCtx = internalCtx;
    const targetVideo = videoRef.current; // Get video element

    // Try setting time on both context and video element
    let contextSet = false;
    let videoSet = false;

    if (targetCtx && typeof targetCtx.currentTime !== 'undefined') {
      try {
        const ctxDuration = targetCtx.duration || duration;
        const clampedTime = Math.max(0, Math.min(time, ctxDuration > 0 ? ctxDuration : Infinity));
        console.log(`[Bridge Seek] Seeking internal context to ${clampedTime.toFixed(3)} (requested: ${time.toFixed(3)})`);
        targetCtx.currentTime = clampedTime;
        contextSet = true;
      } catch (e) { 
        console.error("Bridge Seek (Context) Error:", e); 
        const error = e instanceof Error ? e : new Error('Unknown playback error during seek (context)');
        onError?.(error);
      }
    } else {
      console.warn(`[Bridge Seek] Context seek skipped: No context or currentTime. Time: ${time.toFixed(3)}`);
    }

    // ALSO set time on the raw video element
    if (targetVideo) {
      try {
        // Use the same clamped time calculation logic or derive from context if successful
        const videoDuration = targetVideo.duration;
        const clampedTime = Math.max(0, Math.min(time, isFinite(videoDuration) && videoDuration > 0 ? videoDuration : Infinity));
        console.log(`[Bridge Seek] Seeking video element to ${clampedTime.toFixed(3)} (requested: ${time.toFixed(3)})`);
        targetVideo.currentTime = clampedTime;
        videoSet = true;
        // ADDED: Directly update bridge state after setting video element
        setCurrentTime(clampedTime); 
      } catch (e) {
         console.error("Bridge Seek (Video Element) Error:", e); 
         const error = e instanceof Error ? e : new Error('Unknown playback error during seek (video element)');
         onError?.(error);
      }
    } else {
       console.warn(`[Bridge Seek] Video element seek skipped: videoRef is null.`);
    }

    // Optional: Log if either failed?
    if (!contextSet || !videoSet) {
        console.warn(`[Bridge Seek] Seek incomplete (context: ${contextSet}, video: ${videoSet})`);
    }

  }, [internalCtx, duration, onError, videoRef, setCurrentTime]); // ADD setCurrentTime dependency


  // --- Memoize the return object --- 
  // Return the functions and the *internal* state
  const bridgeApi = useMemo(() => ({
    videoContext: internalCtx, // Expose the internally managed context
    isReady,
    duration,
    currentTime,
    play,
    pause,
    seek,
    activeSource, // Expose the source for debugging
    createVideoSourceNode: internalCreateVideoSourceNode, // Still expose internal creators?
    prepareVideoContext: internalPrepareVideoContext,   // Maybe remove these later
  }), [
    internalCtx, 
    isReady, 
    duration, 
    currentTime,
    play, 
    pause, 
    seek, 
    activeSource, // Include in dependencies 
    internalCreateVideoSourceNode, 
    internalPrepareVideoContext 
  ]);

  return bridgeApi;
}
