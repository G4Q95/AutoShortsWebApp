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
import { VideoContextProvider } from '@/contexts/VideoContextProvider';
import MediaDownloadManager from '@/utils/media/mediaDownloadManager';
import { CSSProperties } from 'react';
import { useMediaAspectRatio } from '@/hooks/useMediaAspectRatio';
import { useTrimControls } from '@/hooks/useTrimControls';

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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
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
  const [currentTime, setCurrentTime] = useState<number>(0);
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

  // Add state to track visual playback position separate from actual time
  const [visualTime, setVisualTime] = useState<number>(0);

  // Add state for first frame capture
  const [showFirstFrame, setShowFirstFrame] = useState<boolean>(true);
  
  // Add video element ref for first frame capture
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // State for aspect ratio display toggle
  const [showAspectRatio, setShowAspectRatio] = useState<boolean>(false);

  // Add state for temporary aspect ratio indicator display
  const [showTemporaryIndicator, setShowTemporaryIndicator] = useState<boolean>(true);

  // Define callbacks needed by the hook BEFORE calling the hook
  const setIsPlayingWithLog = useCallback((value: boolean) => {
    isPlayingRef.current = value;
    setIsPlaying(value);
  }, [isPlaying, setIsPlaying]);

  const handlePause = useCallback(() => {
    if (isImageType(mediaType)) {
      setIsPlayingWithLog(false);
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (forceResetOnPlayRef.current) {
        forceResetOnPlayRef.current = false;
      }
      return;
    }
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
    setIsPlayingWithLog(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, [
    mediaType, videoContext, setIsPlayingWithLog, audioRef, imageTimerRef, 
    forceResetOnPlayRef, animationFrameRef
  ]);
  
  // *** Use the simplified useTrimControls hook ***
  const {
    trimStart,       // Get from hook
    setTrimStart,    // Get from hook
    trimEnd,         // Get from hook
    setTrimEnd,      // Get from hook
    activeHandle,    // Get from hook
    setActiveHandle, // Get from hook
    trimManuallySet, // Get from hook
    setTrimManuallySet, // Get from hook
    userTrimEndRef,  // Get from hook
    timeBeforeDrag,    // Get from hook
    setTimeBeforeDrag,  // Get from hook
    // Get handlers from hook:
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
    setIsPlaying,
    forceResetOnPlayRef
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
    videoContext,
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
    
    // --- Check force reset flag --- 
    if (forceResetOnPlayRef.current) {
        console.warn(`[PLAY-DEBUG] Force reset flag is true. Resetting time to trimStart (${trimStart}) before playing.`);
        if (videoContext) {
            videoContext.currentTime = trimStart;
        }
        setCurrentTime(trimStart); // Update React state too
        forceResetOnPlayRef.current = false; // Reset the flag
    }
    
    // For images without VideoContext, update state and start animation
    if (isImageType(mediaType)) {
      // Handle image playback 
      // Clear any existing timer
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }

      setIsPlayingWithLog(true);
      
      // Play the audio if available
      if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = currentTime;
        audioRef.current.play().catch(err => console.error("[PLAY-DEBUG] Error playing audio for image:", err));
      }
      
      // Start the timer to update currentTime
      const intervalDuration = 100; // Update every 100ms
      imageTimerRef.current = setInterval(() => {
        setCurrentTime(prevTime => {
          const newTime = prevTime + (intervalDuration / 1000);
          if (newTime >= trimEnd) {
            // Reached the end, pause and clear timer
            console.log(`[Image Timer] Reached end (${newTime} >= ${trimEnd}), pausing.`);
            handlePause(); // This will also clear the interval via handlePause's logic
            return trimEnd; // Set time exactly to trimEnd
          } else {
            return newTime;
          }
        });
      }, intervalDuration) as unknown as number; // Cast needed for Node Timeout type vs number

      return;
    }
    
    // For videos with VideoContext
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
    }
    
    // Hide first frame video when playing
    if (videoRef.current) {
      videoRef.current.style.display = 'none';
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
      
      videoContext.play();
      
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
  }, [isPlaying, videoContext, isReady, currentTime, trimStart, trimEnd, setIsPlayingWithLog, audioRef, audioUrl, videoRef, setShowFirstFrame, setCurrentTime]);
  
  // Handle seeked time update
  const handleTimeUpdate = useCallback((newTime: number) => {
    // For images, clear timer, update state directly and sync audio if available
    if (isImageType(mediaType)) {
      const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd);
      setCurrentTime(clampedTime);
      
      // Clear the timer if user scrubs manually
      if (imageTimerRef.current) {
        clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      setIsPlayingWithLog(false); // Ensure playing state is false after manual scrub
      
      // Update audio position too
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
      }
      
      // Reset the force reset flag on manual scrub
      if (forceResetOnPlayRef.current) {
        forceResetOnPlayRef.current = false;
      }
      
      return;
    }
    
    // For videos with VideoContext
    if (!videoContext) return;
    
    // Keep time within trim boundaries
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd);
    videoContext.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    
    // Update audio position too
    if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
  }, [isPlaying, videoContext, currentTime, trimStart, trimEnd, setCurrentTime, audioRef, mediaType]);
  
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
    if (!canvasRef.current) {
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
      canvasRef.current.style.display = 'block';
      canvasRef.current.style.zIndex = '10';
      
      // Hide the first frame when canvas is playing
      if (videoRef.current) {
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
      canvasRef.current.style.display = isImageType(mediaType) ? 'none' : 'block';
      
      // Show the first frame when video is not playing
      if (videoRef.current && !isPlaying && mediaType === 'video') {
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
      animationFrameRef.current = requestAnimationFrame(updateTime);
    } else {
      // Ensure ref is synced and cancel any existing frame request if stopped
      isPlayingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    // Cleanup function
    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      isPlayingRef.current = false; // Ensure ref is false on cleanup
    };
  }, [isPlaying, videoContext, trimStart, trimEnd, handlePause, userTrimEndRef, setCurrentTime, animationFrameRef, isPlayingRef]);
  
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
              }
            }}
            onMouseUp={() => {
              setIsDraggingScrubber(false);
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
                        console.log("[Trim Bracket] Left Handle MouseDown");
                        setActiveHandle('start');
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
                        console.log("[Trim Bracket] Right Handle MouseDown");
                        setActiveHandle('end');
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