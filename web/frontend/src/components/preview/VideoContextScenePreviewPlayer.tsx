/**
 * VideoContextScenePreviewPlayer - Component for playing scene media with VideoContext
 * 
 * This component is a replacement for ScenePreviewPlayer, using VideoContext for
 * more accurate timeline scrubbing and playback. It maintains the same interface
 * as ScenePreviewPlayer for easy integration with the existing scene card UI.
 * 
 * Enhanced with local media downloads for improved seeking and scrubbing.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon, LockIcon, UnlockIcon, ScissorsIcon, CheckIcon } from 'lucide-react';
import { VideoContextProvider } from '@/contexts/VideoContextProvider';
import MediaDownloadManager from '@/utils/media/mediaDownloadManager';
import EditHistoryManager, { ActionType } from '@/utils/video/editHistoryManager';

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
}) => {
  console.log(`[VideoContext] Component rendering for scene ${sceneId} with media URL: ${mediaUrl}`);
  console.log(`[VideoContext] Initial trim values:`, trim);
  console.log(`[VideoContext] Thumbnail URL:`, thumbnailUrl);
  
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
  const [aspectRatio, setAspectRatio] = useState<number>(9/16); // Default to vertical
  const [isVertical, setIsVertical] = useState<boolean>(true);
  
  // Add state for local media
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
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
    if (audioRef.current) {
      audioRef.current.currentTime = currentTime;
      
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error("Audio play error:", err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTime, audioUrl]);
  
  // Initialize VideoContext with proper null checking
  useEffect(() => {
    // Don't initialize until we have local media URL
    if (typeof window === 'undefined' || !canvasRef.current || !localMediaUrl) return;
    
    // Import VideoContext dynamically to avoid SSR issues
    const initVideoContext = async () => {
      try {
        // Clean up existing context if any
        if (videoContext) {
          videoContext.reset();
          videoContext.dispose();
          setVideoContext(null);
        }
        
        // Dynamically import VideoContext
        const VideoContextModule = await import('videocontext');
        const VideoContext = VideoContextModule.default || VideoContextModule;
        
        // Create non-null assertion for canvas since we checked above
        const canvas = canvasRef.current!;
        
        // Set the initial canvas dimensions for correct aspect ratio
        canvas.width = 1080;  // Standard short-form width
        canvas.height = 1920; // Standard short-form height for 9:16 aspect ratio
        
        // Create VideoContext instance
        const ctx = new VideoContext(canvas);
        setVideoContext(ctx);
        
        // Create source node (using local media URL)
        let source;
        if (mediaType === 'video') {
          source = ctx.video(localMediaUrl);
        } else if (mediaType === 'image') {
          source = ctx.image(localMediaUrl);
        } else {
          throw new Error(`Unsupported media type: ${mediaType}`);
        }
        
        // Set up source timing and connect to output
        source.start(0);
        source.connect(ctx.destination);
        
        // Handle video loading
        source.registerCallback('loaded', () => {
          setIsLoading(false);
          setIsReady(true);
          
          // Set duration based on media type and audio
          if (mediaType === 'video') {
            // Handle HTMLVideoElement specifically for type safety
            const videoElement = source.element as HTMLVideoElement;
            
            console.log("[VideoContext] Video loaded", {
              duration: videoElement.duration,
              durationDataType: typeof videoElement.duration,
              currentTrimEnd: trimEnd,
              currentUserTrimEnd: userTrimEndRef.current,
              isNaN: isNaN(videoElement.duration),
              isFinite: isFinite(videoElement.duration)
            });
            
            // Set the duration
            setDuration(videoElement.duration);
            
            // Log values for debugging
            console.log(`[VideoContext] Video Duration: ${videoElement.duration}, trim.end: ${trim.end}, trimEnd: ${trimEnd}`);
            
            // Always ensure trimEnd is set to the full duration if not set or is the default 10 seconds
            if (trimEnd <= 0 || trimEnd === 10) {
              setTrimEnd(videoElement.duration);
              console.log(`[VideoContext] Updated trimEnd to full duration: ${videoElement.duration}`);
            }
            
            // Initialize userTrimEnd if not already set or is currently set to 10 seconds
            if (userTrimEndRef.current === null || userTrimEndRef.current <= 0 || userTrimEndRef.current === 10) {
              userTrimEndRef.current = videoElement.duration;
              console.log("[VideoContext] Setting initial userTrimEnd to", videoElement.duration);
            }
            
            // Set aspect ratio from video dimensions
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;
            const ratio = videoWidth / videoHeight;
            setAspectRatio(ratio);
            setIsVertical(ratio < 1);
          } else if (audioRef.current && audioRef.current.duration) {
            // For images with audio, use audio duration
            console.log("[VideoContext] Audio loaded", {
              duration: audioRef.current.duration,
              currentTrimEnd: trimEnd,
              currentUserTrimEnd: userTrimEndRef.current
            });
            
            // Set the duration
            setDuration(audioRef.current.duration);
            
            // Always ensure trimEnd is set to the full duration initially if not set
            if (trimEnd <= 0 || trimEnd > audioRef.current.duration) {
              setTrimEnd(audioRef.current.duration);
            }
            
            // Initialize userTrimEnd if not already set
            if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
              userTrimEndRef.current = audioRef.current.duration;
              console.log("[VideoContext] Setting initial userTrimEnd to", audioRef.current.duration);
            }
          } else {
            // Default duration for images without audio
            console.log("[VideoContext] Setting default duration");
            
            // Set the duration
            setDuration(5);
            
            // Always ensure trimEnd is set to the full duration initially
            setTrimEnd(5);
            
            // Initialize userTrimEnd if not already set
            if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
              userTrimEndRef.current = 5;
              console.log("[VideoContext] Setting initial userTrimEnd to", 5);
            }
          }
        });
        
        // Set up time update callback
        ctx.registerTimeUpdateCallback((time: number) => {
          console.warn(`[VideoContext] Time update: ${time.toFixed(2)}`);
          
          // Ensure we're updating state with the latest time
          setCurrentTime(time);
          
          // Request an animation frame to ensure smooth updates
          requestAnimationFrame(() => {
            setCurrentTime(time);
          });
          
          // Auto-pause at trim end
          if (time >= trimEnd) {
            ctx.pause();
            setIsPlaying(false);
            if (audioRef.current) {
              audioRef.current.pause();
            }
          }
        });
        
        return {
          context: ctx,
          source
        };
      } catch (error) {
        console.error('Error initializing VideoContext:', error);
        setIsLoading(false);
        return null;
      }
    };
    
    const setup = initVideoContext();
    
    // Clean up
    return () => {
      setup.then(result => {
        if (result?.context) {
          result.context.reset();
          result.context.dispose();
        }
      });
    };
  }, [localMediaUrl, mediaType]); // Only re-run when localMediaUrl changes
  
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
  
  // Handle play/pause with trim boundaries
  const handlePlay = () => {
    if (!videoContext) return;
    
    // When playing, switch from first frame to canvas
    setShowFirstFrame(false);
    
    // If current time is outside trim bounds, reset to trim start
    if (currentTime < trimStart || currentTime >= trimEnd) {
      videoContext.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
    
    // Log trim values before playing
    console.log("[VideoContext] Before play", {
      videoTime: videoContext.currentTime,
      trimStart,
      trimEnd,
      "trim.end": trim.end
    });
    
    videoContext.play();
    setIsPlaying(true);
    
    // Play the audio in sync
    if (audioRef.current) {
      audioRef.current.currentTime = videoContext.currentTime;
      audioRef.current.play().catch(err => console.error("Error playing audio:", err));
    }
  };
  
  const handlePause = () => {
    if (!videoContext) return;
    
    console.log("[VideoContext] Pausing playback", {
      currentTime: videoContext.currentTime,
      trimStart,
      trimEnd,
      "trim.end": trim.end,
      trimManuallySet
    });
    
    videoContext.pause();
    setIsPlaying(false);
    
    // Cancel animation frame on pause
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Pause the audio too
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  // Handle seeked time update
  const handleTimeUpdate = (newTime: number) => {
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
  
  // Get style for the video display based on aspect ratio
  const getMediaStyle = () => {
    // Video is wider than it is tall (landscape)
    if (aspectRatio > 1) {
      return {
        width: isCompactView ? 'auto' : '100%',
        height: isCompactView ? '110px' : 'auto',
        objectFit: 'contain' as const,
      };
    }
    
    // Video is taller than it is wide (portrait)
    return {
      width: isCompactView ? '110px' : '100%',
      height: 'auto',
      objectFit: 'contain' as const,
    };
  };
  
  // Set up mouse event listeners for trim bracket dragging
  useEffect(() => {
    if (!activeHandle) return;
    
    // Store the current playback position when starting to drag
    const initialPlaybackPosition = currentTime;
    
    // Create a handler for mouse movement during drag
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!containerRef.current || !videoContext) return;
      
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
        
        // Update video frame visually without changing playhead position
        videoContext.currentTime = newStart;
        setVisualTime(newStart);
        
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
  
  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden video-player-container ${className}`}
      data-testid="videocontext-scene-preview-player"
      style={{ 
        maxWidth: isCompactView ? (isVertical ? '110px' : '100%') : '100%',
        outline: 'none',
        border: 'none'
      }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
      draggable={false}
      tabIndex={-1}
    >
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
              setDuration(audioRef.current.duration);
              setTrimEnd(audioRef.current.duration);
            }
          }}
        />
      )}
      
      {/* Media Display */}
      <div className="relative bg-black flex items-center justify-center">
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
            style={getMediaStyle()}
            playsInline
            muted
            preload="auto"
            data-testid="first-frame-video"
          />
        )}
        
        {/* VideoContext canvas (visible when playing) */}
        <canvas 
          ref={canvasRef}
          className="w-auto h-auto"
          style={{
            ...getMediaStyle(),
            display: showFirstFrame && mediaType === 'video' ? 'none' : 'block'
          }}
          data-testid="videocontext-canvas"
        />
        
        {/* Play/Pause overlay */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent click from bubbling up to scene
            isPlaying ? handlePause() : handlePlay();
          }}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity"
          data-testid="play-pause-button"
          onMouseDown={(e) => e.stopPropagation()}
          draggable={false}
        >
          {isPlaying ? (
            <PauseIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
          ) : (
            <PlayIcon className={`${isCompactView ? 'w-4 h-4' : 'w-6 h-6'} text-white opacity-70`} />
          )}
        </button>
        
        {/* Separate background element with larger height to cover controls */}
        <div 
          className={`absolute bottom-0 left-0 right-0 transition-opacity duration-200 ${isHovering || controlsLocked ? 'opacity-100' : 'opacity-0'}`}
          style={{ 
            height: '40px',
            bottom: '0px',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9, // Behind the controls
          }}
        />
        
        {/* Controls container - now with transparent background */}
        <div 
          className={`absolute bottom-0 left-0 right-0 transition-opacity duration-200 ${isHovering || controlsLocked ? 'opacity-100' : 'opacity-0'}`}
          data-drag-handle-exclude="true"
          style={{ 
            minHeight: '32px',
            padding: '4px 8px 6px 8px',
            zIndex: 10
          }}
        >
          {/* Main timeline scrubber */}
          <div className="flex items-center px-1 mb-1 relative" data-drag-handle-exclude="true">
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
                appearance: 'none'
              }}
              data-testid="timeline-scrubber"
              data-drag-handle-exclude="true"
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!trimActive) {
                  setIsDraggingScrubber(true);
                }
              }}
              onMouseUp={() => setIsDraggingScrubber(false)}
              onMouseLeave={() => setIsDraggingScrubber(false)}
            />
            
            {/* Trim brackets */}
            <>
              {/* Left trim bracket - Using visible native range input with bracket visual */}
              <div 
                className="absolute"
                style={{ 
                  left: `calc(${(trimStart / duration) * 100}% - 6px)`,
                  top: '-8px', 
                  height: '20px', // Reduced height to not overlap controls
                  width: '12px',
                  zIndex: 15, // Lower z-index than controls
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
                        zIndex: 25,
                        opacity: 0
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('start');
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
              
              {/* Right trim bracket - Using visible native range input with bracket visual */}
              <div 
                className="absolute"
                style={{ 
                  left: `calc(${(getEffectiveTrimEnd() / duration) * 100}% - 6px)`,
                  top: '-8px',
                  height: '20px', // Reduced height to not overlap controls
                  width: '12px',
                  zIndex: 15, // Lower z-index than controls
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
                        zIndex: 25,
                        opacity: 0
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('end');
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
          <div className="flex justify-between items-center px-1" data-drag-handle-exclude="true" style={{ position: 'relative', zIndex: 25 }}>
            {/* Lock button (left side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setControlsLocked(!controlsLocked);
              }}
              className="text-white hover:opacity-100 focus:outline-none"
              data-testid="toggle-lock-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '1.5px', position: 'relative', zIndex: 30 }}
            >
              {controlsLocked ? (
                <LockIcon className="w-3 h-3" />
              ) : (
                <UnlockIcon className="w-3 h-3" />
              )}
            </button>

            {/* Time display (center) - updated to conditionally show tenths */}
            <div className="text-white text-[9px] select-none">
              {activeHandle === 'start' 
                ? `${formatTime(trimStart, true)} / ${formatTime(getEffectiveTrimEnd() - trimStart)}`
                : activeHandle === 'end'
                  ? `${formatTime(getEffectiveTrimEnd(), true)} / ${formatTime(getEffectiveTrimEnd() - trimStart)}`
                  : `${formatTime(Math.max(0, currentTime - trimStart))} / ${trimStart > 0 || getEffectiveTrimEnd() < duration ? formatTime(getEffectiveTrimEnd() - trimStart) : formatTime(duration)}`
              }
            </div>
            
            {/* Scissor/Save button (right side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTrimActive(!trimActive);
              }}
              className="text-white hover:opacity-100 focus:outline-none"
              data-testid="toggle-trim-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '1.5px', position: 'relative', zIndex: 30 }}
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