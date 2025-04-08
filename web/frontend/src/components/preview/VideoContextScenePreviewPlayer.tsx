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
    videoContext: bridge.videoContext,
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
    videoContext: bridge.videoContext,
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
    animationFrameRef // Ref for cancelling animation loop
  ]);

  const handlePlay = useCallback(() => {
    console.log('[DEBUG][handlePlay] Entered function.'); // LOG
    
    const wasReset = forceResetOnPlayRef.current;
    const startTime = wasReset ? trimStart : bridge.currentTime; // Use bridge.currentTime
    
    // Log status for debugging
    console.log(`[DEBUG][handlePlay] Force reset flag is ${wasReset ? 'TRUE' : 'FALSE'}. Target startTime: ${startTime.toFixed(3)}`); // LOG
    
    // Update React state (visuals) immediately at the start
    if (wasReset) {
      console.log(`[DEBUG][handlePlay] Applying reset state: Using start time ${startTime.toFixed(3)}`); // LOG
    }
    
    // If we're at the end, or need to reset, set time explicitly
    if (wasReset) {
      console.log('[DEBUG][handlePlay] Attempting to set media element times...'); // LOG
      // Set time in all media elements
      if (bridge.videoContext) { // Video
         try { 
           console.log(`[DEBUG][handlePlay] Setting bridge context currentTime to ${startTime.toFixed(3)}`); // LOG
           bridge.videoContext.currentTime = startTime; 
         } 
         catch (e) { console.warn("[handlePlay Reset] Error setting video context time:", e); }
      }
      if (audioRef.current) { // Audio
          try { 
            console.log(`[DEBUG][handlePlay] Setting audioRef currentTime to ${startTime.toFixed(3)}`); // LOG
            audioRef.current.currentTime = startTime; 
          } 
          catch (e) { console.warn("[handlePlay Reset] Error setting audio time:", e); }
      }
      
      // Reset the flag *after* setting time
      console.log('[DEBUG][handlePlay] Clearing forceResetOnPlayRef flag.'); // LOG
      forceResetOnPlayRef.current = false;
      console.log('[DEBUG][handlePlay] Flag is now:', forceResetOnPlayRef.current); // LOG
      
      // Set the justResetRef flag to prevent first time update
      justResetRef.current = true;
      console.log(`[DEBUG][handlePlay] Set justResetRef to true.`);
    }
    
    // Handle video playback
    if (isVideoType(mediaType)) {
      if (bridge.videoContext && bridge.isReady) {
        console.log("[handlePlay] Bridge is ready and media is video - calling bridge.play()");
        
        // Double check if the context is in a playable state
        if (bridge.videoContext.state === 'paused' || bridge.videoContext.state === 'suspended') {
          bridge.play();
          console.log("[handlePlay] Bridge play called successfully");
        } else {
          console.warn(`[handlePlay] VideoContext is in state: ${bridge.videoContext.state}, which may not respond to play()`);
          bridge.play(); // Try anyway
        }
      } else {
        console.warn(`[handlePlay] Bridge not ready, attempting direct video element fallback`);
        // FALLBACK: Try playing the video element directly if bridge isn't ready
        const video = videoRef.current;
        if (video && localMediaUrl) {
          try {
            // If we were reset, or we're using the start time, seek explicitly
            if (wasReset || Math.abs(video.currentTime - startTime) > 0.5) {
              video.currentTime = startTime;
            }
            
            // Set playing state FIRST so the animation frame loop kicks in
            setIsPlayingWithLog(true);
            
            // Then start playback
            video.play().catch(err => console.error("[handlePlay Video] Fallback video play error:", err));
            console.log("[handlePlay] Started fallback video directly");
          } catch (e) {
            console.error("[handlePlay Video] Error playing fallback video:", e);
          }
        } else {
          console.error(`[handlePlay] Cannot play - no video element or URL available`);
        }
      }
    } else if (isImageType(mediaType)) {
      // Image logic
      setIsPlayingWithLog(true);
      if (audioRef.current && audioUrl) {
        try {
            audioRef.current.currentTime = startTime; 
            audioRef.current.play().catch(err => console.error("[handlePlay Image] Error playing audio:", err));
        } catch (e) {
            console.warn("[handlePlay Image] Error setting audio time:", e);
        }
      }
    }
    
    // Set playback state and sync audio
    setIsPlayingWithLog(true);
    
    // Play separate audio if present
    if (audioRef.current && audioUrl) {
      try {
        // Ensure we have a time source
        if (bridge.videoContext) {
          audioRef.current.currentTime = bridge.videoContext.currentTime;
        } else {
          audioRef.current.currentTime = startTime;
        }
        audioRef.current.play().catch(err => console.error(`[handlePlay] Error playing audio:`, err));
      } catch (e) {
        console.warn("[handlePlay] Error setting/playing audio time:", e);
      }
    }
  }, [
      // Dependencies:
      bridge, 
      trimStart,
      audioUrl, audioRef,
      setIsPlayingWithLog,
      forceResetOnPlayRef, mediaType,
      justResetRef,
      isVideoType, isImageType,
      videoRef,
      localMediaUrl
  ]);
  
  const handleTimeUpdate = useCallback((newTime: number) => {
    // This handler is mainly for direct scrubbing/setting time, not continuous playback updates
    if (isImageType(mediaType)) {
      const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
      
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      setIsPlayingWithLog(false); // Use wrapper
      if (audioRef.current) audioRef.current.currentTime = clampedTime;
      if (forceResetOnPlayRef.current) forceResetOnPlayRef.current = false;
      return;
    }
    
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
    
    bridge.seek(clampedTime);
  }, [
    trimStart, trimEnd, // Read state from trim hook
    setIsPlayingWithLog, // Other callbacks
    audioRef, mediaType, imageTimerRef, forceResetOnPlayRef,
    bridge // *** ADDED bridge dependency ***
  ]);
  
  // SAFE ADDITION: Add the animation frame hook with required callbacks (just testing)
  // This won't replace the existing animation loop yet, just runs in parallel
  useAnimationFrameLoop({
    isPlaying,
    isReady,
    currentTime: bridge.currentTime,
    trimStart,
    trimEnd,
    onUpdate: (newTime) => {
      // Update both currentTime and visualTime 
      // setCurrentTime(newTime); // REMOVED: Bridge internally updates its currentTime
      
      // Only update visual time if not dragging scrubber
      // if (!isDraggingScrubber) {
      //   setCurrentTime(newTime);
      // }
    },
    onPause: handlePause,
    isImageType: isImageType(mediaType),
    animationFrameRef,
    forceResetOnPlayRef,
    // Additional needed properties
    audioRef,
    isDraggingScrubber,
    userTrimEndRef,
    // *** ADDED: Pass the new ref ***
    justResetRef,
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

  const handleScrubberDragStart = useCallback(() => {
    setIsDraggingScrubber(true);
    setOriginalPlaybackTime(bridge.currentTime); // Store time before drag
    setScrubTime(bridge.currentTime); // Initialize scrubTime
    if (isPlaying) handlePause();
  }, [isPlaying, isDraggingScrubber, bridge.currentTime, handlePause, setIsDraggingScrubber, setOriginalPlaybackTime, setScrubTime]); // Added setScrubTime

  const handleScrubberDragEnd = useCallback(() => {
    if (!isDraggingScrubber) return; // Only act if we were dragging
    
    // Use the final scrubTime for the definitive seek
    let finalTime = scrubTime !== null ? scrubTime : bridge.currentTime; 

    // Clamp the final time just in case
    finalTime = Math.max(0, Math.min(finalTime, duration));
    
    console.log(`[handleScrubberDragEnd] Drag ended. Seeking bridge to final time: ${finalTime.toFixed(3)}`);
    bridge.seek(finalTime);
    
    // Clean up dragging state
    setIsDraggingScrubber(false);
    setScrubTime(null); // Reset scrubTime

  }, [
    isDraggingScrubber, bridge.currentTime, duration, // Keep bridge.currentTime as fallback
    scrubTime, setScrubTime, // Add scrubTime state and setter
    forceResetOnPlayRef, setIsDraggingScrubber, // Other refs/setters
    bridge // Need bridge.seek
  ]);
  
  // *** ADDED: useEffect for global scrubber drag listeners ***
  useEffect(() => {
    if (!isDraggingScrubber) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const width = rect.width;
      const percent = Math.max(0, Math.min(1, x / width));
      const newTime = percent * duration;
      
      // Call the move handler to update visual time (scrubTime)
      handleScrubberDragMove(newTime); 
    };

    const handleGlobalMouseUp = () => {
      // Ensure any pending throttle is cleared on mouse up
      if (throttleSeekTimer.current) {
        clearTimeout(throttleSeekTimer.current);
        throttleSeekTimer.current = null;
      }
      // Call the existing end handler (which will do a final accurate seek)
      handleScrubberDragEnd(); 
    };

    // Add listeners to the document
    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    // Optional: Add mouseleave on documentElement as a safety net
    // document.documentElement.addEventListener('mouseleave', handleGlobalMouseUp);

    // Cleanup function
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      // document.documentElement.removeEventListener('mouseleave', handleGlobalMouseUp);
    };
  }, [
    isDraggingScrubber, 
    duration, 
    containerRef, 
    handleScrubberDragMove, // Depends on the modified handler
    handleScrubberDragEnd, 
    bridge // Keep bridge for throttled seek in move handler
  ]);
  
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
  
  // Get the effective trim end for display purposes
  const getEffectiveTrimEnd = () => {
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
        console.log(`[VideoElement] Time update: ${video.currentTime.toFixed(2)}s / ${video.duration.toFixed(2)}s`);
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
          
          // Set current time before playing
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

    // --- Return the cleanup function --- 
    return () => {
      const currentVideo = videoRef.current; // Use ref in cleanup
      if (currentVideo) {
        console.log("[DEBUG] Removing event listeners (metadata, timeupdate, error)");
        currentVideo.removeEventListener('loadedmetadata', handleMetadataLoaded);
        currentVideo.removeEventListener('timeupdate', timeUpdateHandler);
        currentVideo.removeEventListener('error', handleError);
      }
    };

  }, [
    // Dependencies
    isPlaying, mediaType, localMediaUrl, // Core state/props
    videoRef, canvasRef, // Refs
    isDraggingScrubber, // Interaction state
    setDuration, setIsReady, setTrimEnd, userTrimEndRef, trimManuallySet // REMOVED setCurrentTime
  ]);
  
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

  const handleTrimToggle = useCallback(() => {
      setTrimActive(prev => !prev);
  }, [setTrimActive]);

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
          // Visibility
          isHovering={isHovering}
          isPositionLocked={isPositionLocked}
          isMediumView={isMediumView ?? false}
          // Lock Button
          onLockToggle={handleLockToggle}
          // Timeline
          visualTime={scrubTime !== null ? scrubTime : bridge.currentTime}
          duration={duration}
          trimStart={trimStart}
          effectiveTrimEnd={getEffectiveTrimEnd()}
          activeHandle={activeHandle}
          trimActive={trimActive}
          isDraggingScrubber={isDraggingScrubber}
          onTimeUpdate={handleScrubberDragMove}
          onScrubberDragStart={handleScrubberDragStart}
          onScrubberDragEnd={handleScrubberDragEnd}
          setActiveHandle={setActiveHandle}
          setTimeBeforeDrag={setTimeBeforeDrag}
          setOriginalPlaybackTime={setOriginalPlaybackTime}
          getEffectiveTrimEnd={getEffectiveTrimEnd}
          // Time Display
          currentTime={bridge.currentTime}
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