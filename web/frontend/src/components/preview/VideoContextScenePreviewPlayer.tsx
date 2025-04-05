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

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { PlayIcon, PauseIcon, LockIcon, UnlockIcon, ScissorsIcon, CheckIcon, Maximize2 as FullscreenIcon, Minimize2 as ExitFullscreenIcon } from 'lucide-react';
import { VideoContextProvider } from '@/contexts/VideoContextProvider';
import MediaDownloadManager from '@/utils/media/mediaDownloadManager';
import EditHistoryManager, { ActionType } from '@/utils/video/editHistoryManager';
import { CSSProperties } from 'react';
import { useMediaAspectRatio } from '@/hooks/useMediaAspectRatio';
import { useProject } from '@/contexts/ProjectContext';
// import { useVideoContextPlayer } from '@/contexts/VideoContextPlayerContext'; // Commented out
// import { formatTime } from '@/lib/utils'; // Removed - defined below
// import { isVideoType, isImageType } from '@/lib/media-utils'; // Removed - defined below
import { default as VideoContext } from 'videocontext';
import { useTrimControls } from '@/hooks/useTrimControls';

// Add global tracking counters to help debug the issue
const DEBUG_COUNTERS = {
  totalImageAttempts: 0,
  videoContextSuccess: 0,
  videoContextFailure: 0,
  fallbackSuccess: 0,
  fallbackFailure: 0
};

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

// Add Info icon for aspect ratio display toggle
const InfoIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="12" 
    height="12" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
);

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
}) => {
  // Immediately log media information for debugging
  console.log(`[CRITICAL-DEBUG] Component mounted for scene ${sceneId}:`, {
    mediaType,
    mediaUrl: mediaUrl.substring(0, 50) + '...',
    isImageMedia: mediaType === 'image' || mediaType === 'gallery',
    thumbnailUrl: thumbnailUrl ? (thumbnailUrl.substring(0, 50) + '...') : 'none',
    initialMediaAspectRatio
  });

  // State for player
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState<boolean>(false);
  const forceResetOnPlayRef = useRef<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  const [originalPlaybackTime, setOriginalPlaybackTime] = useState<number>(0);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // VideoContext state
  const [videoContext, setVideoContext] = useState<any>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // State for video dimensions (to pass to the hook)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  
  // Add state for local media
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  // Add state for fallback image rendering
  const [useImageFallback, setUseImageFallback] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Get singletons for media and edit history management
  const mediaManager = useRef(MediaDownloadManager.getInstance());
  const historyManager = useRef(EditHistoryManager.getInstance());

  // Add ref for animation frame
  const animationFrameRef = useRef<number | undefined>(undefined);

  // Add state to track visual playback position separate from actual time
  const [visualTime, setVisualTime] = useState<number>(0);

  // Add state for first frame capture
  const [showFirstFrame, setShowFirstFrame] = useState<boolean>(true);
  
  // Add video element ref for first frame capture
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State for aspect ratio display toggle
  const [showAspectRatio, setShowAspectRatio] = useState<boolean>(false);

  // Add a ref to track playing state
  const isPlayingRef = useRef<boolean>(false);

  // Add state for temporary aspect ratio indicator display
  const [showTemporaryIndicator, setShowTemporaryIndicator] = useState<boolean>(true);

  // *** ADD call to useTrimControls hook ***
  const {
    trimStart,       // Use from hook
    setTrimStart,    // Use from hook
    trimEnd,         // Use from hook
    setTrimEnd,      // Use from hook
    activeHandle,    // Use from hook
    setActiveHandle, // Use from hook
    trimManuallySet, // Use from hook
    setTrimManuallySet, // Use from hook
    userTrimEndRef,  // Use from hook
    timeBeforeDrag,    // Use from hook
    setTimeBeforeDrag  // Use from hook
  } = useTrimControls({
    initialTrimStart: trim.start, // Pass initial value from props
    initialTrimEnd: trim.end,     // Pass initial value from props
    initialDuration: duration     // Pass current duration state
  });
  
  // Call the new hook
  const {
    mediaElementStyle,
    calculatedAspectRatio,
  } = useMediaAspectRatio({
    initialMediaAspectRatio,
    projectAspectRatio,
    showLetterboxing,
    mediaType,
    videoDimensions,
  });

  // Add useEffect for temporary aspect ratio display on mount
  useEffect(() => {
    // Show indicator when component mounts (new scene)
    setShowTemporaryIndicator(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryIndicator(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [sceneId]); // Re-run when sceneId changes (new scene)
  
  // Add useEffect for aspect ratio changes
  useEffect(() => {
    // Show indicator when aspect ratio changes
    setShowTemporaryIndicator(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryIndicator(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [projectAspectRatio]); // Re-run when projectAspectRatio changes

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
      
      // --- ADD LOGGING BEFORE SETTING STATE ---
      console.log(`[GetLocalMedia] Download successful for ${sceneId}. Object URL obtained: ${objectUrl ? 'Exists' : 'NULL/Undefined'}`);
      if (objectUrl) {
         console.log(`[GetLocalMedia] Attempting to set local media URL for ${sceneId}`);
         setLocalMediaUrl(objectUrl);
      } else {
         console.warn(`[GetLocalMedia] Download reported success but objectUrl is invalid for ${sceneId}`);
         setLocalMediaUrl(null); // Ensure fallback if URL is invalid
      }
      // --- END ADDED LOGGING ---

    } catch (error) {
      console.error(`[GetLocalMedia] Error downloading media for scene ${sceneId}:`, error);
      setLocalMediaUrl(null); // Fallback to direct URL if download fails
    } finally {
       // Ensure isLoading is always set to false eventually
       console.log(`[GetLocalMedia] Setting isLoading to false in finally block for ${sceneId}`);
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
        console.log(`[AudioDiag][Effect VIDEO] Calling audio.play() due to isPlaying=true`);
        audioRef.current.play().catch(err => console.error("[AudioDiag] Effect Play Error:", err));
      } else {
        console.log(`[AudioDiag][Effect VIDEO] Calling audio.pause() due to isPlaying=false`);
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl, audioRef, mediaType]); // Added mediaType dependency
  
  // VideoContext initialization
  useEffect(() => {
    console.log(`[Diag STEP 1] VideoContext Init Effect START for ${sceneId}. localMediaUrl: ${localMediaUrl ? 'Exists' : 'NULL/Undefined'}, mediaType: ${mediaType}`);

    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !localMediaUrl || !isVideoType(mediaType)) {
      console.log(`[Diag STEP 2 Bail] Bailing Init Effect for ${sceneId}. Conditions: canvas=${!!canvas}, container=${!!containerRef.current}, localMediaUrl=${!!localMediaUrl}, isVideo=${isVideoType(mediaType)}`);
      return; // Bail out if refs not ready, no local URL, or not a video
    }

    let setupComplete = false;
    let cleanupFunc: (() => void) | null = null;
    let isMounted = true; // Track mount status
    console.log(`[INIT-DEBUG] Starting initialization for scene ${sceneId}, mediaType=${mediaType}`);

    const baseSize = 1920;
    let canvasWidth: number, canvasHeight: number;

    const initVideoContext = async () => {
      console.log(`[Diag STEP 3] Running initVideoContext async function for ${sceneId}`);
      try {
        // Clean up existing context if any
        if (videoContext) {
          console.log(`[INIT-DEBUG] Cleaning up existing context for ${sceneId}`);
          try {
            videoContext.reset();
            if (typeof videoContext.dispose === 'function') {
              videoContext.dispose();
            }
          } catch (cleanupError) {
            console.error(`[INIT-DEBUG] Error during context cleanup:`, cleanupError);
          }
          setVideoContext(null);
        }
        
        // Dynamically import VideoContext
        console.log(`[INIT-DEBUG] Importing VideoContext module`);
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
        // Set canvas internal resolution
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        console.log(`[INIT-DEBUG] Canvas internal dimensions set to ${canvas.width}x${canvas.height} based on initial ratio ${initialRatioForCanvas.toFixed(4)}`);

        const ctx = new VideoContext(canvas);
        if (!ctx) throw new Error('Failed to create VideoContext instance');
        console.log(`[INIT-DEBUG] VideoContext created successfully`);
        setVideoContext(ctx);

        let source: any;
        if (mediaType === 'video') {
          if (!localMediaUrl) throw new Error('[VideoCtx Init] No media URL available for video source inside init function');
          source = ctx.video(localMediaUrl);
          if (!source) throw new Error('Failed to create video source');
          console.log(`[INIT-DEBUG] Video source created successfully`);

          source.connect(ctx.destination);
          source.start(0);
          source.stop(300); // 5 minute max duration
          console.log(`[INIT-DEBUG] Source connected and configured`);

          source.registerCallback('loaded', () => {
            if (!isMounted) return;
            console.log(`[INIT-DEBUG] Video loaded callback fired for ${sceneId}`);
            // Ensure isLoading is set false here too
            setIsLoading(false);
            setIsReady(true);
            setupComplete = true;

            if (source.element) {
              const videoElement = source.element as HTMLVideoElement;
              const videoDuration = videoElement.duration;
              const videoWidth = videoElement.videoWidth;
              const videoHeight = videoElement.videoHeight;
              console.log(`[INIT-DEBUG] Video metadata: Duration=${videoDuration}, Dimensions=${videoWidth}x${videoHeight}`);
              setDuration(videoDuration);

              // Set video dimensions state
              if (videoWidth > 0 && videoHeight > 0) {
                setVideoDimensions({ width: videoWidth, height: videoHeight });
              }

              if (trimEnd <= 0 || trimEnd === 10) {
                setTrimEnd(videoDuration);
              }
              if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
                userTrimEndRef.current = videoDuration;
              }
            }
          });
          
          source.registerCallback('error', (err: any) => {
             console.error(`[INIT-DEBUG] VideoContext source node error for ${sceneId}:`, err);
             if (!isMounted) return;
             setIsLoading(false); // Also set loading false on source error
             setIsReady(false);
          });
          
          // Register time update callback from VideoContext if available
          let timeUpdateRegistered = false;
          if (typeof ctx.registerTimeUpdateCallback === 'function') {
            ctx.registerTimeUpdateCallback((time: number) => {
              // Directly update state from the library's callback
              setCurrentTime(time);
            });
            timeUpdateRegistered = true;
            console.log('[VideoCtx Init] Registered time update via registerTimeUpdateCallback');
          } else if (typeof ctx.registerCallback === 'function') {
            ctx.registerCallback('timeupdate', () => {
              // Directly update state from the library's callback
              setCurrentTime(ctx.currentTime);
            });
            timeUpdateRegistered = true;
            console.log('[VideoCtx Init] Registered time update via registerCallback("timeupdate")');
          }
        }
        
        return {
          context: ctx,
          source
        };
      } catch (error) {
        // --- ADD MORE EXPLICIT ERROR LOGGING ---
        console.error(`[VideoCtx Init] EXCEPTION during initialization for ${sceneId}:`, error);
        if (error instanceof Error) {
            console.error(`[VideoCtx Init] Error Message: ${error.message}`);
            console.error(`[VideoCtx Init] Error Stack: ${error.stack}`);
        }
        // --- END ADDED LOGGING ---
        if (isMounted) {
            setIsLoading(false);
            setIsReady(false);
        }
        return null;
      }
    };
    
    // Run initialization and handle results
    const setupPromise = initVideoContext();
    
    setupPromise.then(result => {
      if (!isMounted) return;
      if (result && result.context) {
        console.log(`[VideoCtx Init] Setup promise resolved successfully for ${sceneId}`);
        // setVideoContext(result.context); // Already set inside initVideoContext
        // setIsReady(true); // Already set inside initVideoContext loaded callback
      } else {
        console.warn(`[VideoCtx Init] Setup promise resolved but no context/result for ${sceneId}`);
        setIsReady(false); // Ensure ready is false if setup failed
      }
    }).catch(error => {
      if (!isMounted) return;
      console.error(`[VideoCtx Init] Setup promise REJECTED for ${sceneId}:`, error);
      setIsReady(false);
      setIsLoading(false); // Ensure loading is false on promise rejection
    });
    
    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
      console.log(`[VideoCtx Init Cleanup] Running cleanup for scene ${sceneId}`);
      // ... (rest of cleanup)
    };
  // Updated dependencies: Include sceneId for logging clarity, maybe initialMediaAspectRatio if needed for canvas sizing?
  }, [localMediaUrl, mediaType, sceneId, initialMediaAspectRatio]); 
  
  // Update the setIsPlayingWithLog function to update both state and ref
  const setIsPlayingWithLog = useCallback((value: boolean) => {
    console.log(`[DEBUG-STATE] Setting isPlaying from ${isPlaying} to ${value}`);
    // Update the ref first - this is what animation will check
    isPlayingRef.current = value;
    // Then update React state for UI
    setIsPlaying(value);
  }, [setIsPlaying]);
  
  // Handle play/pause with trim boundaries
  const handlePlay = useCallback(() => {
    console.log(`[PLAY-DEBUG] Play requested for media type: ${mediaType}`);
    
    // --- Check force reset flag --- 
    if (forceResetOnPlayRef.current) {
        console.warn(`[PLAY-DEBUG] Force reset flag is true. Resetting time to trimStart (${trimStart}) before playing.`);
        if (videoContext) {
            videoContext.currentTime = trimStart;
        }
        setCurrentTime(trimStart); // Update React state too
        forceResetOnPlayRef.current = false; // Reset the flag
    }
    // --- END Check force reset flag --- 
    
    // For images without VideoContext, update state and start animation
    if (isImageType(mediaType)) {
      // Handle image playback 
      setIsPlayingWithLog(true);
      
      // Play the audio if available
      if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = currentTime;
        audioRef.current.play().catch(err => console.error("[PLAY-DEBUG] Error playing audio for image:", err));
      }
      
      // Rest of image play logic remains the same
      return;
    }
    
    // For videos with VideoContext
    console.log(`[PLAY-DEBUG] Video play - checking VideoContext availability. Current state:`, {
      videoContextExists: !!videoContext,
      isReady,
      hasCanvas: !!canvasRef.current,
      currentTime
    });
    
    if (!videoContext) {
      console.error(`[PLAY-DEBUG] Cannot play - videoContext is null`);
      return;
    }
    
    if (!isReady) {
      console.error(`[PLAY-DEBUG] Cannot play - videoContext exists but not ready yet`);
      return;
    }
    
    // Ensure canvas is visible
    if (canvasRef.current) {
      canvasRef.current.style.display = 'block';
      canvasRef.current.style.zIndex = '10';
      console.log(`[PLAY-DEBUG] Made canvas visible`);
    }
    
    // Hide first frame video when playing
    if (videoRef.current) {
      videoRef.current.style.display = 'none';
      console.log(`[PLAY-DEBUG] Hid first frame video element`);
    }
    
    // When playing video, switch from first frame to canvas
    setShowFirstFrame(false);
    
    // Reset time if needed
    if (currentTime < trimStart || currentTime >= trimEnd) {
      console.log(`[PLAY-DEBUG] Current time ${currentTime} is outside trim bounds [${trimStart}, ${trimEnd}], resetting to ${trimStart}`);
      
      try {
        videoContext.currentTime = trimStart;
        setCurrentTime(trimStart);
      } catch (timeSetError) {
        console.error(`[PLAY-DEBUG] Error setting current time:`, timeSetError);
      }
    }
    
    // Try to play
    try {
      // Verify play method exists
      if (typeof videoContext.play !== 'function') {
        console.error(`[PLAY-DEBUG] videoContext.play is not a function`);
        return;
      }
      
      console.log(`[PLAY-DEBUG] Calling videoContext.play()`);
      videoContext.play();
      console.log(`[PLAY-DEBUG] VideoContext play() called successfully`);
      
      // Set state AFTER play called
      setIsPlayingWithLog(true);
      
      // Sync audio
      if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = videoContext.currentTime;
        audioRef.current.play().catch(err => console.error(`[PLAY-DEBUG] Error playing audio:`, err));
      }
    } catch (error) {
      console.error(`[PLAY-DEBUG] Error calling play():`, error);
    }
  }, [isPlaying, videoContext, isReady, currentTime, trimStart, trimEnd, setIsPlayingWithLog, audioRef, audioUrl, videoRef, setShowFirstFrame, setCurrentTime]); // Added setCurrentTime
  
  const handlePause = useCallback(() => {
    // For images without VideoContext, just update the state
    if (isImageType(mediaType)) {
      console.log(`[DEBUG-TIMER] Pause called: currentTime=${currentTime.toFixed(2)}, isPlaying=${isPlaying}, isPlayingRef=${isPlayingRef.current}`);
      
      // Set state
      setIsPlayingWithLog(false);
      
      // Pause audio if available
      if (audioRef.current) {
        console.log(`[AudioDiag][handlePause IMAGE] Calling pause()`);
        audioRef.current.pause();
      }
      
      // Clear the timer
      if (imageTimerRef.current !== null) {
        console.log(`[DEBUG-TIMER] Clearing interval timer`);
        window.clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      
      // Reset the force reset flag on pause
      if (forceResetOnPlayRef.current) {
        console.log("[PAUSE-DEBUG] Resetting forceResetOnPlayRef flag.");
        forceResetOnPlayRef.current = false;
      }
      
      return;
    }
    
    // For videos with VideoContext - capture current state to avoid race conditions
    const currentVideoContext = videoContext;
    
    if (!currentVideoContext) {
      console.log(`[VideoContext PAUSE] Cannot pause - videoContext is not available`);
      return;
    }

    console.log("[VideoContext PAUSE] Pausing playback", {
      currentTime: currentVideoContext.currentTime,
      trimStart,
      trimEnd,
      "trim.end": trim.end,
      "trimManuallySet": trimManuallySet
    });
    
    try {
      if (typeof currentVideoContext.pause === 'function') {
        console.log(`[VideoContext PAUSE] Calling videoContext.pause()`);
        currentVideoContext.pause();
        console.log(`[VideoContext PAUSE] Pause called successfully`);
      } else {
        console.error(`[VideoContext PAUSE] videoContext.pause is not a function`);
      }
    } catch (err) {
      console.error(`[VideoContext PAUSE] Error calling pause:`, err);
    }
    
    setIsPlayingWithLog(false);
    
    // Cancel animation frame on pause
    if (animationFrameRef.current) {
      console.log(`[VideoContext PAUSE] Cancelling animation frame`);
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Pause the audio too
    if (audioRef.current) {
      console.log(`[AudioDiag][handlePause VIDEO] Calling pause()`);
      audioRef.current.pause();
    }
  }, [isPlaying, videoContext, setIsPlayingWithLog, audioRef, trimStart, trimEnd, trimManuallySet]);
  
  // Handle seeked time update
  const handleTimeUpdate = useCallback((newTime: number) => {
    // For images, update state directly and sync audio if available
    if (isImageType(mediaType)) {
      const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd);
      setCurrentTime(clampedTime);
      
      // Update audio position too
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
      }
      
      // Reset the force reset flag on manual scrub
      if (forceResetOnPlayRef.current) {
        console.log("[SCRUB-DEBUG] Resetting forceResetOnPlayRef flag.");
        forceResetOnPlayRef.current = false;
      }
      
      return;
    }
    
    // For videos with VideoContext
    if (!videoContext) return;
    
    // Keep time within trim boundaries
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd);
    console.log(`[VideoContext] Scrubbing time update: requested=${newTime}, clamped=${clampedTime}, limits=[${trimStart}, ${trimEnd}], duration=${duration}`);
    videoContext.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    
    // Update audio position too
    if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
  }, [isPlaying, videoContext, currentTime, trimStart, trimEnd, setCurrentTime, audioRef]);
  
  // Function to convert range input value to timeline position
  const timelineValueToPosition = (value: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return currentTime;
    }
    const position = (value / 100) * duration;
    console.log(`[VideoContext] Timeline value ${value}% -> position ${position}s (duration: ${duration}s)`);
    return position;
  };
  
  // Function to convert timeline position to range input value
  const positionToTimelineValue = (position: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return (currentTime / duration) * 100;
    }
    const value = (position / duration) * 100;
    console.log(`[VideoContext] Position ${position}s -> timeline value ${value}% (duration: ${duration}s)`);
    return value;
  };
  
  // Get the effective trim end for display purposes
  const getEffectiveTrimEnd = () => {
    // If we have a user-set value, use it
    if (userTrimEndRef.current !== null) {
      console.log(`[VideoContext] Using userTrimEndRef value: ${userTrimEndRef.current}`);
      return userTrimEndRef.current;
    }
    
    // If trimEnd from state is valid (not zero), use it
    if (trimEnd > 0) {
      console.log(`[VideoContext] Using trimEnd state value: ${trimEnd}`);
      return trimEnd;
    }
    
    // If duration is known, use that
    if (duration > 0) {
      console.log(`[VideoContext] Using duration value: ${duration}`);
      return duration;
    }
    
    // Fallback to a reasonable default (10 seconds)
    console.log(`[VideoContext] Using default 10 seconds value`);
    return 10;
  };
  
  // Get container style with letterboxing/pillarboxing
  const getContainerStyle = useCallback(() => {
    console.log(`[VideoContextScenePreviewPlayer] Calculating container style for scene ${sceneId}:`, {
      receivedProjectAspectRatio: projectAspectRatio,
      isCompactView
    });
    const [width, height] = projectAspectRatio.split(':').map(Number);
    const containerStyle: CSSProperties = {
      backgroundColor: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      height: isCompactView ? '190px' : 'auto',
      zIndex: 1,
    };
    containerStyle.aspectRatio = projectAspectRatio.replace(':', '/');
    console.log(`[VideoContextScenePreviewPlayer] Final container style for scene ${sceneId}:`, {
      projectAspectRatio,
      containerStyle,
      isCompactView,
      effectiveAspectRatio: containerStyle.aspectRatio
    });
    return containerStyle;
  }, [projectAspectRatio, isCompactView, sceneId]);
  
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
  
  // --- ADDED BACK from commit 04c71be --- 
  // Memoized function to handle mouse movement during trim bracket drag
  const handleTrimDragMove = useCallback((event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    // Use activeHandle from useTrimControls hook
    if (!activeHandle || !containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const percentPosition = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const newTime = (percentPosition / 100) * duration;
    let visualUpdateTime = newTime;

    if (activeHandle === 'start') {
      const newStart = Math.max(0, Math.min(newTime, trimEnd - 0.1)); // Use trimEnd from hook
      setTrimStart(newStart); // Use setTrimStart from hook
      if (onTrimChange) onTrimChange(newStart, trimEnd); // Use trimEnd from hook
      visualUpdateTime = newStart;
      if (videoContext) {
        videoContext.currentTime = visualUpdateTime;
      }
    } else { // activeHandle === 'end'
      const newEnd = Math.min(duration, Math.max(newTime, trimStart + 0.1)); // Use trimStart from hook
      setTrimEnd(newEnd); // Use setTrimEnd from hook
      userTrimEndRef.current = newEnd; // Use userTrimEndRef from hook
      if (onTrimChange) onTrimChange(trimStart, newEnd); // Use trimStart from hook
      visualUpdateTime = newEnd;
      if (videoContext) {
        videoContext.currentTime = visualUpdateTime; 
      }
    }

    setVisualTime(visualUpdateTime);
    if (audioRef.current && isPlaying) {
        audioRef.current.currentTime = visualUpdateTime;
    }

    setTrimManuallySet(true); // Use setTrimManuallySet from hook
  }, [activeHandle, containerRef, duration, trimEnd, trimStart, onTrimChange, videoContext, setTrimStart, setTrimEnd, setVisualTime, setTrimManuallySet, audioRef, isPlaying]); // Ensure all dependencies (incl. hook setters) are present

  // Memoized function to handle mouse up/leave during trim bracket drag
  const handleTrimDragEnd = useCallback(() => {
    // Use activeHandle from hook
    if (!activeHandle) return;
    
    console.log(`[TrimDrag] Drag ended for handle: ${activeHandle}`);
    const wasHandleActive = activeHandle;
    setActiveHandle(null); // Use setActiveHandle from hook
    document.body.style.cursor = 'default';

    const finalTrimEnd = userTrimEndRef.current ?? trimEnd; // Use userTrimEndRef and trimEnd from hook
    const currentValidTrimStart = trimStart; // Use trimStart from hook
    const currentPlayheadTime = videoContext ? videoContext.currentTime : currentTime;
    console.log(`[TrimDragEnd DEBUG] Values Before Snap Check:`, { /* ... */ });
    
    if (wasHandleActive === 'end') {
        console.warn(`[TrimDragEnd] Right handle released. Forcing pause, setting state, setting reset flag, and snapping playhead to start (${currentValidTrimStart}).`);
        handlePause(); 
        setIsPlayingWithLog(false); // Use setIsPlayingWithLog
        forceResetOnPlayRef.current = true;
        
        if (videoContext) {
            videoContext.currentTime = currentValidTrimStart;
        }
        setCurrentTime(currentValidTrimStart); 
        setVisualTime(currentValidTrimStart); 
    } else {
      console.log(`[TrimDragEnd] Left handle released. No snap needed.`);
      forceResetOnPlayRef.current = false;
    }
    
    setTimeBeforeDrag(0); // Use setTimeBeforeDrag from hook, reset to 0
    
  }, [activeHandle, setActiveHandle, videoContext, currentTime, trimStart, trimEnd, userTrimEndRef, timeBeforeDrag, setCurrentTime, setVisualTime, setTimeBeforeDrag, handlePause, setIsPlayingWithLog]); // Check dependencies
  // --- END ADDED BACK --- 

  // --- ADDED BACK EFFECT for listeners from commit 04c71be --- 
  useEffect(() => {
    // Only attach listeners if a handle is active (use activeHandle from hook)
    if (!activeHandle) return;

    console.log(`[TrimDrag] Attaching listeners for active handle: ${activeHandle}`);
    const ownerDocument = containerRef.current?.ownerDocument || document;

    // Use the memoized callbacks defined above
    const moveHandler = (e: MouseEvent) => handleTrimDragMove(e);
    const endHandler = () => handleTrimDragEnd();

    ownerDocument.body.style.cursor = 'ew-resize';
    ownerDocument.addEventListener('mousemove', moveHandler);
    ownerDocument.addEventListener('mouseup', endHandler);
    ownerDocument.addEventListener('mouseleave', endHandler);

    return () => {
      console.log(`[TrimDrag] Cleaning up listeners for handle: ${activeHandle}`);
      ownerDocument.removeEventListener('mousemove', moveHandler);
      ownerDocument.removeEventListener('mouseup', endHandler);
      ownerDocument.removeEventListener('mouseleave', endHandler);
      // Use activeHandle from hook in check
      if (!activeHandle) { 
         ownerDocument.body.style.cursor = 'default';
      }
    };
    // Depend on the memoized handlers and activeHandle from hook
  }, [activeHandle, handleTrimDragMove, handleTrimDragEnd]);
  // --- END ADDED BACK EFFECT --- 

  // Add useEffect for temporary aspect ratio display on mount
  useEffect(() => {
    // Show indicator when component mounts (new scene)
    setShowTemporaryIndicator(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryIndicator(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [sceneId]); // Re-run when sceneId changes (new scene)
  
  // Add useEffect for aspect ratio changes
  useEffect(() => {
    // Show indicator when aspect ratio changes
    setShowTemporaryIndicator(true);
    
    // Hide after 2 seconds
    const timer = setTimeout(() => {
      setShowTemporaryIndicator(false);
    }, 2000);
    
    return () => clearTimeout(timer);
  }, [projectAspectRatio]); // Re-run when projectAspectRatio changes

  // Add a timer ref alongside other refs
  const imageTimerRef = useRef<number | null>(null);
  
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
  
  // Effect to manage canvas visibility based on play state
  useEffect(() => {
    if (!canvasRef.current) {
      console.log(`[DIAG-CANVAS] Canvas not available, cannot update visibility`);
      return;
    }

    // Log the current visibility state
    console.log(`[DIAG-CANVAS] Managing canvas visibility:`, {
      isPlaying,
      mediaType,
      currentCanvas: {
        display: canvasRef.current.style.display,
        zIndex: canvasRef.current.style.zIndex,
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        inDOM: !!canvasRef.current.parentElement
      },
      firstFrameVideo: videoRef.current ? {
        display: videoRef.current.style.display,
        visibility: videoRef.current.style.visibility
      } : 'not available'
    });
    
    // For videos, make the canvas visible when playing
    if (isPlaying && !isImageType(mediaType)) {
      console.log('[DIAG-CANVAS] Making canvas visible for video playback');
      canvasRef.current.style.display = 'block';
      canvasRef.current.style.zIndex = '10';
      
      // Hide the first frame when canvas is playing
      if (videoRef.current) {
        console.log('[DIAG-CANVAS] Hiding first frame video element');
        videoRef.current.style.display = 'none';
      }
      
      // After applying changes, verify the canvas state
      setTimeout(() => {
        if (canvasRef.current) {
          console.log(`[DIAG-CANVAS] Canvas state after visibility update:`, {
            display: canvasRef.current.style.display,
            zIndex: canvasRef.current.style.zIndex,
            width: canvasRef.current.width,
            height: canvasRef.current.height,
            computedStyle: window.getComputedStyle(canvasRef.current).display
          });
        }
      }, 10);
    } else {
      // When not playing video, hide the canvas and show the first frame
      console.log('[DIAG-CANVAS] Setting canvas display for non-playing state');
      canvasRef.current.style.display = isImageType(mediaType) ? 'none' : 'block';
      
      // Show the first frame when video is not playing
      if (videoRef.current && !isPlaying && mediaType === 'video') {
        console.log('[DIAG-CANVAS] Making first frame video visible');
        videoRef.current.style.display = 'block';
      }
    }
  }, [isPlaying, mediaType]);
  
  // --- ADD TIME UPDATE LOOP (Controlled by isPlaying) --- 
  // This useEffect is now the primary mechanism for updating currentTime via rAF
  useEffect(() => {
    let isActive = true;
    const updateTime = () => {
      // Guard against updates after unmount or if context/playing state changed
      if (!isActive || !videoContext || !isPlayingRef.current) return;

      // Read the current time directly from VideoContext
      const time = videoContext.currentTime;
      
      // Update the React state
      setCurrentTime(time);
        
      // Check trim boundaries (moved this check out of the main time update logic)
      // It should ideally be handled by the pause logic triggered by VideoContext events if possible,
      // but keep a secondary check here for now.
      const actualTrimEnd = userTrimEndRef.current !== null ? userTrimEndRef.current : trimEnd;
      if (time >= actualTrimEnd) {
          console.warn(`[rAF Time Loop] Reached end boundary (${time} >= ${actualTrimEnd}), pausing.`);
          handlePause(); // Call pause handler
          // We might want to seek back to trimStart here if handlePause doesn't do it reliably
          // videoContext.currentTime = trimStart;
          // setCurrentTime(trimStart);
          return; // Stop the loop for this frame after pausing
      } else if (time < trimStart) {
          // If somehow time gets before trimStart, force it back
          // This might happen due to seeking or precision issues
          console.warn(`[rAF Time Loop] Time (${time}) is before trimStart (${trimStart}), seeking forward.`);
          videoContext.currentTime = trimStart;
          setCurrentTime(trimStart); // Update state as well
      }
        
      // Schedule the next frame if still playing and active
      if (isActive && isPlayingRef.current) {
         animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    // Start the loop only if playing
    if (isPlaying) {
      isPlayingRef.current = true; // Ensure ref is synced
      console.log("[rAF Time Loop] Starting loop because isPlaying is true.");
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      // Ensure ref is synced and cancel any existing frame request if stopped
      isPlayingRef.current = false;
      if (animationFrameRef.current) {
        console.log("[rAF Time Loop] Cancelling loop because isPlaying is false.");
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    // Cleanup function
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        console.log("[rAF Time Loop] Cleaning up animation frame.");
        cancelAnimationFrame(animationFrameRef.current);
      }
      isPlayingRef.current = false; // Ensure ref is false on cleanup
    };
  // Dependencies: React to changes in playing state, context availability, and trim boundaries
  }, [isPlaying, videoContext, trimStart, trimEnd, handlePause]); // Added handlePause
  
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
  
  // Fix container hierarchy without disrupting controls
  return (
    <div 
      className={`relative bg-gray-800 flex items-center justify-center ${className} cursor-pointer`}
      style={{
        width: '100%',
        height: isCompactView ? '190px' : 'auto',
        aspectRatio: !isCompactView ? projectAspectRatio.replace(':', '/') : undefined,
        overflow: 'hidden'
      }}
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      data-testid="video-context-preview"
      onClick={(e) => {
        // Don't trigger play/pause if clicking on interactive elements
        const target = e.target as HTMLElement;
        const isButton = target.tagName === 'BUTTON' || 
                        target.closest('button') !== null ||
                        target.closest('[data-drag-handle-exclude]') !== null;
        
        if (!isButton) {
          isPlaying ? handlePause() : handlePlay();
          console.log(`[VideoContext] Container clicked: isPlaying=${isPlaying} -> ${!isPlaying}`);
        }
      }}
    >
      {/* Black inner container for letterboxing/pillarboxing */}
      <div 
        className="bg-black flex items-center justify-center w-full h-full relative"
        style={getMediaContainerStyle()}
      >
        {/* Add aspect ratio indicator for debugging */}
        {(showAspectRatio || showTemporaryIndicator) && (
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 px-2 py-0.5 text-white rounded whitespace-nowrap"
            style={{ 
              zIndex: 60, 
              pointerEvents: 'none', 
              top: '0px',
              fontSize: '0.65rem',
              opacity: showTemporaryIndicator ? '0.8' : '1',
              display: 'flex',
              gap: '4px'
            }}
          >
            {/* Calculate the closest standard aspect ratio */}
            {(() => {
              // Function to find closest standard aspect ratio
              const exactRatio = calculatedAspectRatio;
              
              // Common standard aspect ratios as [name, decimal value]
              type RatioType = [string, number];
              const standardRatios: RatioType[] = [
                ['9:16', 0.5625], // 0.5625 - vertical smartphone
                ['3:4', 0.75],    // 0.75 - classic portrait
                ['1:1', 1],       // 1.0 - square
                ['4:3', 1.33],    // 1.33 - classic TV/monitor
                ['16:9', 1.78]    // 1.78 - widescreen
              ];
              
              // Find the closest standard ratio
              let closestRatio = standardRatios[0];
              let smallestDiff = Math.abs(exactRatio - standardRatios[0][1]);
              
              for (let i = 1; i < standardRatios.length; i++) {
                const diff = Math.abs(exactRatio - standardRatios[i][1]);
                if (diff < smallestDiff) {
                  smallestDiff = diff;
                  closestRatio = standardRatios[i];
                }
              }
              
              // Format and return the new display string
              return (
                <>
                  <span style={{ color: '#fff' }}>{exactRatio.toFixed(2)}</span>
                  <span style={{ color: '#fff' }}>[{closestRatio[0]}]</span>
                  <span style={{ color: '#4ade80' }}>{projectAspectRatio}</span>
                </>
              );
            })()}
          </div>
        )}
        
        {/* Add style tag for custom range styling */}
        <style>{smallRangeThumbStyles}</style>
        
        {/* Separate audio element for voiceover */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            preload="auto"
            style={{ display: 'none' }}
            data-testid="audio-element"
            onLoadedMetadata={() => {
              // Update duration for images when audio loads
              if (mediaType === 'image' && audioRef.current) {
                console.log(`[VideoContext] Audio loaded for image, duration: ${audioRef.current.duration}`);
                setDuration(audioRef.current.duration);
                setTrimEnd(audioRef.current.duration);
              }
            }}
          />
        )}
        
        {/* Media Display */}
        <div 
          className="relative bg-black flex items-center justify-center"
          style={{
            ...mediaElementStyle,
            position: 'relative', 
            zIndex: 5 // Ensure media container has proper z-index
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
          
          {/* First frame video element (visible when not playing) */}
          {mediaType === 'video' && showFirstFrame && (
            <video
              ref={videoRef}
              className="w-auto h-auto"
              style={{
                ...mediaElementStyle,
                pointerEvents: 'none' // Ensure all videos have pointer-events: none
              }}
              playsInline
              muted
              preload="auto"
              data-testid="first-frame-video"
            />
          )}
          
          {/* Image fallback for static images */}
          {isImageType(mediaType) && (
            <img
              ref={imgRef}
              src={mediaUrl} 
              alt="Scene content"
              className="w-auto h-auto max-w-full max-h-full"
              style={{
                ...mediaElementStyle,
                objectFit: 'contain',
                zIndex: 10,
                maxHeight: isCompactView ? '190px' : mediaElementStyle.maxHeight,
                pointerEvents: 'none' // Ensure all clicks pass through
              }}
              data-testid="fallback-image"
              onLoad={() => {
                const instanceId = `${sceneId}-${Math.random().toString(36).substr(2, 9)}`;
                console.log(`[DEBUG-FALLBACK][${instanceId}] Image loaded successfully`);
                
                // For images with audio, use audio duration
                if (audioRef.current && audioRef.current.duration) {
                  setDuration(audioRef.current.duration);
                  setTrimEnd(audioRef.current.duration);
                } else {
                  // Default duration for images without audio
                  setDuration(30);
                  setTrimEnd(30);
                }
                
                setIsLoading(false);
                setIsReady(true);
              }}
              onError={(e) => {
                console.error(`[DEBUG-FALLBACK] Error loading image:`, e);
                setIsLoading(false);
                setImageLoadError(true);
              }}
            />
          )}
          
          {/* VideoContext canvas (visible when playing) */}
          <canvas 
            ref={canvasRef}
            className="w-auto h-auto"
            style={{
              ...mediaElementStyle,
              display: (isImageType(mediaType)) ? 'none' : 
                      (showFirstFrame && mediaType === 'video') ? 'none' : 'block',
              zIndex: 10, // Match the img z-index
              pointerEvents: 'none' // Ensure all click events pass through
            }}
            data-testid="videocontext-canvas"
          />
          
          {/* Error display if both VideoContext and fallback fail */}
          {mediaType === 'image' && imageLoadError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 text-white text-sm">
              <div className="text-center p-4">
                <div>Failed to load image</div>
                <div className="text-xs mt-1">Please check the image URL</div>
              </div>
            </div>
          )}
          
          {/* Show play/pause indicator in the center when playing or paused */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isPlaying ? (
              <PauseIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
            ) : (
              <PlayIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
            )}
          </div>
        </div>
      </div>
      
      {/* Fullscreen toggle button - positioned below the expand/collapse button */}
      <button
        onClick={handleFullscreenToggle}
        className="absolute top-9 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70 transition-opacity"
        style={{
          zIndex: 100, // Use a very high z-index to ensure it's above all other elements
          pointerEvents: 'auto' // Explicitly ensure it captures pointer events
        }}
        data-testid="fullscreen-toggle"
      >
        {isFullscreen ? (
          <ExitFullscreenIcon className="h-4 w-4" />
        ) : (
          <FullscreenIcon className="h-4 w-4" />
        )}
      </button>
      
      {/* Controls container positioned as an overlay at the bottom */}
      <div 
        className={`absolute bottom-0 left-0 right-0 transition-opacity duration-200 ${isHovering || controlsLocked ? 'opacity-100' : 'opacity-0'}`}
        style={{ 
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 50, // Higher than media
          pointerEvents: 'auto',
          padding: '4px 8px 6px 8px',
          width: '100%',
          minHeight: '32px'
        }}
        data-drag-handle-exclude="true"
      >
        {/* Main timeline scrubber */}
        <div className="flex items-center px-1 mb-1 relative" 
             data-drag-handle-exclude="true"
             style={{ zIndex: 51, pointerEvents: 'auto' }}>
          {/* Timeline scrubber */}
          <input
            ref={timelineRef}
            type="range"
            min="0"
            max="100"
            value={positionToTimelineValue(currentTime)}
            onChange={(e) => {
              // Only allow timeline scrubbing when not in trim mode
              if (!trimActive) {
                const inputValue = parseFloat(e.target.value);
                const newTime = timelineValueToPosition(inputValue);
                console.log(`[VideoContext] Scrubber input: value=${inputValue}%, time=${newTime}s, duration=${duration}s`);
                
                // Check if trying to go beyond 10s limit
                if (newTime > 10) {
                  console.warn(`[VideoContext] Attempting to scrub beyond 10s: ${newTime}s`);
                }
                
                handleTimeUpdate(newTime);
              }
            }}
            className={`w-full h-1 rounded-lg appearance-none cursor-pointer bg-gray-700 small-thumb ${trimActive ? 'pointer-events-none' : ''}`}
            style={{ 
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${positionToTimelineValue(currentTime)}%, #4b5563 ${positionToTimelineValue(currentTime)}%, #4b5563 100%)`,
              height: '4px',
              opacity: trimActive ? 0.4 : 1, // Make the scrubber translucent when in trim mode
              WebkitAppearance: 'none',
              appearance: 'none',
              zIndex: 52,
              pointerEvents: 'auto'
            }}
            data-testid="timeline-scrubber"
            data-drag-handle-exclude="true"
            onMouseDown={(e) => {
              e.stopPropagation();
              if (!trimActive) {
                setIsDraggingScrubber(true);
                console.log('[VideoContext] Timeline scrubber: mouse down');
              }
            }}
            onMouseUp={() => {
              setIsDraggingScrubber(false);
              console.log('[VideoContext] Timeline scrubber: mouse up');
            }}
            onMouseLeave={() => setIsDraggingScrubber(false)}
          />
          
          {/* Trim brackets */}
          {duration > 0 && (
            <>
              {/* Left trim bracket */}
              <div 
                className="absolute"
                style={{ 
                  left: `calc(${(trimStart / duration) * 100}% - 6px)`,
                  top: '-8px', 
                  height: '20px', // Reduced height to not overlap controls
                  width: '12px',
                  zIndex: 53, // Higher z-index than scrubber
                  pointerEvents: trimActive ? 'auto' : 'none',
                  opacity: trimActive ? 1 : (trimStart <= 0.01 ? 0 : 0.6),
                  transition: 'opacity 0.2s ease'
                }}
                data-drag-handle-exclude="true"
                data-testid="trim-start-bracket"
              >
                {trimActive && (
                  <>
                    {/* Range input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(trimStart / duration) * 100}
                      className="trim-bracket-range"
                      style={{
                        width: '16px',
                        height: '20px',
                        position: 'absolute',
                        top: '3px',
                        left: '-2px',
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        zIndex: 90, // Very high z-index to ensure it's clickable
                        opacity: 0,
                        pointerEvents: 'auto',
                        cursor: 'ew-resize' // Add explicit cursor style
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('start');
                        console.log('[VideoContext] Trim start handle activated');
                        // --- Store time before drag --- 
                        setTimeBeforeDrag(videoContext ? videoContext.currentTime : currentTime);
                        // --- END Store time --- 
                        // Store original playback position
                        if (videoContext) {
                          setOriginalPlaybackTime(videoContext.currentTime);
                        }
                      }}
                      onChange={(e) => {
                        // This doesn't actually set the value, just prevents default handling
                        e.stopPropagation();
                      }}
                      data-testid="trim-start-range"
                      data-drag-handle-exclude="true"
                    />
                    {/* Visual bracket overlay */}
                    <div 
                      className="absolute w-0.5 bg-blue-500"
                      style={{ 
                        left: '6px',
                        top: '2px',
                        height: '14px',
                        pointerEvents: 'none',
                        boxShadow: 'none',
                        borderRadius: '1px'
                      }}
                    />
                  </>
                )}
                
                {/* Backup visual indicator for non-trim mode */}
                {!trimActive && (
                  <div 
                    className="absolute w-0.5 bg-blue-500"
                    style={{ 
                      left: '6px',
                      top: '2px',
                      height: '14px',
                      pointerEvents: 'none',
                      borderRadius: '1px'
                    }}
                    data-testid="trim-start-bracket-visual"
                  />
                )}
              </div>
              
              {/* Right trim bracket */}
              <div 
                className="absolute"
                style={{ 
                  left: `calc(${(getEffectiveTrimEnd() / duration) * 100}% - 6px)`,
                  top: '-8px',
                  height: '20px', // Reduced height to not overlap controls
                  width: '12px',
                  zIndex: 53, // Higher z-index than scrubber
                  pointerEvents: trimActive ? 'auto' : 'none',
                  opacity: trimActive ? 1 : (getEffectiveTrimEnd() >= duration - 0.01 ? 0 : 0.6),
                  transition: 'opacity 0.2s ease'
                }}
                data-drag-handle-exclude="true"
                data-testid="trim-end-bracket"
              >
                {trimActive && (
                  <>
                    {/* Range input */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(getEffectiveTrimEnd() / duration) * 100}
                      className="trim-bracket-range"
                      style={{
                        width: '16px',
                        height: '20px',
                        position: 'absolute',
                        top: '3px',
                        left: '-2px',
                        WebkitAppearance: 'none',
                        appearance: 'none',
                        zIndex: 90, // Very high z-index to ensure it's clickable
                        opacity: 0,
                        pointerEvents: 'auto',
                        cursor: 'ew-resize' // Add explicit cursor style
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('end');
                        console.log('[VideoContext] Trim end handle activated');
                        // --- Store time before drag --- 
                        setTimeBeforeDrag(videoContext ? videoContext.currentTime : currentTime);
                        // --- END Store time --- 
                        // Store original playback position
                        if (videoContext) {
                          setOriginalPlaybackTime(videoContext.currentTime);
                        }
                      }}
                      onChange={(e) => {
                        // This doesn't actually set the value, just prevents default handling
                        e.stopPropagation();
                      }}
                      data-testid="trim-end-range"
                      data-drag-handle-exclude="true"
                    />
                    {/* Visual bracket overlay */}
                    <div 
                      className="absolute w-0.5 bg-blue-500"
                      style={{ 
                        left: '6px',
                        top: '2px',
                        height: '14px',
                        pointerEvents: 'none',
                        boxShadow: 'none',
                        borderRadius: '1px'
                      }}
                    />
                  </>
                )}
                
                {/* Backup visual indicator for non-trim mode */}
                {!trimActive && (
                  <div 
                    className="absolute w-0.5 bg-blue-500"
                    style={{ 
                      left: '6px',
                      top: '2px',
                      height: '14px',
                      pointerEvents: 'none',
                      borderRadius: '1px'
                    }}
                    data-testid="trim-end-bracket-visual"
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Control buttons row */}
        <div className="flex justify-between items-center px-1" 
             data-drag-handle-exclude="true" 
             style={{ position: 'relative', zIndex: 55, pointerEvents: 'auto' }}>
          {/* Left button section */}
          <div className="flex-shrink-0 w-14 flex justify-start">
            {/* Lock button (left side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setControlsLocked(!controlsLocked);
                console.log(`[VideoContext] Lock button clicked: controlsLocked=${controlsLocked} -> ${!controlsLocked}`);
              }}
              className="text-white hover:opacity-100 focus:outline-none"
              data-testid="toggle-lock-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
            >
              {controlsLocked ? (
                <LockIcon className="w-3 h-3" />
              ) : (
                <UnlockIcon className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Time display (center) */}
          <div className="flex-grow text-center text-white text-xs">
            {activeHandle === 'start' 
              ? `${formatTime(trimStart, true)} / ${formatTime(getEffectiveTrimEnd() - trimStart)}`
              : activeHandle === 'end'
                ? `${formatTime(getEffectiveTrimEnd(), true)} / ${formatTime(getEffectiveTrimEnd() - trimStart)}`
                : `${formatTime(Math.max(0, currentTime - trimStart))} / ${trimStart > 0 || getEffectiveTrimEnd() < duration ? formatTime(getEffectiveTrimEnd() - trimStart) : formatTime(duration)}`
            }
          </div>
          
          {/* Right buttons section */}
          <div className="flex-shrink-0 w-14 flex justify-end">
            {/* Aspect ratio info button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAspectRatio(!showAspectRatio);
                console.log(`[VideoContext] Aspect ratio toggle: ${showAspectRatio} -> ${!showAspectRatio}`);
              }}
              className={`text-white hover:opacity-100 focus:outline-none ${showAspectRatio ? 'opacity-100' : 'opacity-60'}`}
              data-testid="toggle-aspect-ratio"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto', marginRight: '4px' }}
            >
              <InfoIcon />
            </button>
            
            {/* Scissor/Save button (right side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTrimActive(!trimActive);
                console.log(`[VideoContext] Trim button clicked: trimActive=${trimActive} -> ${!trimActive}`);
              }}
              className="text-white hover:opacity-100 focus:outline-none"
              data-testid="toggle-trim-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '1.5px', position: 'relative', zIndex: 56, pointerEvents: 'auto' }}
            >
              {trimActive ? (
                <CheckIcon className="w-3 h-3" />
              ) : (
                <ScissorsIcon className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoContextScenePreviewPlayer;  