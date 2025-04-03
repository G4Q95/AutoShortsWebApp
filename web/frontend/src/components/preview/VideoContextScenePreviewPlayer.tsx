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

// Add type guard functions for media type checking
const isImageType = (type: 'image' | 'video' | 'gallery'): boolean => type === 'image' || type === 'gallery';
const isVideoType = (type: 'image' | 'video' | 'gallery'): boolean => type === 'video';

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
  mediaAspectRatio?: number;           // Media's original aspect ratio
  projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5'; // Project-wide setting
  showLetterboxing?: boolean;          // Whether to show letterboxing/pillarboxing
}

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
  
  // State for hover and trim controls
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  
  // Add state to track if trim was manually set
  const [trimManuallySet, setTrimManuallySet] = useState<boolean>(false);
  
  // Add state for original playback position
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
  const [trimStart, setTrimStart] = useState<number>(trim.start);
  const [trimEnd, setTrimEnd] = useState<number>(trim.end || 0);
  console.log(`[VideoContext] Initial state values: trimStart=${trimStart}, trimEnd=${trimEnd}, duration=${duration}`);
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // Add state to track media aspect ratio
  const [aspectRatio, setAspectRatio] = useState<number>(initialMediaAspectRatio || 9/16); // Use prop if provided
  const [isVertical, setIsVertical] = useState<boolean>(true);
  const [isSquare, setIsSquare] = useState<boolean>(false);
  
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

  // Add ref to store the user's manually set trim end value - initialize to null
  const userTrimEndRef = useRef<number | null>(null);

  // Add state to track visual playback position separate from actual time
  const [visualTime, setVisualTime] = useState<number>(0);

  // Add state for first frame capture
  const [showFirstFrame, setShowFirstFrame] = useState<boolean>(true);
  
  // Add video element ref for first frame capture
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Add state to track aspect ratio display toggle
  const [showAspectRatio, setShowAspectRatio] = useState<boolean>(false);

  // Add a ref to track playing state
  const isPlayingRef = useRef<boolean>(false);

  // After other state variables, add this new state:
  // Add state for temporary aspect ratio indicator display
  const [showTemporaryIndicator, setShowTemporaryIndicator] = useState<boolean>(true);
  
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

  // Add time update loop with trim boundaries
  useEffect(() => {
    const updateTime = () => {
      if (videoContext && isPlaying) {
        const time = videoContext.currentTime;
        
        // Get the actual trim end to use
        const actualTrimEnd = userTrimEndRef.current !== null ? userTrimEndRef.current : trimEnd;
        
        // Add detailed logging for debugging trim reset issue
        console.log("[VideoContext] Auto-pause check", { 
          time, 
          trimEnd, 
          trimStart,
          "userTrimEnd": userTrimEndRef.current,
          "trim.end": trim.end, 
          "will-reset": time >= actualTrimEnd,
          "duration": duration
        });
        
        // Check if we've reached the trim end
        if (time >= actualTrimEnd) {
          handlePause();
          videoContext.currentTime = trimStart;
          setCurrentTime(trimStart);
          
          // Log after pause is triggered
          console.log("[VideoContext] After pause", { 
            currentTime: videoContext.currentTime, 
            trimEnd, 
            "userTrimEnd": userTrimEndRef.current,
            "trim.end": trim.end 
          });
          
          return;
        }
        
        // Check if we're before trim start
        if (time < trimStart) {
          videoContext.currentTime = trimStart;
          setCurrentTime(trimStart);
        } else {
          setCurrentTime(time);
        }
        
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, videoContext, trimStart, trimEnd, trim.end]);

  // Function to get local media URL
  const getLocalMedia = useCallback(async () => {
    if (!mediaUrl) return;
    
    try {
      setIsLoading(true);
      console.warn(`[VideoContext] Starting media download process for scene ${sceneId}`);
      console.warn(`[VideoContext] Media URL: ${mediaUrl}`);
      console.warn(`[VideoContext] Media type: ${mediaType}`);
      
      // Check if we already have the media downloaded
      if (mediaManager.current.isMediaDownloaded(mediaUrl, sceneId)) {
        const cachedUrl = mediaManager.current.getObjectUrl(mediaUrl, sceneId);
        if (cachedUrl) {
          console.warn(`[VideoContext] Using cached media URL for scene ${sceneId}`);
          console.warn(`[VideoContext] Cached URL: ${cachedUrl}`);
          setLocalMediaUrl(cachedUrl);
          setDownloadProgress(1);
          setIsLoading(false);
          return;
        } else {
          console.warn(`[VideoContext] Cache check returned true but no URL found for scene ${sceneId}`);
        }
      } else {
        console.warn(`[VideoContext] No cached media found for scene ${sceneId}, starting download`);
      }
      
      // Download progress callback
      const onProgress = (progress: number) => {
        setDownloadProgress(progress);
        console.warn(`[VideoContext] Download progress for scene ${sceneId}: ${Math.round(progress * 100)}%`);
      };
      
      console.warn(`[VideoContext] Initiating download for scene ${sceneId}`);
      // Download the media
      const objectUrl = await mediaManager.current.downloadMedia(
        mediaUrl,
        sceneId,
        projectId,
        mediaType,
        { onProgress }
      );
      
      console.warn(`[VideoContext] Download successful for scene ${sceneId}`);
      console.warn(`[VideoContext] Local URL: ${objectUrl}`);
      setLocalMediaUrl(objectUrl);
      setIsLoading(false);
    } catch (error) {
      console.error(`[VideoContext] Error downloading media for scene ${sceneId}:`, error);
      // Fall back to direct URL if download fails
      console.warn(`[VideoContext] Download failed for scene ${sceneId}, falling back to original URL: ${mediaUrl}`);
      setLocalMediaUrl(null);
      setIsLoading(false);
    }
  }, [mediaUrl, sceneId, projectId, mediaType]);
  
  // Initialize media download when component mounts
  useEffect(() => {
    getLocalMedia();
    
    // Clean up function to release object URL
    return () => {
      if (localMediaUrl && mediaUrl) {
        mediaManager.current.releaseMedia(mediaUrl, sceneId);
      }
    };
  }, [mediaUrl, getLocalMedia]);
  
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
    // Create refs for working with canvas
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) {
      console.error(`[FATAL ERROR] Canvas or container ref not available for scene ${sceneId}`);
      return;
    }
    
    // Variables for tracking initialization state
    let setupComplete = false;
    let cleanupFunc: (() => void) | null = null;
    
    console.log(`[INIT-DEBUG] Starting initialization for scene ${sceneId}, mediaType=${mediaType}`);
    
    const baseSize = 1920;
    let canvasWidth: number, canvasHeight: number;
    
    const initVideoContext = async () => {
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
        
        // Set canvas dimensions based on aspect ratio
        if (initialMediaAspectRatio) {
          if (initialMediaAspectRatio >= 1) {
            canvasWidth = baseSize;
            canvasHeight = Math.round(baseSize / initialMediaAspectRatio);
          } else {
            canvasHeight = baseSize;
            canvasWidth = Math.round(baseSize * initialMediaAspectRatio);
          }
        } else {
          canvasWidth = 1920;
          canvasHeight = 1080;
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        console.log(`[INIT-DEBUG] Canvas dimensions set to ${canvas.width}x${canvas.height}`);
        
        // Create VideoContext instance
        const ctx = new VideoContext(canvas);
        
        if (!ctx) {
          throw new Error('Failed to create VideoContext instance');
        }
        
        console.log(`[INIT-DEBUG] VideoContext created successfully`);
        
        // Store in state immediately
        setVideoContext(ctx);
        
        // Create source based on media type
        let source: any;
        
        if (mediaType === 'video') {
          // Create source
          if (!localMediaUrl) {
            throw new Error('No media URL available for video source');
          }
          
          source = ctx.video(localMediaUrl);
          
          if (!source) {
            throw new Error('Failed to create video source');
          }
          
          console.log(`[INIT-DEBUG] Video source created successfully`);
          
          // Connect and configure source
          source.connect(ctx.destination);
          source.start(0);
          source.stop(300); // 5 minute max duration
          
          console.log(`[INIT-DEBUG] Source connected and configured`);
          
          // Set up callbacks
          source.registerCallback('loaded', () => {
            console.log(`[INIT-DEBUG] Video loaded callback fired`);
            setIsLoading(false);
            setIsReady(true);
            setupComplete = true;
            
            // Set duration and trim values
            if (source.element) {
              const videoElement = source.element as HTMLVideoElement;
              setDuration(videoElement.duration);
              
              if (trimEnd <= 0 || trimEnd === 10) {
                setTrimEnd(videoElement.duration);
              }
              
              if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
                userTrimEndRef.current = videoElement.duration;
              }
            }
          });
          
          // Register time update callback
          if (typeof ctx.registerTimeUpdateCallback === 'function') {
            ctx.registerTimeUpdateCallback((time: number) => {
              setCurrentTime(time);
            });
          } else if (typeof ctx.registerCallback === 'function') {
            ctx.registerCallback('timeupdate', () => {
              setCurrentTime(ctx.currentTime);
            });
          } else {
            // Manual tracking using requestAnimationFrame
            let isActive = true;
            
            function updateTimeLoop() {
              if (!isActive) return;
              
              if (ctx && typeof ctx.currentTime === 'number') {
                setCurrentTime(ctx.currentTime);
              }
              
              animationFrameRef.current = requestAnimationFrame(updateTimeLoop);
            }
            
            animationFrameRef.current = requestAnimationFrame(updateTimeLoop);
            
            cleanupFunc = () => {
              isActive = false;
              if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
              }
            };
          }
        }
        
        return {
          context: ctx,
          source
        };
      } catch (error) {
        console.error(`[INIT-DEBUG] VideoContext initialization failed:`, error);
        setIsLoading(false);
        setIsReady(false);
        return null;
      }
    };
    
    // Run initialization and handle results
    const setup = initVideoContext();
    
    setup.then(result => {
      if (result && result.context) {
        console.log(`[INIT-DEBUG] Setup succeeded, videoContext is available`);
        setVideoContext(result.context);
        setIsReady(true);
      } else {
        console.log(`[INIT-DEBUG] Setup failed, no context available`);
        setIsReady(false);
      }
    }).catch(error => {
      console.error(`[INIT-DEBUG] Setup promise error:`, error);
      setIsReady(false);
    });
    
    // Cleanup function
    return () => {
      console.log(`[INIT-DEBUG] Running cleanup for scene ${sceneId}`);
      
      if (cleanupFunc) {
        cleanupFunc();
      }
      
      setup.then(result => {
        if (result && result.context) {
          try {
            if (typeof result.context.reset === 'function') {
              result.context.reset();
            }
            
            if (typeof result.context.dispose === 'function') {
              result.context.dispose();
            }
          } catch (error) {
            console.error(`[INIT-DEBUG] Error during cleanup:`, error);
          }
        }
      }).catch(error => {
        console.error(`[INIT-DEBUG] Cleanup promise error:`, error);
      });
    };
  }, [localMediaUrl, mediaType]);
  
  // Update trim values when props change - but only for trimStart
  useEffect(() => {
    console.log("[VideoContext] Updating trim from props", { 
      "old trimStart": trimStart,
      "old trimEnd": trimEnd,
      "userTrimEnd": userTrimEndRef.current,
      "new trimStart": trim.start,
      "new trimEnd": trim.end,
      "duration": duration,
      "has duration": duration > 0,
      "trimManuallySet": trimManuallySet,
      "actual data type of trim.end": typeof trim.end,
      "value of trim.end": trim.end
    });
    
    // Always update trimStart from props
    setTrimStart(trim.start);
    
    // For trimEnd, we need special handling:
    // 1. If trim.end is explicitly set to a positive value, use it
    // 2. If userTrimEnd is not set and we have duration, use duration
    // 3. If already set manually, don't override unless trim.end is explicitly set
    if (trim.end > 0) {
      // If explicitly set in props, always update
      setTrimEnd(trim.end);
      userTrimEndRef.current = trim.end;
      console.log("[VideoContext] Using explicit trim.end from props:", trim.end);
    } else if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
      // If user hasn't set a value and we have duration, use that
      if (duration > 0) {
        setTrimEnd(duration);
        userTrimEndRef.current = duration;
        console.log("[VideoContext] No trim.end from props, using duration:", duration);
      }
    }
    // If user manually set it, don't override with zero or undefined
  }, [trim.start, trim.end, duration, trimManuallySet]);
  
  // Update the setIsPlayingWithLog function to update both state and ref
  const setIsPlayingWithLog = (value: boolean) => {
    console.log(`[DEBUG-STATE] Setting isPlaying from ${isPlaying} to ${value}`);
    // Update the ref first - this is what animation will check
    isPlayingRef.current = value;
    // Then update React state for UI
    setIsPlaying(value);
  };
  
  // Handle play/pause with trim boundaries
  const handlePlay = () => {
    console.log(`[PLAY-DEBUG] Play requested for media type: ${mediaType}`);
    
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
  };
  
  const handlePause = () => {
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
      trimManuallySet
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
  };
  
  // Handle seeked time update
  const handleTimeUpdate = (newTime: number) => {
    // For images, update state directly and sync audio if available
    if (isImageType(mediaType)) {
      const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd);
      setCurrentTime(clampedTime);
      
      // Update audio position too
      if (audioRef.current) {
        audioRef.current.currentTime = clampedTime;
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
  };
  
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
  
  // Utility function to format time - with conditional precision
  const formatTime = (seconds: number, showTenths: boolean = false): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    if (showTenths) {
      // Show tenths of a second when dragging brackets
      const tenths = Math.floor((seconds % 1) * 10);
      return `${mins}:${secs.toString().padStart(2, '0')}.${tenths}`;
    } else {
      // Standard format for normal display
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // Get project aspect ratio as a number (e.g. 9/16 or 16/9)
  const getProjectAspectRatioNumber = useCallback(() => {
    const [width, height] = projectAspectRatio.split(':').map(Number);
    return width / height;
  }, [projectAspectRatio]);

  // Get container style with letterboxing/pillarboxing
  const getContainerStyle = useCallback(() => {
    console.log(`[VideoContextScenePreviewPlayer] Calculating container style for scene ${sceneId}:`, {
      receivedProjectAspectRatio: projectAspectRatio,
      isCompactView
    });

    // Get project aspect ratio as a number
    const [width, height] = projectAspectRatio.split(':').map(Number);
    const projectRatio = width / height;
    
    // Style for container div - enforces the project aspect ratio
    const containerStyle: CSSProperties = {
      backgroundColor: '#000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
      width: '100%',
      height: isCompactView ? '190px' : 'auto',
      zIndex: 1, // Add a base z-index for proper stacking
    };

    // Apply aspect ratio in both view modes - not just expanded view
    containerStyle.aspectRatio = projectAspectRatio.replace(':', '/');

    console.log(`[VideoContextScenePreviewPlayer] Final container style for scene ${sceneId}:`, {
      projectAspectRatio,
      projectRatio,
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
    const mediaRatio = aspectRatio || projectRatio;

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
  }, [aspectRatio, projectAspectRatio, showLetterboxing, isCompactView, sceneId]);
  
  // Get media element style with letterboxing/pillarboxing
  const getMediaStyle = useCallback(() => {
    // Calculate aspect ratios
    const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
    const projectRatio = projWidth / projHeight;
    const mediaRatio = aspectRatio || projectRatio;

    type MediaStyle = {
      objectFit: 'contain' | 'cover';
      maxWidth: string;
      maxHeight: string;
      width?: string;
      height?: string;
    };

    let style: MediaStyle = {
      objectFit: 'contain',
      maxWidth: '100%',
      maxHeight: '100%'
    };

    if (showLetterboxing) {
      // CONSISTENT CALCULATION:
      // Calculate width/height percentage based on aspect ratio comparison
      // This is the key to consistent appearance between views
      
      if (mediaRatio > projectRatio) {
        // Media is wider than project - it will have letterboxing (black bars top/bottom)
        // Keep width at 100% and calculate height to maintain aspect ratio
        style = {
          ...style,
          width: '100%',
          height: 'auto',
          maxHeight: '100%'
        };
        console.log(`[AspectRatio-Styling] Scene ${sceneId}: Using LETTERBOXING for wide media`);
      } else if (mediaRatio < projectRatio) {
        // Media is taller than project - it will have pillarboxing (black bars sides)
        // Keep height at 100% and calculate width to maintain aspect ratio
        style = {
          ...style,
          width: 'auto',
          height: '100%',
          maxWidth: '100%'
        };
        console.log(`[AspectRatio-Styling] Scene ${sceneId}: Using PILLARBOXING for tall media`);
      } else {
        // Perfect match - no letterboxing or pillarboxing needed
        style = {
          ...style,
          width: '100%',
          height: '100%'
        };
        console.log(`[AspectRatio-Styling] Scene ${sceneId}: PERFECT MATCH, no boxing needed`);
      }
    } else {
      // No letterboxing - stretch to fill
      style = {
        ...style,
        width: '100%',
        height: '100%',
        objectFit: 'cover'
      };
    }

    return style;
  }, [aspectRatio, projectAspectRatio, showLetterboxing, sceneId]);
  
  // Set up mouse event listeners for trim bracket dragging
  useEffect(() => {
    if (!activeHandle) return;
    
    // Store the current playback position when starting to drag
    const initialPlaybackPosition = currentTime;
    
    // Create a handler for mouse movement during drag
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      // Direct mouse positioning for precise control
      const relativeX = e.clientX - rect.left;
      // Calculate percentage of timeline width with high precision
      const percentPosition = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
      // Use full floating point precision for time calculations
      const newTime = (percentPosition / 100) * duration;
      
      if (activeHandle === 'start') {
        // Ensure trim start doesn't go beyond trim end minus minimum duration
        // Preserve full precision for trim positions (don't round)
        const newStart = Math.min(newTime, trimEnd - 0.1);
        setTrimStart(newStart);
        if (onTrimChange) onTrimChange(newStart, trimEnd);
        
        // Update visuals for both video and image media types
        if (videoContext) {
          // For videos with VideoContext
          videoContext.currentTime = newStart;
        }
        
        // Set visual time for all media types
        setVisualTime(newStart);
        setCurrentTime(newStart);
        
        // Update audio time if available
        if (audioRef.current) {
          audioRef.current.currentTime = newStart;
        }
      } else if (activeHandle === 'end') {
        // Ensure trim end doesn't go before trim start plus minimum duration
        // Preserve full precision for trim positions (don't round)
        const newEnd = Math.max(newTime, trimStart + 0.1);
        setTrimEnd(newEnd);
        userTrimEndRef.current = newEnd;
        if (onTrimChange) onTrimChange(trimStart, newEnd);
        
        // Update video frame visually without changing playhead position
        videoContext.currentTime = newEnd;
        setVisualTime(newEnd);
        
        // Update audio time if available
        if (audioRef.current) {
          audioRef.current.currentTime = newEnd;
        }
      }
      
      setTrimManuallySet(true);
    };
    
    // Handle mouse up to end the drag operation
    const handleMouseUp = () => {
      // Store which handle was active before clearing it
      const wasHandleActive = activeHandle;
      setActiveHandle(null);
      document.body.style.cursor = 'default';
      
      // Only update the current time if left bracket (start) was being dragged
      if (!isPlaying && wasHandleActive === 'start') {
        setCurrentTime(visualTime);
      }
      // For end bracket, we don't update the currentTime
    };
    
    // Set cursor style for better UX
    document.body.style.cursor = 'ew-resize';
    
    // Add event listeners to document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Cleanup when unmounted or when activeHandle changes
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
  }, [activeHandle, trimStart, trimEnd, duration, containerRef, onTrimChange, videoContext, isPlaying, currentTime, visualTime]);
  
  // Add effect to handle first frame capture
  useEffect(() => {
    if (mediaType !== 'video' || !localMediaUrl) return;
    
    const video = videoRef.current;
    if (!video) return;
    
    // Set the video source to the local media URL
    video.src = localMediaUrl;
    
    // Load metadata and pause at the first frame
    video.addEventListener('loadedmetadata', () => {
      video.currentTime = 0;
    });
    
    // When data is available, show the first frame and pause
    video.addEventListener('loadeddata', () => {
      video.pause();
      setIsLoading(false);
    });
    
    return () => {
      video.removeEventListener('loadedmetadata', () => {});
      video.removeEventListener('loadeddata', () => {});
      video.src = '';
    };
  }, [localMediaUrl, mediaType]);
  
  // Add this after the VideoContext initialization effect
  // This effect handles project aspect ratio changes without re-initializing VideoContext
  useEffect(() => {
    console.log(`[VideoContext] Project aspect ratio changed to ${projectAspectRatio} for scene ${sceneId}`);
    
    // Update styling only, don't re-create the VideoContext
    // Canvas dimensions and content remain the same
    
  }, [projectAspectRatio, sceneId]);
  
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
              const exactRatio = aspectRatio;
              
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
            ...getMediaStyle(),
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
                ...getMediaStyle(),
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
                ...getMediaStyle(),
                objectFit: 'contain',
                zIndex: 10,
                maxHeight: isCompactView ? '190px' : '100%',
                pointerEvents: 'none' // Ensure all clicks pass through
              }}
              data-testid="fallback-image"
              onLoad={() => {
                const instanceId = `${sceneId}-${Math.random().toString(36).substr(2, 9)}`;
                console.log(`[DEBUG-FALLBACK][${instanceId}] Image loaded successfully`);
                
                // If we have an img element, get the aspect ratio from it
                if (imgRef.current) {
                  const imgWidth = imgRef.current.naturalWidth;
                  const imgHeight = imgRef.current.naturalHeight;
                  const ratio = imgWidth / imgHeight;
                  console.log(`[DEBUG-FALLBACK][${instanceId}] Image dimensions: ${imgWidth}x${imgHeight}, ratio: ${ratio.toFixed(2)}`);
                  setAspectRatio(ratio);
                  
                  // Determine if image is square (within a small margin of error)
                  const isSquareImage = ratio >= 0.9 && ratio <= 1.1;
                  setIsSquare(isSquareImage);
                  setIsVertical(ratio < 0.9);
                }
                
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
              ...getMediaStyle(),
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