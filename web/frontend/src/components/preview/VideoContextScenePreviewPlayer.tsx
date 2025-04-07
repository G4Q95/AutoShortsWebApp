/**
 * VideoContextScenePreviewPlayer - Component for playing scene media with VideoContext
 * 
 * This component is a replacement for ScenePreviewPlayer, using VideoContext for
 * more accurate timeline scrubbing and playback. It maintains the same interface
 * as ScenePreviewPlayer for easy integration with the existing scene card UI.
 * 
 * Enhanced with local media downloads for improved seeking and scrubbing.
 * Now with adaptive scene-based aspect ratio support.
 */

import React, { useState, useRef, useEffect, useCallback, CSSProperties, RefObject, useMemo } from 'react';
import { PlayIcon, PauseIcon, ScissorsIcon, CheckIcon } from 'lucide-react';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { VideoContextProvider, useVideoContext } from '@/contexts/VideoContextProvider';
import MediaDownloadManager from '@/utils/media/mediaDownloadManager';
import { useMediaAspectRatio } from '@/hooks/useMediaAspectRatio';
import { useTrimControls } from '@/hooks/useTrimControls';
import PlayPauseButton from './PlayPauseButton';
import { LockButton } from './LockButton';
import { TrimToggleButton } from './TrimToggleButton';
import { InfoButton } from './InfoButton';
import { FullscreenButton } from './FullscreenButton';
import { TimelineControl } from './TimelineControl';
import { TimeDisplay } from './TimeDisplay';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { PlayerControls } from './PlayerControls';
import { MediaContainer } from './media/MediaContainer';
import { useAnimationFrameLoop } from '@/hooks/useAnimationFrameLoop';
import { useMediaEventHandlers } from '@/hooks/useMediaEventHandlers';
import MediaErrorBoundary from './media/MediaErrorBoundary';
import { useVideoContextBridge } from '@/hooks/useVideoContextBridge';

// Add custom styles for smaller range input thumbs
const smallRangeThumbStyles = `
  input[type=range].small-thumb::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
  }

  input[type=range].small-thumb::-moz-range-thumb {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
  }
  
  /* Custom styles for trim bracket range inputs */
  .trim-bracket-range {
    height: 100%;
    width: 12px;
    background: transparent !important;
    border-radius: 0;
    cursor: ew-resize;
    position: relative;
  }
  
  .trim-bracket-range::-webkit-slider-track {
    background: transparent !important;
    border: none;
  }
  
  .trim-bracket-range::-moz-range-track {
    background: transparent !important;
    border: none;
  }
  
  .trim-bracket-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 2px;
    height: 16px;
    background: #3b82f6;
    border-radius: 0;
    cursor: ew-resize;
    box-shadow: none;
    border: none;
  }
  
  .trim-bracket-range::-moz-range-thumb {
    width: 2px;
    height: 16px;
    background: #3b82f6;
    border-radius: 0;
    border: none;
    cursor: ew-resize;
    box-shadow: none;
  }

  /* Prevent any blue focus borders */
  .video-player-container {
    outline: none !important;
    border: none !important;
  }
  .video-player-container:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }
  .video-player-container * {
    outline: none !important;
  }
  canvas {
    outline: none !important;
    border: none !important;
  }
  button {
    outline: none !important;
  }
`;

interface VideoContextScenePreviewPlayerProps {
  projectId: string;
  sceneId: string;
  mediaUrl: string;
  audioUrl?: string;
  mediaType: 'image' | 'video' | 'gallery';
  trim?: { start: number; end: number };
  onTrimChange?: (start: number, end: number) => void;
  className?: string;
  isCompactView?: boolean;
  thumbnailUrl?: string;
  mediaAspectRatio?: number;           // Media's original aspect ratio (will be passed to hook as initialMediaAspectRatio)
  projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'; // Project-wide setting
  showLetterboxing?: boolean;          // Whether to show letterboxing/pillarboxing
  isMediumView?: boolean;
}

// Add type guard functions back inside the component scope
const isImageType = (type: 'image' | 'video' | 'gallery'): boolean => type === 'image' || type === 'gallery';
const isVideoType = (type: 'image' | 'video' | 'gallery'): boolean => type === 'video';

// Create a wrapper component to provide VideoContextProvider
export const VideoContextScenePreviewPlayer: React.FC<VideoContextScenePreviewPlayerProps> = (props) => {
  return (
    <VideoContextProvider>
      <VideoContextScenePreviewPlayerContent {...props} />
    </VideoContextProvider>
  );
};

const VideoContextScenePreviewPlayerContent: React.FC<VideoContextScenePreviewPlayerProps> = ({
  projectId,
  sceneId,
  mediaUrl,
  audioUrl,
  mediaType,
  trim = { start: 0, end: 0 },
  onTrimChange,
  className = '',
  isCompactView = true,
  thumbnailUrl,
  mediaAspectRatio: initialMediaAspectRatio,
  projectAspectRatio = '9:16',
  showLetterboxing = true,
  isMediumView,
}) => {
  // Simple log for essential debugging
  console.log(`[VCSPP] Render with isMediumView=${isMediumView}`);
  
  // State for player
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  const [originalPlaybackTime, setOriginalPlaybackTime] = useState<number>(0);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const forceResetOnPlayRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const imageTimerRef = useRef<number | null>(null);
  
  // VideoContext state
  const [videoContext, setVideoContext] = useState<any>(null);
  const [duration, setDuration] = useState<number>(() => isImageType(mediaType) ? 30 : 0);
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // Add state for local media
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  // Add state for fallback image rendering
  const [useImageFallback, setUseImageFallback] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Get singletons for media and edit history management
  const mediaManager = useRef(MediaDownloadManager.getInstance());

  // Add state for first frame capture
  const [showFirstFrame, setShowFirstFrame] = useState<boolean>(true);
  
  // Add video element ref for first frame capture
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State for aspect ratio display toggle
  const [showAspectRatio, setShowAspectRatio] = useState<boolean>(false);

  // Add state for temporary aspect ratio indicator display
  const [showTemporaryAspectRatio, setShowTemporaryAspectRatio] = useState<boolean>(false);

  // Add state for position locking
  const [isPositionLocked, setIsPositionLocked] = useState<boolean>(false);

  // *** ADDED: Ref to track if playback was just reset ***
  const justResetRef = useRef<boolean>(false);
  const isResumingRef = useRef<boolean>(false);

  // --- Playback State ---
  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    visualTime,
    setVisualTime,
  } = usePlaybackState(); 

  // --- Other Hooks --- 
  const {
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
  } = useTrimControls({
    initialTrimStart: trim.start,
    initialTrimEnd: trim.end,
    initialDuration: duration,
    containerRef,
    duration,
    videoContext,
    audioRef,
    isPlaying,
    onTrimChange,
    setVisualTime,
    setCurrentTime,
    setIsPlaying, // Pass direct setter here
    forceResetOnPlayRef,
    videoRef, // <<< ADD THIS LINE
  });
  
  // *** ADDED: Ref to track trimManuallySet state ***
  const trimManuallySetRef = useRef(trimManuallySet);
  useEffect(() => {
    trimManuallySetRef.current = trimManuallySet;
    console.log(`[VCSPP] trimManuallySetRef updated to: ${trimManuallySetRef.current}`);
  }, [trimManuallySet]);
  
  const {
    calculatedAspectRatio,
    mediaElementStyle,
  } = useMediaAspectRatio({
    initialMediaAspectRatio,
    projectAspectRatio,
    showLetterboxing,
    mediaType,
  });

  // Initialize the bridge hook *before* callbacks that use it
  const bridge = useVideoContextBridge({
    videoContextInstance: videoContext,
    canvasRef,
    localMediaUrl,
    mediaType,
    initialMediaAspectRatio,
    // Pass placeholder callbacks for now
    onReady: useCallback(() => {
      console.log("[VideoContextScenePreviewPlayer] Bridge reported ready.");
      setIsReady(true);
    }, [setIsReady]), 
    onError: useCallback((error: Error) => {
      console.error("[VideoContextScenePreviewPlayer] Bridge reported error:", error);
      setIsLoading(false); // Ensure loading stops on error
      setIsReady(false);
      // Error UI is handled by MediaErrorBoundary
    }, [setIsLoading, setIsReady]), 
    onDurationChange: useCallback((newDuration: number) => {
      console.log(`[VideoContextScenePreviewPlayer] Bridge reported duration change: ${newDuration}`);
      // Prevent duration being set to 0 or NaN
      if (newDuration && isFinite(newDuration) && newDuration > 0) {
        setDuration(newDuration);
        // *** FIX: Use ref to check the LATEST manual set status ***
        if (!trimManuallySetRef.current) {
          console.log(`[DurationChange] Updating trimEnd to new duration (manual set ref is false): ${newDuration}`);
          setTrimEnd(newDuration); 
          userTrimEndRef.current = newDuration; // Update ref as well
        } else {
          console.log(`[DurationChange] Ignoring duration update as trim was manually set (ref is true).`);
        }
      } else {
        console.warn(`[DurationChange] Received invalid duration: ${newDuration}. Ignoring.`);
      }
      // No longer need trimEnd in dependency array
    }, [setDuration, setTrimEnd, userTrimEndRef]), // REMOVED trimManuallySet, now reading from ref
  });

  // --- CALLBACKS & HANDLERS --- 
  const setIsPlayingWithLog = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlaying(value); // This now uses the setter from the hook
  }, [setIsPlaying]);

  const handlePause = useCallback(() => {
    if (isImageType(mediaType)) {
      setIsPlayingWithLog(false); // Use wrapper
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return; // Return early for images
    }
    
    // --- Video Logic --- 
    bridge.pause(); // *** USE BRIDGE PAUSE ***
    setIsPlayingWithLog(false); // Use wrapper
    
    // Cancel the main animation frame loop when pausing video
    if (animationFrameRef.current) { 
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
  }, [
    // Dependencies:
    mediaType, bridge, audioRef, // Use bridge instead of videoContext
    setIsPlayingWithLog, // Callback wrapper
    animationFrameRef, // Ref for cancelling animation loop
    currentTime     // Add dependency on currentTime for updating first frame
  ]);

  const handlePlay = useCallback(async () => {
    console.log('[handlePlay] Attempting to play...');
    if (!isReady) {
      console.log('[handlePlay] Not ready, aborting play.');
      return;
    }

    // Critical: Check if current time is outside trim range or needs reset
    let needsReset = false;
    if (currentTime < trimStart || currentTime >= trimEnd || forceResetOnPlayRef.current) {
       console.log(`[handlePlay] Resetting time. Current: ${currentTime}, Start: ${trimStart}, End: ${trimEnd}, Force: ${forceResetOnPlayRef.current}`);
       needsReset = true;
    }

    // Set isPlaying state *early* to indicate intent
    setIsPlayingWithLog(true); // Use the logging wrapper

    try {
      // Perform seek *before* playing if needed
      if (needsReset) {
         // Set visual time immediately for responsiveness
         setVisualTime(trimStart);
         console.log(`[handlePlay] Seeking to trimStart: ${trimStart}`);
         await bridge.seek(trimStart); // Use bridge for seeking
         // Ensure currentTime reflects the seek *after* it completes
         setCurrentTime(trimStart);
         console.log(`[handlePlay] Seek completed, currentTime set to ${trimStart}`);
         forceResetOnPlayRef.current = false; // Reset the force flag
         justResetRef.current = true; // Indicate a reset happened
         // Explicitly set resuming flag if we reset *and* were previously paused
         if (!isPlayingRef.current) { // Check previous state via ref
           isResumingRef.current = true;
         }
      } else {
          // If not resetting, ensure resuming flag is false
          isResumingRef.current = false;
      }

      // Actually start playback via the bridge *after* potential seek
      console.log('[handlePlay] Calling bridge.play()');
      await bridge.play();
      console.log('[handlePlay] bridge.play() successful');

      // Separate audio handling - *after* successful bridge play
      if (audioRef.current) {
        console.log('[handlePlay] Playing separate audio');
        await audioRef.current.play().catch(err => console.error("[AudioDiag] handlePlay Play Error:", err));
      }

    } catch (error) {
       console.error('[handlePlay] Error during play sequence (seek or play):', error);
       // Revert state if any part of the sequence fails
       setIsPlayingWithLog(false);
       // Consider pausing bridge/audio explicitly here too if needed
       try { await bridge.pause(); } catch (e) {}
       if (audioRef.current) audioRef.current.pause();
       return; // Stop if seek or play fails
    }

  }, [
     isReady, currentTime, trimStart, trimEnd,
     bridge, // Bridge dependency
     setIsPlayingWithLog, // Logging wrapper
     setCurrentTime, setVisualTime, // State setters
     forceResetOnPlayRef, justResetRef, isResumingRef, // Refs
     audioRef, // Audio ref
     isPlayingRef // Ref for previous state check
  ]);
  
  const handleTimeUpdate = useCallback((newTime: number) => {
    // This handler is mainly for direct scrubbing/setting time, not continuous playback updates
    if (isImageType(mediaType)) {
      const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
      setCurrentTime(clampedTime); // Use setter from hook
      setVisualTime(clampedTime); // *** ADDED: Update visual time immediately ***
      
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      setIsPlayingWithLog(false); // Use wrapper
      if (audioRef.current) audioRef.current.currentTime = clampedTime;
      if (forceResetOnPlayRef.current) forceResetOnPlayRef.current = false;
      return;
    }
    
    // Use original videoContext for now, will be moved later
    const currentVideoContext = videoContext; 
    if (!currentVideoContext) return;
    
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
    
    // *** FIX: Call bridge.seek instead of setting context directly ***
    // try {
    //    currentVideoContext.currentTime = clampedTime;
    // } catch (e) {
    //     console.warn("[handleTimeUpdate] Error setting videoContext time:", e);
    // }
    bridge.seek(clampedTime);
    
    // Update React state
    setCurrentTime(clampedTime); // Use setter from hook
    setVisualTime(clampedTime); // *** ADDED: Update visual time immediately ***
    
    // Update separate audio element if present
    if (audioRef.current) {
       try {
         audioRef.current.currentTime = clampedTime;
       } catch (e) {
         console.warn("[handleTimeUpdate] Error setting audio time:", e);
       }
    }
  }, [
    videoContext, // Keep original dependency for now
    trimStart, trimEnd, // Read state from trim hook
    setCurrentTime, setVisualTime, // *** ADDED setVisualTime to dependencies ***
    setIsPlayingWithLog, // Other callbacks
    audioRef, mediaType, imageTimerRef, forceResetOnPlayRef,
    bridge // *** ADDED bridge dependency ***
  ]);
  
  // SAFE ADDITION: Add the animation frame hook with required callbacks (just testing)
  // This won't replace the existing animation loop yet, just runs in parallel
  useAnimationFrameLoop({
    isPlaying,
    isReady,
    currentTime,
    trimStart,
    trimEnd,
    onUpdate: (newTime, isDraggingScrubber) => {
      // Update the actual playback time state
      setCurrentTime(newTime);
      
      // Only update the visual time if the user is NOT dragging the scrubber
      if (!isDraggingScrubber) {
        setVisualTime(newTime);
      }
    },
    onPause: handlePause,
    isImageType: isImageType(mediaType),
    animationFrameRef,
    forceResetOnPlayRef,
    // Additional needed properties
    videoContext,
    audioRef,
    isDraggingScrubber, // Pass the dragging state
    userTrimEndRef,
    // *** ADDED: Pass the new ref ***
    justResetRef,
    isResumingRef, // Pass the ref here
  });
  
  // Function to get local media URL
  const getLocalMedia = useCallback(async () => {
    if (!mediaUrl) return;
    
    try {
      setIsLoading(true);
      // ... (console logs and cache check) ...

      // Download the media
      const objectUrl = await mediaManager.current.downloadMedia(
        mediaUrl,
        sceneId,
        projectId,
        mediaType,
        { onProgress: (progress: number) => setDownloadProgress(progress) } // Simplified progress handler
      );
      
      if (objectUrl) {
        setLocalMediaUrl(objectUrl);
      } else {
        setLocalMediaUrl(null); // Ensure fallback if URL is invalid
      }

    } catch (error) {
      console.error(`[GetLocalMedia] Error downloading media for scene ${sceneId}:`, error);
      setLocalMediaUrl(null); // Fallback to direct URL if download fails
    } finally {
       // Ensure isLoading is always set to false eventually
       setIsLoading(false);
    }
  }, [mediaUrl, sceneId, projectId, mediaType]); // Keep dependencies simple
  
  // Initialize media download when component mounts
  useEffect(() => {
    getLocalMedia();
    return () => {
      if (localMediaUrl && mediaUrl) {
        mediaManager.current.releaseMedia(mediaUrl, sceneId);
      }
    };
  }, [mediaUrl, getLocalMedia]); // getLocalMedia is stable due to useCallback
  
  // Handle audio separately
  useEffect(() => {
    // *** ADD CHECK: Only run this effect for VIDEO types ***
    if (audioRef.current && !isImageType(mediaType)) { 
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error("[AudioDiag] Effect Play Error:", err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl, audioRef, mediaType]); // Added mediaType dependency
  
  // VideoContext initialization
  useEffect(() => {
    console.log('[INIT DEBUG] VideoContext initialization effect running');
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !localMediaUrl || !isVideoType(mediaType)) {
      console.log(`[INIT DEBUG] Early return conditions: canvas=${!!canvas}, container=${!!containerRef.current}, localMediaUrl=${!!localMediaUrl}, isVideo=${isVideoType(mediaType)}`);
      return; // Bail out if refs not ready, no local URL, or not a video
    }

    console.log(`[INIT DEBUG] Continuing with VideoContext initialization for media: ${localMediaUrl}`);
    let isMounted = true; // Track mount status

    const baseSize = 1920;
    let canvasWidth: number, canvasHeight: number;
    
    // Store the current bridge reference to use in async code
    const currentBridge = bridge;
    // Store the current context to avoid dependency issues
    const currentVideoContext = videoContext;

    const initVideoContext = async () => {
      console.log('[INIT DEBUG] initVideoContext starting');
      try {
        // Clean up existing context if any
        if (currentVideoContext) {
          console.log('[INIT DEBUG] Cleaning up existing VideoContext');
          try {
            currentVideoContext.reset();
            if (typeof currentVideoContext.dispose === 'function') {
              currentVideoContext.dispose();
            }
          } catch (cleanupError) {
            console.error(`[INIT-DEBUG] Error during context cleanup:`, cleanupError);
          }
          if (isMounted) setVideoContext(null);
        }
        
        // Dynamically import VideoContext
        console.log('[INIT DEBUG] Importing VideoContext module');
        const VideoContextModule = await import('videocontext');
        const VideoContext = VideoContextModule.default || VideoContextModule;
        
        // Use initialMediaAspectRatio from props if available, otherwise use a default
        const initialRatioForCanvas = initialMediaAspectRatio || (9 / 16);
        if (initialRatioForCanvas >= 1) {
          canvasWidth = baseSize;
          canvasHeight = Math.round(baseSize / initialRatioForCanvas);
        } else {
          canvasHeight = baseSize;
          canvasWidth = Math.round(baseSize * initialRatioForCanvas);
        }
        
        console.log(`[INIT DEBUG] Setting canvas dimensions: ${canvasWidth}x${canvasHeight}`);
        // Set canvas internal resolution
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        console.log('[INIT DEBUG] Creating new VideoContext instance');
        const ctx = new VideoContext(canvas);
        if (!ctx) throw new Error('Failed to create VideoContext instance');
        console.log('[INIT DEBUG] VideoContext created successfully:', ctx);
        if (!isMounted) {
          // If unmounted during async work, clean up the context
          try {
            ctx.reset();
            if (typeof ctx.dispose === 'function') ctx.dispose();
          } catch (e) {}
          return null;
        }
        setVideoContext(ctx);

        let sourceNode: any = null; // Variable to hold the source node
        if (mediaType === 'video') {
          // *** CALL THE BRIDGE TO CREATE THE SOURCE NODE ***
          console.log('[INIT DEBUG] Calling bridge.createVideoSourceNode');
          sourceNode = currentBridge.createVideoSourceNode(ctx);
          console.log('[INIT DEBUG] Source node creation result:', !!sourceNode);
          if (!sourceNode) {
             // Error handling is done within the bridge method, just log here if needed
             console.error("[VideoCtx Init] Bridge failed to create source node.");
             if (isMounted) {
            setIsLoading(false);
               setIsReady(false);
             }
             // Potentially throw or return early if source creation is critical
             return null; // Indicate failure
          }
        }
        
        // Return the context and the source node (if created)
        console.log('[INIT DEBUG] initVideoContext complete, returning results');
        return {
          context: ctx,
          source: sourceNode
        };
      } catch (error) {
        console.error('[INIT DEBUG] Error in initVideoContext:', error);
        if (isMounted) {
            setIsLoading(false);
            setIsReady(false);
        }
        return null;
      }
    };
    
    // Run initialization and handle results
    console.log('[INIT DEBUG] Starting VideoContext setup promise');
    const setupPromise = initVideoContext();
    
    setupPromise.then(result => {
      console.log('[INIT DEBUG] Setup promise resolved:', result ? 'successfully' : 'failed');
      if (!isMounted) return;
      if (result && result.context) {
        console.log('[INIT DEBUG] Setup succeeded with context:', result.context);
      } else {
        console.log('[INIT DEBUG] Setup did not produce a valid context');
        setIsReady(false); // Ensure ready is false if setup failed
      }
    }).catch(error => {
      console.error('[INIT DEBUG] Setup promise rejected:', error);
      if (!isMounted) return;
      setIsReady(false);
      setIsLoading(false); // Ensure loading is false on promise rejection
    });
    
    // Cleanup function
    return () => {
      console.log('[INIT DEBUG] VideoContext initialization effect cleanup');
      isMounted = false; // Mark as unmounted
    };
  }, [localMediaUrl, mediaType, sceneId, initialMediaAspectRatio, setVideoContext, setDuration, setTrimEnd, userTrimEndRef, setCurrentTime]); // REMOVED videoContext dependency
  
  // After the existing VideoContext initialization hook, add a new test hook for the bridge's prepareVideoContext method
  useEffect(() => {
    // Only run this test if the component is mounted and we have the necessary dependencies
    if (!canvasRef.current || !localMediaUrl || !isVideoType(mediaType)) {
      return; // Skip if requirements aren't met
    }
    
    let isMounted = true;
    
    // Store the current bridge reference to use in async code
    const currentBridge = bridge;
    
    // Test the bridge's prepareVideoContext method
    const testBridgePrepare = async () => {
      console.log('[VideoCtx Test] Testing bridge.prepareVideoContext()...');
      
      try {
        // Call the bridge's method to prepare the context
        const testContext = await currentBridge.prepareVideoContext();
        
        if (!isMounted) return; // Prevent state updates if unmounted
        
        // Log success or failure
        if (testContext) {
          console.log('[VideoCtx Test] Bridge successfully prepared context:', testContext);
          
          // Clean up the test context to avoid interference with the main context
          try {
            testContext.reset();
            if (typeof testContext.dispose === 'function') {
              testContext.dispose();
            }
          } catch (cleanupError) {
            console.warn('[VideoCtx Test] Error cleaning up test context:', cleanupError);
          }
        } else {
          console.warn('[VideoCtx Test] Bridge failed to prepare context');
      }
    } catch (error) {
        if (!isMounted) return;
        console.error('[VideoCtx Test] Error testing bridge.prepareVideoContext():', error);
      }
    };
    
    // Run the test
    testBridgePrepare();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  // Remove bridge from dependency array to prevent infinite loops  
  }, [canvasRef, localMediaUrl, mediaType]); // REMOVED bridge dependency
  
  // == INTERACTION HANDLERS ==
  
  // --- Scrubber Handlers (for Native Input) ---
  const handleScrubberDragStart = useCallback(() => {
    setIsDraggingScrubber(true);
    // Optionally pause playback when dragging starts
    if (isPlaying) {
      handlePause();
    }
  }, [isPlaying, handlePause]); // Depend on isPlaying and handlePause

  // Called by TimelineControl's onInput for the main scrubber
  const handleScrubberInput = useCallback((newTime: number) => {
    // During drag, only update the visual representation
    setVisualTime(newTime);
  }, [setVisualTime]); // Only depends on setVisualTime

  const handleScrubberDragEnd = useCallback(() => {
    if (isDraggingScrubber) {
      console.log(`[ScrubberDragEnd] Drag finished. Final visualTime: ${visualTime.toFixed(3)}`);
      // Now perform the actual seek operation with the final visual time
      bridge.seek(visualTime);
      
      // Sync the actual playback time state
      setCurrentTime(visualTime);
      
      // Update dragging state
      setIsDraggingScrubber(false);
    }
  }, [
    isDraggingScrubber, 
    visualTime, 
    bridge, 
    setCurrentTime
  ]);
  
  // --- Trim Handlers (for Native Input) ---
  
  // Called on MouseDown on the hidden trim range inputs in TimelineControl
  const handleTrimHandleMouseDown = useCallback((handle: 'start' | 'end') => {
    setActiveHandle(handle);
    // Optionally pause playback when dragging starts
    if (isPlaying) {
      handlePause();
    }
  }, [isPlaying, handlePause, setActiveHandle]); // Restored setActiveHandle dependency
  
  const handleTrimHandleMouseUp = useCallback(() => {
    if (activeHandle) {
      // Update the main context trim state when drag finishes
      onTrimChange?.(trimStart, trimEnd);
      setActiveHandle(null); // Clear active handle
      setTrimManuallySet(true); // Mark trim as manually set
    }
  }, [activeHandle, trimStart, trimEnd, onTrimChange, setActiveHandle, setTrimManuallySet]);
  
  // Called by TimelineControl's onInput for the left bracket
  const handleTrimStartInput = useCallback((newStartTime: number) => {
    // TODO: Implement clamping/validation if needed
    // For now, just update the state directly
    setTrimStart(newStartTime);
    // ALSO update visual time if the playhead should follow the handle
    setVisualTime(newStartTime);
  }, [setTrimStart, setVisualTime]);

  // Called by TimelineControl's onInput for the right bracket
  const handleTrimEndInput = useCallback((newEndTime: number) => {
    // TODO: Implement clamping/validation if needed
    // For now, just update the state directly
    setTrimEnd(newEndTime);
    // ALSO update visual time if the playhead should follow the handle
    setVisualTime(newEndTime);
  }, [setTrimEnd, setVisualTime]);
  
  // Called on MouseUp on the hidden trim range inputs in TimelineControl
  // Renamed to avoid conflict with handleTrimDragEnd from hook
  const handleAnyTrimMouseUp = useCallback(() => {
     handleTrimHandleMouseUp(); // Call the state management logic
   }, [handleTrimHandleMouseUp]);
   
  // --- End Trim Handlers ---
   
  // == STATE FOR UI ELEMENTS (Ensure no duplicates) ==
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // == EFFECTS FOR UI ==
  
  // Effect for temporary aspect ratio display
  useEffect(() => {
    setShowTemporaryAspectRatio(true);
    const timer = setTimeout(() => setShowTemporaryAspectRatio(false), 2000);
    return () => clearTimeout(timer);
  }, [sceneId, projectAspectRatio]); // Show on scene change or aspect ratio change

  // Fullscreen handling (Moved earlier)
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`[VCSPP] Error entering fullscreen:`, err);
      });
    } else {
      document.exitFullscreen();
    }
  }, [containerRef]);
  
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);
  
  // Initialize media event handlers (Now handleFullscreenToggle is defined)
  const mediaEventHandlers = useMediaEventHandlers({
    sceneId,
    mediaType,
    setIsLoading,
    setIsReady,
    setIsHovering,
    setImageLoadError,
    setTrimEnd,
    handlePlay,
    handlePause,
    isPlaying,
    handleFullscreenToggle
  });

  // Add handler for video errors
  const handleVideoError = useCallback((error: Error) => {
    console.error('[VideoContextScenePreviewPlayer] Video error:', error);
    setIsLoading(false);
    // The actual error UI will be handled by the MediaErrorBoundary
  }, []);

  // Create a reset key for the error boundary based on various factors
  // This ensures the error boundary resets when relevant props change
  const errorBoundaryResetKey = `${sceneId}-${mediaUrl}-${localMediaUrl}-${mediaType}-${Date.now()}`;

  // == UTILITY FUNCTIONS ==
  
  // Function to convert time to percentage for display/input value
  const positionToPercent = (position: number): number => {
    return duration > 0 ? (position / duration) * 100 : 0;
  };

  // Function to convert percentage from input value to time
  const percentValueToPosition = (percentValue: string | number): number => {
    const percent = typeof percentValue === 'string' ? parseFloat(percentValue) : percentValue;
    return (percent / 100) * duration;
  };
  
  // Get the effective trim end for display purposes (RESTORED)
  const getEffectiveTrimEnd = useCallback(() => {
    if (userTrimEndRef.current !== null) {
      return userTrimEndRef.current;
    }
    if (trimEnd > 0) {
      return trimEnd;
    }
    if (duration > 0) {
      return duration;
    }
    return 10; // Fallback
  }, [trimEnd, duration, userTrimEndRef]);
  
  // Get media container style (RESTORED - assumes useMediaAspectRatio provides calculatedAspectRatio)
  const getMediaContainerStyle = useCallback(() => {
    if (!showLetterboxing) {
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      };
    }
    const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
    const projectRatio = projWidth / projHeight;
    const mediaRatio = calculatedAspectRatio || projectRatio;
    const style: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      backgroundColor: '#000',
      overflow: 'hidden',
    };
    if (isCompactView) {
      style.height = '100%';
      style.width = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
      style.margin = 'auto'; 
    } else {
      style.width = '100%';
      style.height = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
    }
    return style;
  }, [calculatedAspectRatio, projectAspectRatio, showLetterboxing, isCompactView]);
  
  // == DEFINE UI CONTROL HANDLERS ==
  const handlePlayPauseToggle = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);
  
  const handleLockToggle = useCallback(() => {
    setIsPositionLocked(prev => !prev);
  }, [setIsPositionLocked]); // Added dependency

  const handleInfoToggle = useCallback(() => {
    setShowAspectRatio(prev => !prev);
  }, [setShowAspectRatio]); // Added dependency

  const handleTrimToggle = useCallback(() => {
    setTrimActive(prev => !prev);
    // When activating trim, store current time and pause
    if (!trimActive) { // Check if turning ON
      if (isPlaying) {
        setOriginalPlaybackTime(currentTime);
        handlePause();
      }
    } else {
       // When turning OFF trim, restore time if it was stored
       if (originalPlaybackTime > 0) {
         handleTimeUpdate(originalPlaybackTime); // Restore time
         setOriginalPlaybackTime(0); // Clear stored time
       }
    }
  }, [trimActive, isPlaying, currentTime, handlePause, handleTimeUpdate, setTrimActive, setOriginalPlaybackTime]); // Added dependencies

  // == RENDER LOGIC ==
  console.log(`[VCSPP PreRender] PlayerControls conditional check: isMediumView=${isMediumView}`);

  // -- Memoized Callbacks for PlayerControls -- 
  // Ensures PlayerControls only re-renders when necessary
  const playerControlsCallbacks = useMemo(() => ({
    onPlayPauseToggle: handlePlayPauseToggle,
    onLockToggle: handleLockToggle,
    onTrimToggle: handleTrimToggle,
    onInfoToggle: handleInfoToggle,
    onFullscreenToggle: () => { console.warn("Fullscreen toggle not yet implemented in PlayerControls callbacks."); }, // Placeholder
    // Scrubber handlers
    onScrubberInput: handleScrubberInput,
    onScrubberDragStart: handleScrubberDragStart,
    onScrubberDragEnd: handleScrubberDragEnd,
    // Trim handlers
    onTrimStartInput: handleTrimStartInput,
    onTrimEndInput: handleTrimEndInput,
    onTrimHandleMouseDown: handleTrimHandleMouseDown,
    onTrimHandleMouseUp: handleAnyTrimMouseUp, // Use the renamed handler
  }), [
    handlePlayPauseToggle,
    handleLockToggle,
    handleTrimToggle,
    handleInfoToggle,
    // Add other handlers as dependencies
    handleScrubberInput,
    handleScrubberDragStart,
    handleScrubberDragEnd,
    handleTrimStartInput,
    handleTrimEndInput,
    handleTrimHandleMouseDown,
    handleAnyTrimMouseUp,
  ]);

  // Render loading state
  if (isLoading && !localMediaUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-900 rounded-lg overflow-hidden ${className}`}
           style={{ height: isCompactView ? '110px' : '200px', width: isCompactView ? '110px' : '100%' }}>
        {thumbnailUrl ? (
          // If thumbnail URL is available, show it as background with loading indicator
          <div 
            className="flex flex-col items-center justify-center text-white w-full h-full relative"
            style={{
              backgroundImage: `url(${thumbnailUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            <div className="absolute inset-0 bg-black bg-opacity-40 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
              <div className="text-xs">
                {downloadProgress > 0 ? `${Math.round(downloadProgress * 100)}%` : 'Loading...'}
              </div>
            </div>
          </div>
        ) : (
          // Default loading indicator without thumbnail
          <div className="flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
            <div className="text-xs">
              {downloadProgress > 0 ? `${Math.round(downloadProgress * 100)}%` : 'Loading...'}
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Use the MediaContainer component for rendering all media types
  return (
    <MediaErrorBoundary 
      mediaType={mediaType}
      mediaUrl={mediaUrl}
      resetKey={errorBoundaryResetKey} // Better reset key
      isCompactView={isCompactView}
      debug={process.env.NODE_ENV === 'development'} // Only debug in development
      onError={(error) => {
        console.error(`[VideoContextScenePreviewPlayer] Media error caught by boundary:`, error);
        setIsLoading(false); // Ensure loading state is reset on error
      }}
    >
      <MediaContainer 
        // Media properties
        mediaUrl={mediaUrl}
        localMediaUrl={localMediaUrl}
        mediaType={mediaType}
        
        // Container props
        className={className}
        isCompactView={isCompactView}
        projectAspectRatio={projectAspectRatio}
        containerRef={containerRef}
        
        // Media state
        isLoading={isLoading}
        isHovering={isHovering}
        isPlaying={isPlaying}
        showFirstFrame={showFirstFrame}
        isFullscreen={isFullscreen}
        imageLoadError={imageLoadError}
        
        // Refs
        videoRef={videoRef}
        canvasRef={canvasRef}
        imgRef={imgRef}
        
        // Styling
        mediaElementStyle={mediaElementStyle}
        getMediaContainerStyle={getMediaContainerStyle}
        
        // Event handlers - use handlers from the hook
        onMouseEnter={mediaEventHandlers.onMouseEnter}
        onMouseLeave={mediaEventHandlers.onMouseLeave}
        onFullscreenToggle={mediaEventHandlers.onFullscreenToggle}
        onImageLoad={mediaEventHandlers.onImageLoad}
        onImageError={mediaEventHandlers.onImageError}
        onVideoError={handleVideoError}
        onContainerClick={mediaEventHandlers.onContainerClick}
        
        // Extra props
        sceneId={sceneId}
        
        // Aspect ratio info
        showAspectRatio={showAspectRatio || showTemporaryAspectRatio}
        calculatedAspectRatio={calculatedAspectRatio}
      >
        {/* PlayerControls component is now passed as a child */}
        <PlayerControls
          // Playback state (RESTORED isPlaying)
          isPlaying={isPlaying}
          isReady={isReady}
          // Time state
          currentTime={currentTime} 
            visualTime={visualTime}
            duration={duration}
          // Trim state & handlers
          trimActive={trimActive}
            trimStart={trimStart}
          effectiveTrimEnd={getEffectiveTrimEnd()} // Call function
            activeHandle={activeHandle}
          
          // Native Input Callbacks
          onScrubberInput={handleScrubberInput}
          onTrimStartInput={handleTrimStartInput}
          onTrimEndInput={handleTrimEndInput}
          
          // Native State Management Callbacks
          onScrubberDragStart={handleScrubberDragStart}
          onScrubberDragEnd={handleScrubberDragEnd}
          onTrimHandleMouseDown={handleTrimHandleMouseDown}
          onTrimHandleMouseUp={handleAnyTrimMouseUp}
          
          // Other handlers (Restored missing ones)
          onPlayPauseToggle={handlePlayPauseToggle}
          onLockButtonToggle={handleLockToggle}
          onTrimToggle={handleTrimToggle}
          onInfoToggle={handleInfoToggle}
          onFullscreenToggle={handleFullscreenToggle} // Pass the restored handler
          onLockToggle={handleLockToggle}
          getEffectiveTrimEnd={getEffectiveTrimEnd} // Pass the restored function
          
          // State for UI (Restored missing ones)
          isLocked={controlsLocked}
          isPositionLocked={isPositionLocked}
          showLetterboxInfo={showLetterboxing}
          showAspectRatio={showAspectRatio}
          isCompactView={isCompactView} 
          isHovering={isHovering}
          isMediumView={!!isMediumView} 
        />
      </MediaContainer>
    </MediaErrorBoundary>
  );
};

export default VideoContextScenePreviewPlayer;  