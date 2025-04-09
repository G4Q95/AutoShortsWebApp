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

// Constants for timings and adjustments
const FRAME_DURATION_SECONDS = 1 / 30; // Assuming 30fps for tolerance
const MIN_TRIM_DURATION = 0.1; // Minimum duration between trim handles

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

  // --- Ref for throttling seek calls during drag ---
  const throttleSeekTimer = useRef<NodeJS.Timeout | null>(null);
  const SEEK_THROTTLE_MS = 100; // Seek at most every 100ms during drag

  // === Playback State (from Hook) ===
  const {
    isPlaying,
    setIsPlaying,
  } = usePlaybackState(); 

  // === NEW: Local state for visual scrubbing feedback ===
  const [scrubTime, setScrubTime] = useState<number | null>(null);

  // *** ADD MISSING STATE ***
  const [wasPlayingBeforeSeek, setWasPlayingBeforeSeek] = useState<boolean>(false);

  // --- Initialize Bridge FIRST --- 
  // Initialize the bridge hook *before* callbacks that use it
  const bridge = useVideoContextBridge({
    canvasRef,
    videoRef,
    localMediaUrl,
    mediaType,
    initialMediaAspectRatio,
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
      // SIMPLIFY: Just set the duration state here
      if (newDuration && isFinite(newDuration) && newDuration > 0) {
        setDuration(newDuration);
      } else {
        console.warn(`[DurationChange Callback] Received invalid duration: ${newDuration}. Ignoring.`);
      }
    }, [setDuration]), // Only depends on setDuration now
  });
  
  // --- Other Hooks (Now after Bridge) --- 
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
    seek: bridge.seek,
    audioRef,
    isPlaying,
    onTrimChange,
    setIsPlaying,
    forceResetOnPlayRef,
    videoRef,
  });
  
  // *** ADDED: Ref to track trimManuallySet state (Moved Earlier) ***
  const trimManuallySetRef = useRef(trimManuallySet);
  useEffect(() => {
    trimManuallySetRef.current = trimManuallySet;
    console.log(`[VCSPP] trimManuallySetRef updated to: ${trimManuallySetRef.current}`);
  }, [trimManuallySet]);
  
  // --- Effect to update Trim based on Duration --- 
  useEffect(() => {
    // Only update trim if duration is valid and trim wasn't manually set
    if (duration > 0 && !trimManuallySetRef.current) {
      setTrimEnd(duration);
      if (userTrimEndRef.current === null || userTrimEndRef.current === 0) {
        userTrimEndRef.current = duration;
      }
    }
  }, [duration, trimManuallySetRef, setTrimEnd, userTrimEndRef]); // Dependencies
  
  const {
    mediaElementStyle,
    calculatedAspectRatio,
  } = useMediaAspectRatio({
    initialMediaAspectRatio,
    projectAspectRatio,
    showLetterboxing,
    mediaType,
    bridge,
  });

  // --- Function to get effective trim end --- Must be defined BEFORE handlers that use it!
  const getEffectiveTrimEnd = useCallback(() => {
    // If we have a user-set value, use it
    if (userTrimEndRef.current !== null) {
      return userTrimEndRef.current;
    }
    // If trimEnd from state is valid (not zero), use it
    if (trimEnd > 0) {
      return trimEnd;
    }
    // If duration is known, use that
    if (duration > 0) {
      return duration;
    }
    // Fallback to a reasonable default (10 seconds)
    return 10;
  }, [userTrimEndRef, trimEnd, duration]); // Dependencies

  // --- CALLBACKS & HANDLERS --- 
  const setIsPlayingWithLog = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlaying(value); // This now uses the setter from the hook
  }, [setIsPlaying]);

  const handlePause = useCallback(() => {
    console.log(`[DEBUG VCSPP handlePause] Called. Current state: isPlaying=${isPlaying}, time=${bridge?.currentTime.toFixed(3)}`);
    if (!bridge) return;
    bridge.pause();
    setIsPlaying(false);
    console.log('[DEBUG VCSPP handlePause] Pause command sent, setIsPlaying(false).');
  }, [bridge, isPlaying]);

  const handlePlay = useCallback(() => {
    console.log(`[DEBUG VCSPP handlePlay] Called. Current state: isPlaying=${isPlaying}, trimActive=${trimActive}, time=${bridge?.currentTime.toFixed(3)}`);
    if (!bridge) return;
    // Ensure playback starts from the correct position, considering trim
    const effectiveStartTime = trimActive ? trimStart : 0;
    const effectiveEndTime = trimActive ? getEffectiveTrimEnd() : duration;
    const timeToSet = bridge.currentTime < effectiveStartTime || bridge.currentTime >= effectiveEndTime
      ? effectiveStartTime
      : bridge.currentTime;

    console.log(`[DEBUG VCSPP handlePlay] Seeking to ${timeToSet.toFixed(3)} before play.`);
    bridge.seek(timeToSet); // Seek first to ensure starting at the right point
    bridge.play();
    setIsPlaying(true);
    console.log('[DEBUG VCSPP handlePlay] Play command sent, setIsPlaying(true).');
  }, [bridge, trimActive, trimStart, duration, getEffectiveTrimEnd, isPlaying]);

  const handleTimeUpdate = useCallback((newTime: number, source: string) => {
    console.log(`[DEBUG VCSPP handleTimeUpdate] Called from: ${source}, New time: ${newTime.toFixed(3)}`);
    if (!bridge) return;

    const clampedTime = Math.max(0, Math.min(newTime, duration));
    console.log(`[DEBUG VCSPP handleTimeUpdate] Clamped time: ${clampedTime.toFixed(3)}`);

    // Update visual time immediately for responsiveness
    setScrubTime(clampedTime); // Update scrubTime for immediate visual feedback

    // Seek the actual video via the bridge
    bridge.seek(clampedTime);

    // Handle playback state during seek
    if (isPlaying && source !== 'animationFrameLoop') { // Don't pause if called from loop's boundary check
      console.log('[DEBUG VCSPP handleTimeUpdate] Pausing playback during manual seek.');
      bridge.pause(); // Pause during manual seek
      setWasPlayingBeforeSeek(true); // Remember it was playing
    }
  }, [bridge, duration, isPlaying]);

  // Animation frame loop for smooth UI updates and boundary checks
  useAnimationFrameLoop({
    // Core controls
    isPlaying: isPlaying && !isDraggingScrubber && !activeHandle, // Only run loop when actively playing and not interacting
    isReady: isReady && !!bridge, // Ensure bridge is ready
    
    // Time management
    currentTime: bridge.currentTime, // Use bridge time directly
    trimStart,
    trimEnd: getEffectiveTrimEnd(), // Use the getter for the current effective end
    
    // Update callbacks
    onUpdate: (newTime) => { // Pass a simplified update callback if needed, or handle updates differently
      // If visual time needs updating based on loop, do it here.
      // Currently, relying on bridge updates + scrubTime seems preferred.
      // console.log(`[RAF OnUpdate] Time: ${newTime.toFixed(3)}`);
      // setScrubTime(newTime); // Example: Could update visual time here if needed
    },
    onPause: handlePause, // Pass the pause handler
    
    // Media type flag
    isImageType: isImageType(mediaType),
    
    // Refs
    animationFrameRef, // Pass the ref defined in this component
    forceResetOnPlayRef, // Pass the ref
    userTrimEndRef, // Pass the ref
    justResetRef, // Pass the ref
    
    // Optional context/elements
    bridge, // Pass the bridge instance
    audioRef, // Pass the audio ref
    isDraggingScrubber, // Pass dragging state
  });

  // Called when the user presses down on the scrubber
  const handleScrubberDragStart = useCallback(() => {
    console.log('[DEBUG VCSPP handleScrubberDragStart] Drag started.');
    setIsDraggingScrubber(true);
    setWasPlayingBeforeSeek(isPlaying); // Store current play state
    if (isPlaying) {
      console.log('[DEBUG VCSPP handleScrubberDragStart] Pausing playback due to drag start.');
      handlePause(); // Pause if playing
    }
     setActiveHandle(null); // Ensure no trim handle is active
  }, [isPlaying, handlePause, setActiveHandle]);

  // Called when the user releases the scrubber
  const handleScrubberDragEnd = useCallback(() => {
    console.log('[DEBUG VCSPP handleScrubberDragEnd] Drag ended.');
    if (!bridge) return;

    setIsDraggingScrubber(false);

    // Final sync: Ensure the bridge time matches the last scrub time
    // The 'seek' in handleScrubberInput should handle this, but a final check can be good.
    if (scrubTime !== null) {
         console.log(`[DEBUG VCSPP handleScrubberDragEnd] Final seek check to scrubTime: ${scrubTime.toFixed(3)}`);
        // bridge.seek(scrubTime); // Redundant if handleScrubberInput worked reliably
    }


    // Resume playback ONLY if it was playing before the drag started
    if (wasPlayingBeforeSeek) {
      console.log('[DEBUG VCSPP handleScrubberDragEnd] Resuming playback.');
      // Use a slight delay ONLY if absolutely needed to avoid race conditions
      // setTimeout(() => handlePlay(), 50); // Usually not needed now
      handlePlay();
    }
    setScrubTime(null); // Clear scrub time override after drag ends
    console.log('[DEBUG VCSPP handleScrubberDragEnd] Resetting scrubTime.');

  }, [bridge, handlePlay, wasPlayingBeforeSeek, scrubTime]);

  // Called when user presses mouse down on EITHER trim handle
  const handleTrimHandleMouseDown = useCallback((handle: 'start' | 'end') => {
    console.log(`[DEBUG VCSPP handleTrimHandleMouseDown] Handle: ${handle}`);
    setActiveHandle(handle);
    setWasPlayingBeforeSeek(isPlaying); // Store play state
    if (isPlaying) {
        console.log('[DEBUG VCSPP handleTrimHandleMouseDown] Pausing playback.');
        handlePause(); // Pause playback when interacting with trim handles
    }
    setIsDraggingScrubber(false); // Ensure scrubber dragging is false
  }, [isPlaying, handlePause, setActiveHandle]);


  // Called when user releases mouse up from EITHER trim handle
  const handleTrimHandleMouseUp = useCallback(() => {
     console.log(`[DEBUG VCSPP handleTrimHandleMouseUp] Releasing handle: ${activeHandle}`);
    if (!bridge || activeHandle === null) return;

    const handleEndTime = activeHandle === 'end' ? (userTrimEndRef.current ?? duration) : getEffectiveTrimEnd();
    const finalTime = activeHandle === 'start' ? trimStart : handleEndTime;

     console.log(`[DEBUG VCSPP handleTrimHandleMouseUp] Final seek check to: ${finalTime.toFixed(3)}`);
     // Final sync: Ensure the video is at the handle's release position
     bridge.seek(finalTime);
     setScrubTime(finalTime); // Ensure visual time matches

    setActiveHandle(null); // Clear the active handle state

    // Resume playback ONLY if it was playing before the drag started
    if (wasPlayingBeforeSeek) {
         console.log('[DEBUG VCSPP handleTrimHandleMouseUp] Resuming playback.');
         // Schedule the resume slightly after state updates to ensure consistency
         // setTimeout(() => handlePlay(), 50); // Delay might help, test without first
         handlePlay();
    }

     // Set scrubTime back to null *after* potential resume logic
     // Need slight delay to ensure the resume logic uses the correct finalTime if needed
     setTimeout(() => {
         console.log('[DEBUG VCSPP handleTrimHandleMouseUp] Resetting scrubTime.');
         setScrubTime(null);
     }, 0);


  }, [bridge, activeHandle, wasPlayingBeforeSeek, handlePlay, setActiveHandle, trimStart, getEffectiveTrimEnd, duration]);


  //--------------------------------------------------------------------------
  // Trim Toggle Handler
  //--------------------------------------------------------------------------

  const handleTrimToggle = useCallback(() => {
    const nextTrimActive = !trimActive;
    console.log(`[DEBUG VCSPP handleTrimToggle] Toggling trim. Before: ${trimActive}, After: ${nextTrimActive}`);
    setTrimActive(nextTrimActive);
    setActiveHandle(null); // Deactivate handles on toggle
    setIsDraggingScrubber(false); // Ensure not dragging scrubber on toggle

    // If activating trim, ensure playback is within bounds
    if (nextTrimActive && bridge) {
      const currentBridgeTime = bridge.currentTime;
      const effectiveStartTime = trimStart;
      const effectiveEndTime = getEffectiveTrimEnd();
      console.log(`[DEBUG VCSPP handleTrimToggle] Activating. Checking time ${currentBridgeTime.toFixed(3)} against bounds [${effectiveStartTime.toFixed(3)}, ${effectiveEndTime.toFixed(3)})`);
      if (currentBridgeTime < effectiveStartTime || currentBridgeTime >= effectiveEndTime) {
        console.log(`[DEBUG VCSPP handleTrimToggle] Time out of bounds. Seeking to start: ${effectiveStartTime.toFixed(3)}`);
        bridge.seek(effectiveStartTime);
        setScrubTime(effectiveStartTime); // Update visual time as well
      }
    }
    // If deactivating trim and it was paused, ensure scrubTime is cleared
    if (!nextTrimActive && !isPlaying) {
       console.log('[DEBUG VCSPP handleTrimToggle] Deactivating while paused. Clearing scrubTime.');
       setScrubTime(null);
    }
    // Reset wasPlayingBeforeSeek when toggling trim, as the context changes
    setWasPlayingBeforeSeek(false);
    console.log('[DEBUG VCSPP handleTrimToggle] Reset wasPlayingBeforeSeek.');

  }, [trimActive, setTrimActive, bridge, trimStart, getEffectiveTrimEnd, isPlaying, handlePause]);


  //--------------------------------------------------------------------------
  // Effect for Updating Bridge State Listeners
  //--------------------------------------------------------------------------

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
  }, [canvasRef, localMediaUrl, mediaType]); // REMOVED bridge dependency
  
  // --- Scrubber Drag Handlers (TimelineControl) --- 
  const handleScrubberDragMove = useCallback((newTime: number) => {
    // Update ONLY the temporary scrubTime state for immediate visual feedback
    setScrubTime(newTime);
    
    // Keep the throttled seek for live preview during drag
    if (!throttleSeekTimer.current) {
      console.log(`[VCSPP ScrubberDrag] Throttled: Calling bridge.seek(${newTime.toFixed(3)})`);
      bridge.seek(newTime);
      throttleSeekTimer.current = setTimeout(() => {
        throttleSeekTimer.current = null;
      }, SEEK_THROTTLE_MS);
    }
  }, [bridge, duration]); // Removed isDraggingScrubber, videoRef - scrubTime handles visual

  // Function to convert range input value to timeline position
  const timelineValueToPosition = (value: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return bridge.currentTime; // Use bridge.currentTime
    }
    const position = (value / 100) * duration;
    return position;
  };
  
  // Function to convert timeline position to range input value
  const positionToTimelineValue = (position: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return (bridge.currentTime / duration) * 100;
    }
    const value = (position / duration) * 100;
    return value;
  };
  
  // Get media container style - this will create letterboxing/pillarboxing effect
  const getMediaContainerStyle = useCallback(() => {
    // Base style without letterboxing/pillarboxing
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

    // Calculate aspect ratios
    const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
    const projectRatio = projWidth / projHeight;
    const mediaRatio = calculatedAspectRatio || projectRatio;

    console.log(`[AspectRatio-Debug] Scene: ${sceneId}, Project ratio: ${projectRatio.toFixed(4)}, Media ratio: ${mediaRatio.toFixed(4)}, CompactView: ${isCompactView}`);

    // Base container style for both compact and full-screen views
    const style: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      backgroundColor: '#000',
      overflow: 'hidden',
    };

    // CONSISTENT CALCULATION FOR BOTH VIEWS:
    // Use the same exact calculation approach for both compact and full screen
    // This ensures media appears in the same proportions in both views

    // First set container to match project aspect ratio
    // (This sets the "canvas" into which media will be placed)
    if (isCompactView) {
      // Small view - fixed height but proper proportional width
      style.height = '100%';
      style.width = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
      style.margin = 'auto'; // Center in parent
    } else {
      // Full screen view - fill available space while maintaining aspect ratio
      style.width = '100%';
      style.height = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
    }

    // Calculate and log precise details about the scaling
    console.log(`[AspectRatio-Scaling] Scene ${sceneId}: MediaRatio=${mediaRatio.toFixed(4)}, ProjectRatio=${projectRatio.toFixed(4)}`);

    return style;
  }, [calculatedAspectRatio, projectAspectRatio, showLetterboxing, isCompactView, sceneId]);
  
  // Add useEffect for temporary aspect ratio display on mount or scene change
  useEffect(() => {
    // Show indicator when component mounts (new scene)
    setShowTemporaryAspectRatio(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryAspectRatio(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [sceneId]); // Re-run when sceneId changes (new scene)
  
  // Add useEffect for aspect ratio changes
  useEffect(() => {
    // Show indicator when aspect ratio changes
    setShowTemporaryAspectRatio(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryAspectRatio(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [projectAspectRatio]); // Re-run when projectAspectRatio changes

  // Add state for fullscreen mode
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Add fullscreen toggle handler
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      // Enter fullscreen
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`[VideoContext] Error attempting to enable fullscreen:`, err);
      });
    } else {
      // Exit fullscreen
      document.exitFullscreen();
    }
  }, [containerRef]);
  
  // Listen for fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);
  
  // Canvas/Video visibility logic
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas) {
      console.log('[CANVAS DEBUG] Canvas ref is null in visibility effect');
      return; // Canvas must exist
    }
    
    // Define handlers (can be defined outside the if block)
    const handleMetadataLoaded = () => {
      if (!video) return;
      console.log(`[CANVAS DEBUG] FALLBACK: Video metadata loaded, duration=${video.duration}`);
      if (video.duration > 0) {
        setDuration(video.duration);
        setIsReady(true);
        if (!trimManuallySet) {
          setTrimEnd(video.duration);
          if (userTrimEndRef.current === null || userTrimEndRef.current === 0) {
            userTrimEndRef.current = video.duration;
          }
        }
        return;
      }
    };
    
    const timeUpdateHandler = () => {
      if (!video) return;
      console.log("[DEBUG] timeupdate event fired!");
      if (!isDraggingScrubber) {
        // Use bridge.currentTime instead of video.currentTime for consistency
        console.log(`[VideoElement] Time update: ${bridge.currentTime.toFixed(2)}s / ${video.duration.toFixed(2)}s`);
      }
    };
    
    const handleError = (e: Event) => {
      console.error('[CANVAS DEBUG] Video element error:', e);
    };

    // --- IMPROVED DIRECT RENDERING APPROACH --- 
    if (isVideoType(mediaType)) {
      canvas.style.display = 'none';
      
      if (video && localMediaUrl) {
        video.style.display = 'block';
        video.style.zIndex = '10';
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.style.backgroundColor = 'black';
        
        if (video.src !== localMediaUrl) {
          video.src = localMediaUrl;
          video.crossOrigin = 'anonymous';
          video.muted = true;
          video.playsInline = true;
          video.controls = false;
          console.log(`[CANVAS DEBUG] Set video.src to ${localMediaUrl}`);
        }

        // Add listeners if video element exists
        console.log("[DEBUG] Adding event listeners (metadata, timeupdate, error)");
        video.addEventListener('loadedmetadata', handleMetadataLoaded);
        video.addEventListener('timeupdate', timeUpdateHandler);
        video.addEventListener('error', handleError);
        
        // Update video element playback state
        if (isPlaying && video.paused) {
          console.log(`[CANVAS DEBUG] Starting direct video playback at time: ${bridge.currentTime}`);
          
          // Set current time before playing - use bridge as source of truth
          try {
            video.currentTime = bridge.currentTime; 
          } catch (e) {
            console.error('[CANVAS DEBUG] Error setting video time:', e);
          }
          
          video.play().catch(e => console.error('[CANVAS DEBUG] Error playing fallback video:', e));
        } else if (!isPlaying && !video.paused) {
          console.log('[CANVAS DEBUG] Pausing direct video playback');
          video.pause();
        }
      }
    } else if (isImageType(mediaType)) {
      canvas.style.display = 'none';
      if (video) video.style.display = 'none';
    }

    // Clean up event listeners when component unmounts or dependencies change
    return () => {
      if (video) {
        video.removeEventListener('loadedmetadata', handleMetadataLoaded);
        video.removeEventListener('timeupdate', timeUpdateHandler);
        video.removeEventListener('error', handleError);
      }
    };
  }, [isPlaying, mediaType, localMediaUrl, isDraggingScrubber, trimManuallySet, userTrimEndRef, bridge]);
  
  // Effect to clear image timer on unmount
  useEffect(() => {
    // Return cleanup function
    return () => {
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
      }
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount
  
  // Add formatTime function back inside the component scope
  const formatTime = (seconds: number, showTenths: boolean = false): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    if (showTenths) {
      const tenths = Math.floor((seconds % 1) * 10);
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    } else {
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };
  
  // --- Callbacks & Handlers ---
  // Ensure these exist from previous steps
  const handlePlayPauseToggle = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);
  
  // Add handler for toggling lock
  const handleLockToggle = useCallback(() => {
    setIsPositionLocked(prev => !prev);
  }, []);
  
  // Define missing handlers
  const handleInfoToggle = useCallback(() => {
      setShowAspectRatio(prev => !prev);
  }, [setShowAspectRatio]);

  // Add another important log - right before render, to show the current isMediumView value that will be used for conditional rendering
  console.log(`[VCSPP PreRender] PlayerControls conditional check: isMediumView=${isMediumView}`);

  // Initialize media event handlers
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

  // Debug log for UI updates and currentTime values
  console.log(`[DEBUG UI Updates] Before rendering PlayerControls: bridge.currentTime=${bridge.currentTime.toFixed(3)}, scrubTime=${scrubTime !== null ? scrubTime.toFixed(3) : 'null'}`);

  // Wrapper for onTimeUpdate prop to match expected signature
  const handleSimpleTimeUpdate = useCallback((newTime: number) => {
    // Call the main handler, providing a default source or identifying it comes from player controls
    handleTimeUpdate(newTime, 'playerControls'); 
  }, [handleTimeUpdate]);

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
        {/* Controls Overlay - Play/Pause, Scrubber, Time Display, Info Button */}
            {(() => {
              console.log(`[DEBUG VCSPP] Passing to PlayerControls: visualTime=${(scrubTime ?? bridge.currentTime).toFixed(3)}, bridge.currentTime=${bridge.currentTime.toFixed(3)}, scrubTime=${scrubTime?.toFixed(3) || 'null'}, isDraggingScrubber=${isDraggingScrubber}, trimActive=${trimActive}`);
              return null;
            })()}
            <PlayerControls
          // Visibility
          isHovering={isHovering || isLoading}
          isPositionLocked={isPositionLocked}
          isMediumView={!!isMediumView}
          onLockToggle={handleLockToggle}
          // Timeline
          visualTime={scrubTime ?? bridge.currentTime}
          duration={duration}
          trimStart={trimStart}
          effectiveTrimEnd={getEffectiveTrimEnd()}
          activeHandle={activeHandle}
          trimActive={trimActive}
          isDraggingScrubber={isDraggingScrubber}
              onTimeUpdate={handleSimpleTimeUpdate}
              onScrubberDragStart={handleScrubberDragStart}
              onScrubberDragEnd={handleScrubberDragEnd}
          setActiveHandle={setActiveHandle}
          setTimeBeforeDrag={setTimeBeforeDrag}
          setOriginalPlaybackTime={setOriginalPlaybackTime}
          getEffectiveTrimEnd={getEffectiveTrimEnd}
          // Info Button
          showAspectRatio={showAspectRatio || showTemporaryAspectRatio}
          onInfoToggle={handleInfoToggle}
          // Trim Toggle Button
          onTrimToggle={handleTrimToggle}
        />
      </MediaContainer>
    </MediaErrorBoundary>
  );
};

export default VideoContextScenePreviewPlayer;  