/**
 * VideoContextScenePreviewPlayer - Component for playing scene media with VideoContext
 * 
 * This component is a replacement for ScenePreviewPlayer, using VideoContext for
 * more accurate timeline scrubbing and playback. It maintains the same interface
 * as ScenePreviewPlayer for easy integration with the existing scene card UI.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PlayIcon, PauseIcon, LockIcon, UnlockIcon } from 'lucide-react';
import { VideoContextProvider } from '@/contexts/VideoContextProvider';

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
  // State for player
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for hover and trim controls
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  
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
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // Add state to track media aspect ratio
  const [aspectRatio, setAspectRatio] = useState<number>(9/16); // Default to vertical
  const [isVertical, setIsVertical] = useState<boolean>(true);
  
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
    // Make sure we're on client side and canvas exists
    if (typeof window === 'undefined' || !canvasRef.current) return;
    
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
        
        // Create source node
        let source;
        if (mediaType === 'video') {
          source = ctx.video(mediaUrl);
        } else if (mediaType === 'image') {
          source = ctx.image(mediaUrl);
        } else {
          throw new Error(`Unsupported media type: ${mediaType}`);
        }
        
        // No longer integrating audio with VideoContext
        // Let the separate audio element handle it
        
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
            setDuration(videoElement.duration);
            setTrimEnd(videoElement.duration);
            
            // Set aspect ratio from video dimensions
            const videoWidth = videoElement.videoWidth;
            const videoHeight = videoElement.videoHeight;
            const ratio = videoWidth / videoHeight;
            setAspectRatio(ratio);
            setIsVertical(ratio < 1);
          } else if (audioRef.current && audioRef.current.duration) {
            // For images with audio, use audio duration
            setDuration(audioRef.current.duration);
            setTrimEnd(audioRef.current.duration);
          } else {
            // Default duration for images without audio
            setDuration(5);
            setTrimEnd(5);
          }
        });
        
        // Set up time update callback
        ctx.registerTimeUpdateCallback((time: number) => {
          setCurrentTime(time);
          
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
  }, [mediaUrl, mediaType]); // Remove audioUrl from dependencies since we're handling it separately
  
  // Update trim values when props change
  useEffect(() => {
    setTrimStart(trim.start);
    setTrimEnd(trim.end || duration);
  }, [trim.start, trim.end, duration]);
  
  // Handle play/pause
  const handlePlay = () => {
    if (!videoContext) return;
    
    // Start playback from trim start if at the end
    if (currentTime >= trimEnd) {
      videoContext.currentTime = trimStart;
      if (audioRef.current) {
        audioRef.current.currentTime = trimStart;
      }
    }
    
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
    videoContext.pause();
    setIsPlaying(false);
    
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
    videoContext.currentTime = clampedTime;
    setCurrentTime(clampedTime);
    
    // Update audio position too
    if (audioRef.current) {
      audioRef.current.currentTime = clampedTime;
    }
  };
  
  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !videoContext) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const percentClicked = clickPosition / rect.width;
    const newTime = trimStart + percentClicked * (trimEnd - trimStart);
    
    handleTimeUpdate(newTime);
  };
  
  // Handle trim start/end change
  const handleTrimChange = useCallback((type: 'start' | 'end', value: number) => {
    if (type === 'start') {
      const newStart = Math.max(0, Math.min(value, trimEnd - 0.5));
      setTrimStart(newStart);
      if (onTrimChange) {
        onTrimChange(newStart, trimEnd);
      }
    } else {
      const newEnd = Math.max(trimStart + 0.5, Math.min(value, duration));
      setTrimEnd(newEnd);
      if (onTrimChange) {
        onTrimChange(trimStart, newEnd);
      }
    }
  }, [trimStart, trimEnd, duration, onTrimChange]);
  
  // Toggle controls lock
  const toggleControlsLock = () => {
    setControlsLocked(!controlsLocked);
  };
  
  // Toggle trim mode
  const toggleTrimMode = () => {
    setTrimActive(!trimActive);
    // Auto-lock controls when trim mode is active
    if (!trimActive && !controlsLocked) {
      setControlsLocked(true);
    }
  };
  
  // Helper function to format time
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Modify the getMediaStyle function for better aspect ratio handling
  const getMediaStyle = (): React.CSSProperties => {
    // For vertical media (9:16 aspect ratio for shorts)
    if (isVertical) {
      return {
        width: isCompactView ? 'auto' : '100%',
        height: isCompactView ? '100%' : 'auto',
        maxHeight: isCompactView ? '190px' : '400px',
        maxWidth: isCompactView ? '110px' : '225px', // Control width for vertical videos
        margin: 'auto',
        display: 'block'
      };
    }
    
    // For horizontal media
    return {
      width: '100%',
      height: 'auto',
      maxHeight: isCompactView ? '190px' : '400px',
      margin: 'auto',
      display: 'block'
    };
  };
  
  // Calculate current time position in percent
  const getCurrentTimePercent = () => {
    if (trimEnd === trimStart) return 0;
    const percent = ((currentTime - trimStart) / (trimEnd - trimStart)) * 100;
    return Math.max(0, Math.min(100, percent));
  };
  
  // Determine if controls should be visible
  const shouldShowControls = isHovering || controlsLocked;
  
  // Handle trim handles drag behavior
  useEffect(() => {
    if (!activeHandle || !trimActive) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const timelineWidth = rect.width;
      const position = (e.clientX - rect.left) / timelineWidth;
      const timePosition = Math.max(0, Math.min(position * duration, duration));
      
      if (activeHandle === 'start') {
        handleTrimChange('start', timePosition);
      } else if (activeHandle === 'end') {
        handleTrimChange('end', timePosition);
      }
    };
    
    const handleMouseUp = () => {
      setActiveHandle(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, trimActive, duration, handleTrimChange]);
  
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
        
        {/* Hoverable controls - Smaller size */}
        <div 
          className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${shouldShowControls ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: shouldShowControls ? 'auto' : 'none' }}
          data-testid="hover-controls"
          data-drag-handle-exclude="true"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.stopPropagation()}
          draggable={false}
        >
          {/* Timeline scrubber with trim controls - reduced size */}
          <div className="p-1 bg-black bg-opacity-50" onMouseDown={(e) => e.stopPropagation()}>
            {/* Time indicator - smaller text */}
            <div className="flex justify-between text-white text-[8px] mb-0.5">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            
            {/* Timeline - using native range input like the volume slider */}
            <div 
              className="relative" 
              onMouseDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()} 
              draggable={false}
              data-drag-handle-exclude="true"
            >
              {/* Native range input for timeline scrubbing */}
              <input 
                ref={timelineRef}
                type="range"
                min="0"
                max={duration || 1}
                step="0.01"
                value={currentTime}
                className="w-full h-2"
                style={{
                  WebkitAppearance: "none",
                  appearance: "none",
                  height: "8px",
                  background: "rgba(55, 65, 81, 1)",
                  borderRadius: "4px",
                  outline: "none",
                  cursor: "pointer"
                }}
                onChange={(e) => {
                  e.stopPropagation();
                  handleTimeUpdate(parseFloat(e.target.value));
                }}
                data-testid="timeline-scrubber"
              />
              
              {/* Trim controls overlay - only shown in trim mode */}
              {trimActive && (
                <div className="absolute top-0 left-0 right-0 h-2" data-drag-handle-exclude="true">
                  {/* Trim area highlight */}
                  <div 
                    className="absolute h-full bg-blue-600 opacity-30"
                    style={{ 
                      left: `${(trimStart / duration) * 100}%`, 
                      width: `${((trimEnd - trimStart) / duration) * 100}%` 
                    }}
                    data-testid="trim-area"
                  ></div>
                  
                  {/* Start trim handle - using range input position only */}
                  <div className="absolute h-full" style={{ left: `${(trimStart / duration) * 100}%`, width: "8px", transform: "translateX(-4px)" }}>
                    <input 
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={trimStart}
                      className="absolute h-full opacity-0 cursor-ew-resize z-20"
                      style={{ 
                        width: "8px",
                        WebkitAppearance: "none",
                        appearance: "none"
                      }}
                      onChange={(e) => {
                        // Only used for drag cancellation - actual value change handled in mouse handlers
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('start');
                      }}
                      data-testid="trim-start-handle"
                    />
                    {/* Visual indicator */}
                    <div 
                      className="absolute h-full w-1 bg-white opacity-80 pointer-events-none" 
                      style={{ left: "50%", transform: "translateX(-50%)" }}
                    ></div>
                  </div>
                  
                  {/* End trim handle - using range input position only */}
                  <div className="absolute h-full" style={{ left: `${(trimEnd / duration) * 100}%`, width: "8px", transform: "translateX(-4px)" }}>
                    <input 
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={trimEnd}
                      className="absolute h-full opacity-0 cursor-ew-resize z-20"
                      style={{ 
                        width: "8px",
                        WebkitAppearance: "none",
                        appearance: "none"
                      }}
                      onChange={(e) => {
                        // Only used for drag cancellation - actual value change handled in mouse handlers
                        e.stopPropagation();
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('end');
                      }}
                      data-testid="trim-end-handle"
                    />
                    {/* Visual indicator */}
                    <div 
                      className="absolute h-full w-1 bg-white opacity-80 pointer-events-none" 
                      style={{ left: "50%", transform: "translateX(-50%)" }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Control buttons - Smaller size */}
            <div className="flex justify-end mt-0.5">
              {/* Trim mode toggle - simpler */}
              <button
                onClick={toggleTrimMode}
                className={`text-white text-[8px] py-0.5 px-1 rounded ${trimActive ? 'bg-blue-600' : 'bg-gray-600'}`}
                data-testid="trim-toggle"
                data-drag-handle-exclude="true"
              >
                {trimActive ? 'Done' : 'Trim'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoContextScenePreviewPlayer; 