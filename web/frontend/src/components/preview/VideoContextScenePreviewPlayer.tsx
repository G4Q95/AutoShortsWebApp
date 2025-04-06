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

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon, LockIcon, UnlockIcon, ScissorsIcon, CheckIcon, Maximize2 as FullscreenIcon, Minimize2 as ExitFullscreenIcon } from 'lucide-react';
import { usePlaybackState } from '@/hooks/usePlaybackState';
import { VideoContextProvider, useVideoContext } from '@/contexts/VideoContextProvider';
import MediaDownloadManager from '@/utils/media/mediaDownloadManager';
import { CSSProperties } from 'react';
import { useMediaAspectRatio } from '@/hooks/useMediaAspectRatio';
import { useTrimControls } from '@/hooks/useTrimControls';
import PlayerControls from './PlayerControls';

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
  // State for player
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDraggingScrubber, setIsDraggingScrubber] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
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
  const [showTemporaryIndicator, setShowTemporaryIndicator] = useState<boolean>(true);

  // --- Playback State ---
  // Comment out original useState calls:
  // const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // const [currentTime, setCurrentTime] = useState<number>(0);
  // const [visualTime, setVisualTime] = useState<number>(0);

  // Call the new hook instead:
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
    forceResetOnPlayRef
  });
  
  const {
    mediaElementStyle,
    calculatedAspectRatio,
  } = useMediaAspectRatio({
    initialMediaAspectRatio,
    projectAspectRatio,
    showLetterboxing,
    mediaType,
    videoContext,
  });

  // --- CALLBACKS & HANDLERS (Keep existing dependencies for now) --- 
  const setIsPlayingWithLog = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlaying(value); // This now uses the setter from the hook
  }, [setIsPlaying]); // DEPENDENCY WILL BE UPDATED IN NEXT STEP

  const handlePause = useCallback(() => {
    if (isImageType(mediaType)) {
      setIsPlayingWithLog(false); // Use wrapper
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return; // Return early for images
    }
    
    // --- Video Logic --- 
    const currentVideoContext = videoContext;
    if (!currentVideoContext) {
      return;
    }
    try {
      if (typeof currentVideoContext.pause === 'function') {
        currentVideoContext.pause();
      } else {
        console.error(`[VideoContext PAUSE] videoContext.pause is not a function`);
      }
    } catch (err) {
      console.error(`[VideoContext PAUSE] Error calling pause:`, err);
    }
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
    mediaType, videoContext, audioRef, 
    setIsPlayingWithLog, // Callback wrapper
    animationFrameRef // Ref for cancelling animation loop
  ]);
  
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
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current || !localMediaUrl || !isVideoType(mediaType)) {
      return; // Bail out if refs not ready, no local URL, or not a video
    }

    let isMounted = true; // Track mount status

    const baseSize = 1920;
    let canvasWidth: number, canvasHeight: number;

    const initVideoContext = async () => {
      try {
        // Clean up existing context if any
        if (videoContext) {
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

        const ctx = new VideoContext(canvas);
        if (!ctx) throw new Error('Failed to create VideoContext instance');
        setVideoContext(ctx);

        let source: any;
        if (mediaType === 'video') {
          if (!localMediaUrl) throw new Error('[VideoCtx Init] No media URL available for video source inside init function');
          source = ctx.video(localMediaUrl);
          if (!source) throw new Error('Failed to create video source');

          source.connect(ctx.destination);
          source.start(0);
          source.stop(300); // 5 minute max duration

          source.registerCallback('loaded', () => {
            if (!isMounted) return;
            // Ensure isLoading is set false here too
            setIsLoading(false);
            setIsReady(true);

            if (source.element) {
              const videoElement = source.element as HTMLVideoElement;
              const videoDuration = videoElement.duration;
              setDuration(videoDuration);

              // Keep setVideoDimensions commented out
              // const videoWidth = videoElement.videoWidth;
              // const videoHeight = videoElement.videoHeight;
              // if (videoWidth > 0 && videoHeight > 0) {
              //   setVideoDimensions({ width: videoWidth, height: videoHeight });
              // }

              if (trimEnd <= 0 || trimEnd === 10) {
                setTrimEnd(videoDuration);
              }
              if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
                userTrimEndRef.current = videoDuration;
              }
            }
          });
          
          source.registerCallback('error', (err: any) => {
            if (!isMounted) return;
            setIsLoading(false); // Also set loading false on source error
            setIsReady(false);
          });
        }
        
        return {
          context: ctx,
          source
        };
      } catch (error) {
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
      } else {
        setIsReady(false); // Ensure ready is false if setup failed
      }
    }).catch(error => {
      if (!isMounted) return;
      setIsReady(false);
      setIsLoading(false); // Ensure loading is false on promise rejection
    });
    
    // Cleanup function
    return () => {
      isMounted = false; // Mark as unmounted
    };
  }, [localMediaUrl, mediaType, sceneId, initialMediaAspectRatio, setVideoContext, setDuration, setTrimEnd, userTrimEndRef, setCurrentTime]); // REMOVED videoContext from dependencies
  
  // Handle play/pause with trim boundaries
  const handlePlay = useCallback(() => {
    if (forceResetOnPlayRef.current) {
      const startTime = trimStart; // Use trimStart from useTrimControls hook
      setCurrentTime(startTime); // Update React state too (from usePlaybackState)
      setVisualTime(startTime); // Also update visual time (from usePlaybackState)
      // If there's audio, reset it too
      if (audioRef.current) {
          try { audioRef.current.currentTime = startTime; } 
          catch (e) { console.warn("[handlePlay Reset] Error setting audio time:", e); }
      }
      // If there's VideoContext (for video), reset it too
      if (videoContext) {
         try { videoContext.currentTime = startTime; } 
         catch (e) { console.warn("[handlePlay Reset] Error setting video context time:", e); }
      }
    }
    
    // --- Playback Logic (No longer needs separate function or delay) --- 
    if (isImageType(mediaType)) {
      // Image logic
      setIsPlayingWithLog(true); // Use wrapper (starts rAF loop implicitly)
      if (audioRef.current && audioUrl) {
        try {
            audioRef.current.currentTime = currentTime; 
            audioRef.current.play().catch(err => console.error("[handlePlay Image] Error playing audio:", err));
        } catch (e) {
            console.warn("[handlePlay Image] Error setting audio time:", e);
        }
      }
      return; // Done for images
    }
    
    // --- Video Logic --- 
    if (!videoContext) {
      console.error(`[handlePlay Video] Cannot play - videoContext is null`);
      return;
    }
    if (!isReady) {
      console.error(`[handlePlay Video] Cannot play - videoContext not ready yet`);
      return;
    }
    
    // Sync video context time if needed (using currentTime from state)
    if (Math.abs(videoContext.currentTime - currentTime) > 0.1) {
        try { videoContext.currentTime = currentTime; } 
        catch (e) { console.warn("[handlePlay Video] Error syncing video context time:", e); }
    }
    
    // Play video context
    try {
      if (typeof videoContext.play !== 'function') {
        console.error(`[handlePlay Video] videoContext.play is not a function`);
        return;
      }
      videoContext.play();
      setIsPlayingWithLog(true); // Use wrapper (starts rAF loop)
      
      // Play separate audio if present, syncing to video context
      if (audioRef.current && audioUrl) {
          try {
            audioRef.current.currentTime = videoContext.currentTime;
            audioRef.current.play().catch(err => console.error(`[handlePlay Video] Error playing audio:`, err));
          } catch (e) {
            console.warn("[handlePlay Video] Error setting/playing audio time:", e); 
          }
      }
    } catch (error) {
      console.error(`[handlePlay Video] Error calling videoContext.play():`, error);
      setIsPlayingWithLog(false); // Ensure playing state is false on error
    }

  }, [
      // Dependencies:
      videoContext, isReady, 
      currentTime, trimStart, // Read state from playback/trim hooks
      audioUrl, audioRef, // Props and Refs
      setCurrentTime, setVisualTime, // Setters from playback hook
      setIsPlayingWithLog, // Callback wrapper
      forceResetOnPlayRef, mediaType // Ref and Prop
  ]);
  
  // Define handleTimeUpdate with updated dependencies
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
    
    if (!videoContext) return;
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
    
    // Update video context (attempt)
    try {
       videoContext.currentTime = clampedTime;
    } catch (e) {
        console.warn("[handleTimeUpdate] Error setting videoContext time:", e);
    }
    
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
    videoContext, trimStart, trimEnd, // Read state from trim hook
    setCurrentTime, setVisualTime, // *** ADDED setVisualTime to dependencies ***
    setIsPlayingWithLog, // Other callbacks
    audioRef, mediaType, imageTimerRef, forceResetOnPlayRef
  ]);
  
  // Scrubber handlers
  const handleScrubberMouseDown = useCallback(() => {
    // ... (existing logic)
  }, [currentTime, isPlaying, handlePause, setIsDraggingScrubber, setOriginalPlaybackTime]);

  const handleScrubberMouseUp = useCallback(() => {
     // ... (existing logic)
  }, [
    isDraggingScrubber, visualTime, // Read state from hook
    setCurrentTime, // Setter from playback hook
    videoContext, audioRef, forceResetOnPlayRef, setIsDraggingScrubber
  ]);
  
  // Function to convert range input value to timeline position
  const timelineValueToPosition = (value: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return currentTime;
    }
    const position = (value / 100) * duration;
    return position;
  };
  
  // Function to convert timeline position to range input value
  const positionToTimelineValue = (position: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return (currentTime / duration) * 100;
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
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas) return; // Canvas must exist

    // --- Reverted Logic --- 
    if (isPlaying && isVideoType(mediaType)) {
      // Playing Video: Show canvas, hide video element
      canvas.style.display = 'block';
      canvas.style.zIndex = '10'; // Ensure canvas is on top
      if (video) video.style.display = 'none';
    } else if (!isPlaying && isVideoType(mediaType)) {
      // Paused Video: Show the canvas (which VideoContext keeps updated), hide video element
      canvas.style.display = 'block'; 
      canvas.style.zIndex = '10'; // Keep canvas on top
      if (video) {
         video.style.display = 'none'; // Keep fallback video hidden
      }
    } else if (isImageType(mediaType)) {
      // Image: Always hide canvas, image element is handled separately
      canvas.style.display = 'none';
      if (video) video.style.display = 'none'; // Also hide video element if it exists
    }
    // --- End Reverted Logic ---
    
    // Note: The <img> element's visibility is implicitly handled by its presence/absence
    // and the conditions in the JSX render.

  }, [isPlaying, mediaType, videoRef, canvasRef]); // Dependencies: Restore isPlaying, keep media type and refs
  
  // --- TIME UPDATE LOOP (Focus of Step 4.2) --- 
  useEffect(() => {
    let isActive = true; 
    const updateTime = () => {
      
      // --- FIX: Handle reset flag HERE --- 
      if (forceResetOnPlayRef.current) {
        const startTime = trimStart; // Get target reset time
        // Reset React state first
        setCurrentTime(startTime);
        setVisualTime(startTime);
        // Reset VideoContext if it exists
        if (videoContext) {
          try { videoContext.currentTime = startTime; } 
          catch(e) { console.warn("[rAF Reset] Error setting video context time:", e); }
        }
        // Reset Audio if it exists
        if (audioRef.current) {
           try { audioRef.current.currentTime = startTime; } 
           catch(e) { console.warn("[rAF Reset] Error setting audio time:", e); }
        }
        // Now consume the flag
        forceResetOnPlayRef.current = false;
        
        // It's safer to let the next animation frame handle the actual time reading
        // after the reset, so request it and return early from this frame.
        if (isActive && isPlayingRef.current) {
           animationFrameRef.current = requestAnimationFrame(updateTime);
        }
        return; 
      }
      // --- END FIX ---
      
      if (!isActive || !isPlayingRef.current || !isReady) { // Check isReady state too
        // Stop the loop if not playing or not ready
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        return;
      }
      
      let newTime = 0;
      if (isImageType(mediaType)) {
        // Image logic - increments time manually
        const effectiveEnd = userTrimEndRef.current ?? trimEnd; // Read from trim hook
        newTime = Math.min(currentTime + 1 / 60, effectiveEnd); // Read currentTime from playback hook
        // ... (audio sync logic for images, if any) ...
        // This boundary check might be redundant now if the main one below works
        // if (audioRef.current && audioRef.current.currentTime >= effectiveEnd) {
        //     handlePause(); 
        //     setCurrentTime(effectiveEnd); // Use setter from hook
        //     setVisualTime(effectiveEnd); // Use setter from hook
        //     return; 
        // }
      } else if (videoContext) {
        // Video logic - reads time from VideoContext
        // IMPORTANT: Read time *after* potential reset check above
        newTime = videoContext.currentTime;
        // ... (audio sync logic for video, if any) ...
      }
      
      // Update both currentTime and visualTime using setters from usePlaybackState
      setCurrentTime(newTime); 
      if (!isDraggingScrubber) { // Only update visual time if not dragging scrubber
         setVisualTime(newTime); 
      }

      const actualTrimEndCheck = userTrimEndRef.current ?? trimEnd; // Read from trim hook
      if (newTime >= actualTrimEndCheck) {
          // Set the flag - rAF loop will handle reset on next tick if play is pressed again
          forceResetOnPlayRef.current = true; 
          handlePause(); 
          setCurrentTime(actualTrimEndCheck); // Use setter from hook
          setVisualTime(actualTrimEndCheck); // Use setter from hook
          return; // Stop the loop
      } else if (newTime < trimStart) {
          // This seeks forward if time somehow got behind trimStart
          if (videoContext) {
             try { videoContext.currentTime = trimStart; } 
             catch(e) { console.warn("[rAF SeekForward] Error setting video context time:", e); }
          }
          setCurrentTime(trimStart); // Use setter from hook
          setVisualTime(trimStart); // Use setter from hook
          // Continue to next frame
      }
      
      // Continue the loop only if still active and playing
      if (isActive && isPlayingRef.current) {
         animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    // Start the loop if playing and ready
    if (isPlaying && isReady) { // Read isPlaying state from hook
      isPlayingRef.current = true; // Sync ref
      // Cancel any previous frame before starting a new one
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      // Ensure loop stops if not playing or not ready
      isPlayingRef.current = false; // Sync ref
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null; 
      }
    }

    // Cleanup function
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
      // Dependencies for the rAF loop:
      isPlaying, isReady, // Read state from playback hook & local state
      videoContext, // Context object
      trimStart, trimEnd, // Read state from trim hook
      userTrimEndRef, // Ref from trim hook
      currentTime, // Read state from playback hook (for image increment)
      isDraggingScrubber, // Local state
      mediaType, // Prop
      audioRef, // Ref
      // Setters from usePlaybackState:
      setCurrentTime, 
      setVisualTime, 
      // Other Callbacks used inside:
      handlePause 
      // Ref dependencies added: forceResetOnPlayRef
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
  
  // --- Add helper handlers --- 

  // Helper for Play/Pause Toggle
  const handlePlayPauseToggle = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);

  // Handler for Scrubber Change (Updates visual time during drag)
  const handleScrubberChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isDraggingScrubber) return; // Safety check
    const newTime = parseFloat(event.target.value);
    setVisualTime(newTime); // Update visual time only during drag
    // Optional: Could sync videoContext time for instant preview, but might be slow
    // if (videoContext) { try { videoContext.currentTime = newTime; } catch(e){} }
  }, [isDraggingScrubber, setVisualTime]);
  
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
              // NO-OP for duration setting for images here - handled by img onLoad
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
              src={localMediaUrl || undefined}
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
                console.log(`[Image onLoad][${instanceId}] Fired for scene ${sceneId}. Media Type: ${mediaType}`);
                
                // ALWAYS set default 30s duration for images
                console.log(`[Image onLoad][${instanceId}] Setting default duration (30s).`);
                setTrimEnd(30);
                
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
          
        </div>
      </div>
      
      {/* Player Controls Container - Rendered conditionally */}
      {(isHovering || isDraggingScrubber || activeHandle || controlsLocked) && (
        <>
          {/* --- Restore original Scrubber + Bracket container --- */}
          <div 
            className="absolute left-0 right-0 px-2"
            style={{ 
                bottom: '40px', 
                height: '4px',  
                zIndex: 52, 
                pointerEvents: 'auto' 
            }}
            data-drag-handle-exclude="true"
          >
              {/* Main timeline scrubber */}
              <input
                ref={timelineRef} // Use the ref again
                type="range"
                min="0"
                max="100"
                value={positionToTimelineValue(visualTime)} // Use positionToTimelineValue
                onChange={(e) => {
                  // Only allow timeline scrubbing when not in trim mode
                  if (!trimActive) {
                    const inputValue = parseFloat(e.target.value);
                    const newTime = timelineValueToPosition(inputValue);
                    handleTimeUpdate(newTime); // Use handleTimeUpdate
                  }
                }}
                onMouseDown={(e) => {
                  if (trimActive) return; // Prevent drag if trimming
                  e.stopPropagation();
                  setIsDraggingScrubber(true);
                }}
                onMouseUp={() => {
                  if (isDraggingScrubber) {
                     // Update final time on mouse up
                     handleTimeUpdate(visualTime);
                     setIsDraggingScrubber(false);
                  }
                }}
                // onMouseLeave={() => setIsDraggingScrubber(false)} // Might re-introduce issues, test without first
                className={`w-full h-1 rounded-lg appearance-none cursor-pointer bg-gray-700 small-thumb ${trimActive ? 'pointer-events-none' : ''}`}
                style={{ 
                  background: duration > 0 
                      ? `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${positionToTimelineValue(visualTime)}%, #4b5563 ${positionToTimelineValue(visualTime)}%, #4b5563 100%)`
                      : '#4b5563', 
                  height: '4px',
                  opacity: trimActive ? 0.4 : 1, // Make translucent when trimming
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  zIndex: 52,
                  pointerEvents: trimActive ? 'none' : 'auto' // Disable scrubber if trimming
                }}
                data-testid="timeline-scrubber"
                data-drag-handle-exclude="true"
              />
              
              {/* Trim brackets (using original hidden range inputs) */}
              {duration > 0 && (
                <>
                  {/* Left trim bracket */}
                  <div 
                    className="absolute"
                    style={{ 
                      left: '2px',
                      top: '0px',
                      height: '20px', 
                      width: '12px',
                      zIndex: 53, 
                      pointerEvents: 'none', 
                      transition: 'opacity 0.2s ease'
                    }}
                    data-drag-handle-exclude="true"
                    data-testid="trim-start-bracket-container"
                  >
                    {/* Invisible Range input for dragging */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(trimStart / duration) * 100}
                      className="trim-bracket-range" 
                      style={{
                        width: '16px',    // Back to 16px
                        height: '20px',
                        position: 'absolute',
                        top: '0px', 
                        left: '-2px',     // Back to -2px
                        zIndex: 90, 
                        opacity: 0, 
                        pointerEvents: trimActive ? 'auto' : 'none', 
                        visibility: trimActive ? 'visible' : 'hidden', 
                        cursor: 'ew-resize' 
                      }}
                      onMouseDown={(e) => {
                        if (!trimActive) return;
                        e.stopPropagation();
                        console.log("[Trim Bracket Range] Left Handle MouseDown");
                        setActiveHandle('start');
                        setTimeBeforeDrag(currentTime);
                        if (isPlaying) handlePause();
                      }}
                      onChange={(e) => { e.stopPropagation(); }} // Prevent default
                      data-testid="trim-start-range"
                      // --- FIX: Temporarily remove exclude attribute --- 
                      // data-drag-handle-exclude="true"
                      // --- End Fix ---
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
                        borderRadius: '1px',
                        opacity: trimActive ? 1 : (trimStart <= 0.01 ? 0 : 0.6), // Controls visual opacity
                        visibility: trimActive || trimStart > 0.01 ? 'visible' : 'hidden' // Hide visual if not active and at edge
                      }}
                      data-testid="trim-start-bracket-visual"
                    />
                  </div>
                  
                  {/* Right trim bracket */}
                  <div 
                    className="absolute"
                    style={{ 
                      left: 'calc(100% - 16px)',
                      top: '0px',
                      height: '20px',
                      width: '12px',
                      zIndex: 53,
                      pointerEvents: 'none',
                      transition: 'opacity 0.2s ease'
                    }}
                    data-drag-handle-exclude="true" // Keep on container for safety
                    data-testid="trim-end-bracket-container"
                  >
                     {/* Invisible Range input for dragging */}
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.01"
                      value={(getEffectiveTrimEnd() / duration) * 100}
                      className="trim-bracket-range"
                      style={{
                        width: '16px',    // Back to 16px
                        height: '20px',
                        position: 'absolute',
                        top: '0px',
                        left: '-2px',     // Back to -2px
                        zIndex: 90, 
                        opacity: 0,
                        pointerEvents: trimActive ? 'auto' : 'none', 
                        visibility: trimActive ? 'visible' : 'hidden',
                        cursor: 'ew-resize' 
                      }}
                      onMouseDown={(e) => {
                        if (!trimActive) return;
                        e.stopPropagation();
                        console.log("[Trim Bracket Range] Right Handle MouseDown");
                        setActiveHandle('end');
                        setTimeBeforeDrag(currentTime);
                        if (isPlaying) handlePause();
                      }}
                      onChange={(e) => { e.stopPropagation(); }}
                      data-testid="trim-end-range"
                      // --- FIX: Temporarily remove exclude attribute --- 
                      // data-drag-handle-exclude="true"
                      // --- End Fix ---
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
                        borderRadius: '1px',
                        opacity: trimActive ? 1 : (getEffectiveTrimEnd() >= duration - 0.01 ? 0 : 0.6),
                        visibility: trimActive || getEffectiveTrimEnd() < duration - 0.01 ? 'visible' : 'hidden'
                      }}
                      data-testid="trim-end-bracket-visual"
                    />
                  </div>
                </>
              )}
          </div>
          {/* --- End Restore --- */}
          
          <PlayerControls
             isPlaying={isPlaying}
             currentTime={currentTime}
             visualTime={visualTime} 
             duration={duration}
             trimStart={trimStart}
             effectiveTrimEnd={getEffectiveTrimEnd()} // Pass calculated value
             controlsLocked={controlsLocked} 
             trimActive={trimActive}
             showAspectRatio={showAspectRatio}
             isDraggingScrubber={isDraggingScrubber}
             activeHandle={activeHandle}
             
             onPlayPauseToggle={handlePlayPauseToggle} // Use the new toggle helper
             onScrubberMouseDown={handleScrubberMouseDown} // Keep existing handler
             onScrubberMouseUp={handleScrubberMouseUp} // Keep existing handler
             onScrubberChange={handleScrubberChange} // Use the new change handler
             onLockToggle={() => setControlsLocked(!controlsLocked)} // Inline toggle for simple state
             onAspectRatioToggle={() => setShowAspectRatio(!showAspectRatio)} // Inline toggle
             onTrimToggle={() => setTrimActive(!trimActive)} // Ensure this handler is passed
          />
        </>
      )}
      
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
      
    </div> // End main container div
  );
};

export default VideoContextScenePreviewPlayer;  