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
}) => {
  console.log(`[VideoContext] Component rendering for scene ${sceneId} with media URL: ${mediaUrl}`);
  
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
  const [trimEnd, setTrimEnd] = useState<number>(trim.end || 10);
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
          "will-reset": time >= actualTrimEnd 
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
              currentTrimEnd: trimEnd,
              currentUserTrimEnd: userTrimEndRef.current
            });
            
            // Set the duration
            setDuration(videoElement.duration);
            
            // Always ensure trimEnd is set to the full duration initially if not set
            if (trimEnd <= 0 || trimEnd > videoElement.duration) {
              setTrimEnd(videoElement.duration);
            }
            
            // Initialize userTrimEnd if not already set
            if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
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
      "trimManuallySet": trimManuallySet 
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
    console.warn(`[VideoContext] Scrubbing to time: ${clampedTime.toFixed(2)}`);
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
    return (value / 100) * duration;
  };
  
  // Function to convert timeline position to range input value
  const positionToTimelineValue = (position: number): number => {
    // When trim handles are being dragged, maintain current position
    if (activeHandle) {
      return (currentTime / duration) * 100;
    }
    return (position / duration) * 100;
  };
  
  // Handle trim range changes
  const handleTrimStartChange = (value: number) => {
    // Create previous values for undo/redo
    const prevStart = trimStart;
    const prevEnd = trimEnd;
    
    // Update the values
    const newStart = Math.min(value, trimEnd - 0.1);
    
    console.log("[VideoContext] Changing trim start", {
      prevStart,
      newStart,
      trimEnd
    });
    
    setTrimStart(newStart);
    setTrimManuallySet(true);
    
    // Notify parent if callback exists
    if (onTrimChange) {
      onTrimChange(newStart, trimEnd);
    }
    
    // Add to edit history
    historyManager.current.addAction(
      ActionType.TRIM_CHANGE,
      sceneId,
      projectId,
      { mediaType, trimType: 'start', prevStart, newStart },
      async () => {
        // Undo function
        setTrimStart(prevStart);
        if (onTrimChange) onTrimChange(prevStart, prevEnd);
      }
    );
  };
  
  const handleTrimEndChange = (value: number) => {
    // Create previous values for undo/redo
    const prevStart = trimStart;
    const prevEnd = trimEnd;
    
    // Update the values
    const newEnd = Math.max(value, trimStart + 0.1);
    
    console.log("[VideoContext] Changing trim end", {
      prevEnd,
      newEnd,
      trimStart,
      "prop trimEnd": trim.end,
      "before userTrimEnd": userTrimEndRef.current
    });
    
    // Update both the state and the ref
    setTrimEnd(newEnd);
    userTrimEndRef.current = newEnd;
    setTrimManuallySet(true);
    
    console.log("[VideoContext] After changing trim end", {
      "new trimEnd": newEnd, 
      "new userTrimEnd": userTrimEndRef.current
    });
    
    // Notify parent if callback exists
    if (onTrimChange) {
      onTrimChange(trimStart, newEnd);
    }
    
    // Add to edit history
    historyManager.current.addAction(
      ActionType.TRIM_CHANGE,
      sceneId,
      projectId,
      { mediaType, trimType: 'end', prevEnd, newEnd },
      async () => {
        // Undo function
        setTrimEnd(prevEnd);
        if (onTrimChange) onTrimChange(prevStart, prevEnd);
      }
    );
  };
  
  // Utility function to format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  
  // Render loading state
  if (isLoading && !localMediaUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-900 rounded-lg overflow-hidden ${className}`}
           style={{ height: isCompactView ? '110px' : '200px', width: isCompactView ? '110px' : '100%' }}>
        <div className="flex flex-col items-center justify-center text-white">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
          <div className="text-xs">
            {downloadProgress > 0 ? `${Math.round(downloadProgress * 100)}%` : 'Loading...'}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden ${className}`}
      data-testid="videocontext-scene-preview-player"
      style={{ maxWidth: isCompactView ? (isVertical ? '110px' : '100%') : '100%' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDragStart={(e) => e.stopPropagation()}
      draggable={false}
    >
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
        
        <canvas 
          ref={canvasRef}
          className="w-auto h-auto"
          style={getMediaStyle()}
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
        
        {/* Controls container */}
        <div 
          className={`absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 transition-opacity duration-200 ${isHovering || controlsLocked ? 'opacity-100' : 'opacity-100'}`}
          data-drag-handle-exclude="true"
          style={{ 
            minHeight: '36px',
            padding: '4px 8px 8px 8px',
            zIndex: 10
          }}
        >
          {/* Trim controls - shown only when trim mode active */}
          {trimActive && (
            <div 
              className="flex items-center space-x-1 px-1 pb-2 animate-fadeIn"
              data-drag-handle-exclude="true"
            >
              {/* Trim Start */}
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.01"
                  value={trimStart}
                  onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-blue-300 accent-blue-500"
                  style={{ height: '4px' }}
                  data-testid="trim-start-control"
                  data-drag-handle-exclude="true"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveHandle('start');
                  }}
                  onMouseUp={() => {
                    setActiveHandle(null);
                  }}
                />
              </div>
              
              {/* Trim End */}
              <div className="flex-1">
                <input
                  type="range"
                  min="0"
                  max={duration}
                  step="0.01"
                  value={getEffectiveTrimEnd()}
                  onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                  className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-blue-300 accent-blue-500"
                  style={{ height: '4px' }}
                  data-testid="trim-end-control"
                  data-drag-handle-exclude="true"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setActiveHandle('end');
                  }}
                  onMouseUp={() => {
                    setActiveHandle(null);
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Main timeline scrubber */}
          <div className="flex items-center px-1 mb-1 relative">
            {/* Timeline scrubber */}
            <input
              ref={timelineRef}
              type="range"
              min="0"
              max="100"
              value={positionToTimelineValue(currentTime)}
              onChange={(e) => {
                // Only allow timeline scrubbing when not adjusting trim handles
                if (!activeHandle) {
                  handleTimeUpdate(timelineValueToPosition(parseFloat(e.target.value)));
                }
              }}
              className={`w-full h-1 rounded-lg appearance-none cursor-pointer bg-gray-700 ${activeHandle ? 'pointer-events-none' : ''}`}
              style={{ 
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${positionToTimelineValue(currentTime)}%, #4b5563 ${positionToTimelineValue(currentTime)}%, #4b5563 100%)`,
                height: '6px',
                opacity: activeHandle ? 0.5 : 1,
              }}
              data-testid="timeline-scrubber"
              data-drag-handle-exclude="true"
              onMouseDown={(e) => {
                e.stopPropagation();
                if (!activeHandle) {
                  setIsDraggingScrubber(true);
                }
              }}
              onMouseUp={() => setIsDraggingScrubber(false)}
              onMouseLeave={() => setIsDraggingScrubber(false)}
            />
            
            {/* Time indicator tooltip */}
            {isDraggingScrubber && (
              <div 
                className="absolute text-[8px] text-white bg-black bg-opacity-75 px-1 py-0.5 rounded pointer-events-none transform -translate-y-full"
                style={{ 
                  left: `${positionToTimelineValue(currentTime)}%`,
                  bottom: '8px',
                  transform: 'translateX(-50%)',
                }}
              >
                {formatTime(currentTime)}
              </div>
            )}
            
            {/* Display time if not in compact view */}
            {!isCompactView && (
              <span className="absolute right-0 -top-5 text-white text-xs">
                {formatTime(currentTime)}
              </span>
            )}
            
            {/* Show trim brackets based on conditions */}
            {(
              // Show in edit mode regardless of position
              trimActive || 
              // When not in edit mode, only show if not at extreme positions
              (
                trimManuallySet && 
                // Don't show left bracket at extreme left unless in edit mode
                (trimStart > 0.01 || trimActive) && 
                // Don't show right bracket at extreme right unless in edit mode
                (getEffectiveTrimEnd() < duration - 0.01 || trimActive)
              )
            ) && (
              <>
                {/* Left trim bracket - only visible if not at start or in edit mode */}
                <div 
                  className="absolute w-0.5 bg-blue-400 rounded-full"
                  style={{ 
                    left: `calc(${(trimStart / duration) * 100}% - 0.5px)`,
                    top: '-4px',
                    height: '14px',
                    transform: 'none',
                    opacity: (trimStart <= 0.01 && !trimActive) ? 0 : 1
                  }}
                />
                
                {/* Right trim bracket - only visible if not at end or in edit mode */}
                <div 
                  className="absolute w-0.5 bg-blue-400 rounded-full"
                  style={{ 
                    left: `calc(${(getEffectiveTrimEnd() / duration) * 100}% - 0.5px)`,
                    top: '-4px',
                    height: '14px',
                    transform: 'none',
                    opacity: (getEffectiveTrimEnd() >= duration - 0.01 && !trimActive) ? 0 : 1
                  }}
                />
              </>
            )}
          </div>
          
          {/* Control buttons row */}
          <div className="flex justify-between items-center px-1">
            {/* Lock button (left side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setControlsLocked(!controlsLocked);
              }}
              className="text-white opacity-70 hover:opacity-100 focus:outline-none"
              data-testid="toggle-lock-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '2px' }}
            >
              {controlsLocked ? (
                <LockIcon className="w-3 h-3" />
              ) : (
                <UnlockIcon className="w-3 h-3" />
              )}
            </button>

            {/* Time display (center) */}
            <div className="text-white text-[10px] opacity-70 select-none">
              {formatTime(currentTime)}
            </div>
            
            {/* Scissor/Save button (right side) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTrimActive(!trimActive);
              }}
              className="text-white opacity-70 hover:opacity-100 focus:outline-none"
              data-testid="toggle-trim-button"
              onMouseDown={(e) => e.stopPropagation()}
              style={{ padding: '2px' }}
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