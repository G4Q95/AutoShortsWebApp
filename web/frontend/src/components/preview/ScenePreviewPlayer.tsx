/**
 * ScenePreviewPlayer - Component for playing scene media with synchronized audio
 * 
 * This component handles both image and video media types, synchronizes with audio,
 * and provides playback controls.
 */

import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon, ChevronUpIcon, ChevronDownIcon, VolumeIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';

interface ScenePreviewPlayerProps {
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

const ScenePreviewPlayer = ({
  projectId,
  sceneId,
  mediaUrl,
  audioUrl,
  mediaType,
  trim = { start: 0, end: 0 },
  onTrimChange,
  className = '',
  isCompactView = true,
}: ScenePreviewPlayerProps) => {
  // State for player
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // State for hover and trim controls
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [trimActive, setTrimActive] = useState<boolean>(false);
  const [activeHandle, setActiveHandle] = useState<'start' | 'end' | null>(null);
  const [trimStart, setTrimStart] = useState<number>(trim.start);
  const [trimEnd, setTrimEnd] = useState<number>(trim.end || 0);
  
  // Refs for media elements
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Add state to track media aspect ratio
  const [aspectRatio, setAspectRatio] = useState<number>(16/9); // Default to horizontal
  const [isVertical, setIsVertical] = useState<boolean>(false);
  
  // Update local trim state when props change
  useEffect(() => {
    setTrimStart(trim.start);
    setTrimEnd(trim.end || duration);
  }, [trim.start, trim.end, duration]);
  
  // Initialize player
  useEffect(() => {
    setIsLoading(true);
    
    // If we have audio, set up event listeners
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      // Set up audio event listeners
      audio.addEventListener('loadedmetadata', handleAudioMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleMediaEnded);
      
      // Cleanup event listeners
      return () => {
        audio.removeEventListener('loadedmetadata', handleAudioMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleMediaEnded);
      };
    }
  }, [audioUrl]);
  
  // Set up video event listeners if needed
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      const video = videoRef.current;
      
      // Set up video event listeners
      video.addEventListener('loadedmetadata', handleVideoMetadata);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('ended', handleMediaEnded);
      
      // Cleanup event listeners
      return () => {
        video.removeEventListener('loadedmetadata', handleVideoMetadata);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('ended', handleMediaEnded);
      };
    }
  }, [mediaType, mediaUrl]);
  
  // Add handler to detect aspect ratio when media loads
  const handleMediaLoad = () => {
    if (mediaType === 'video' && videoRef.current) {
      const video = videoRef.current;
      const ratio = video.videoWidth / video.videoHeight;
      setAspectRatio(ratio);
      setIsVertical(ratio < 1); // Ratio < 1 means height > width (vertical)
      setIsLoading(false);
    } else if (mediaType === 'image' && imageRef.current) {
      const image = imageRef.current;
      const ratio = image.naturalWidth / image.naturalHeight;
      setAspectRatio(ratio);
      setIsVertical(ratio < 1); // Ratio < 1 means height > width (vertical)
      setIsLoading(false);
    }
  };
  
  // Add this handler to the video element
  useEffect(() => {
    if (mediaType === 'video' && videoRef.current) {
      const video = videoRef.current;
      video.addEventListener('loadedmetadata', handleMediaLoad);
      
      return () => {
        video.removeEventListener('loadedmetadata', handleMediaLoad);
      };
    }
  }, [mediaType, videoRef.current]);
  
  // Add this handler to the image element
  useEffect(() => {
    if (mediaType === 'image' && imageRef.current) {
      const image = imageRef.current;
      if (image.complete) {
        handleMediaLoad();
      } else {
        image.addEventListener('load', handleMediaLoad);
      }
      
      return () => {
        image.removeEventListener('load', handleMediaLoad);
      };
    }
  }, [mediaType, imageRef.current]);
  
  // Set up event listeners for trim handle dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeHandle || !timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const position = (e.clientX - rect.left) / rect.width;
      const newTime = Math.max(0, Math.min(position * duration, duration));
      
      if (activeHandle === 'start') {
        if (newTime < trimEnd - 0.5) { // Minimum 0.5s duration
          setTrimStart(newTime);
          if (onTrimChange) {
            onTrimChange(newTime, trimEnd);
          }
        }
      } else if (activeHandle === 'end') {
        if (newTime > trimStart + 0.5) { // Minimum 0.5s duration
          setTrimEnd(newTime);
          if (onTrimChange) {
            onTrimChange(trimStart, newTime);
          }
        }
      }
    };
    
    const handleMouseUp = () => {
      setActiveHandle(null);
    };
    
    if (activeHandle) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeHandle, duration, trimStart, trimEnd, onTrimChange]);
  
  // Handler functions
  const handleAudioMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
      
      // If we're showing an image, the audio duration becomes the total duration
      if (mediaType === 'image') {
        // Set trim.end to audio duration if not already set
        if (trim.end === 0 && onTrimChange) {
          onTrimChange(trim.start, audioRef.current.duration);
          setTrimEnd(audioRef.current.duration);
        }
      }
    }
  };
  
  const handleVideoMetadata = () => {
    if (videoRef.current) {
      // For videos, we use the video duration unless the audio is longer
      if (audioRef.current && audioRef.current.duration > videoRef.current.duration) {
        setDuration(audioRef.current.duration);
      } else {
        setDuration(videoRef.current.duration);
      }
      
      setIsLoading(false);
      
      // Set default trim.end to video duration if not already set
      if (trim.end === 0 && onTrimChange) {
        onTrimChange(trim.start, videoRef.current.duration);
        setTrimEnd(videoRef.current.duration);
      }
    }
  };
  
  const handleTimeUpdate = () => {
    // Update current time based on the appropriate media element
    if (mediaType === 'video' && videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      
      // Sync audio with video if needed
      if (audioRef.current && Math.abs(audioRef.current.currentTime - videoRef.current.currentTime) > 0.1) {
        audioRef.current.currentTime = videoRef.current.currentTime;
      }
    } else if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
    
    // Handle trim end point (stop playback)
    if (trimEnd > 0 && currentTime >= trimEnd) {
      handlePause();
      
      // Reset to start position
      if (mediaType === 'video' && videoRef.current) {
        videoRef.current.currentTime = trimStart;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = trimStart;
      }
      
      setCurrentTime(trimStart);
    }
  };
  
  const handleMediaEnded = () => {
    setIsPlaying(false);
    
    // Reset to start position
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = trimStart;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = trimStart;
    }
    
    setCurrentTime(trimStart);
  };
  
  // Playback control functions
  const handlePlay = () => {
    setIsPlaying(true);
    
    // Start playback from trim.start if at beginning
    if (currentTime < trimStart || currentTime >= trimEnd) {
      if (mediaType === 'video' && videoRef.current) {
        videoRef.current.currentTime = trimStart;
      }
      if (audioRef.current) {
        audioRef.current.currentTime = trimStart;
      }
      setCurrentTime(trimStart);
    }
    
    // Play the appropriate media
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.play();
    }
    if (audioRef.current) {
      audioRef.current.play();
    }
  };
  
  const handlePause = () => {
    setIsPlaying(false);
    
    // Pause the appropriate media
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.pause();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    
    // Update media position
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!timelineRef.current || activeHandle) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    // Update current time
    setCurrentTime(newTime);
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };
  
  const handleTrimHandleMouseDown = (handle: 'start' | 'end', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent timeline click
    setActiveHandle(handle);
  };
  
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    
    // Update volume of media elements
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.volume = newVolume;
    }
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  const toggleMute = () => {
    setIsMuted(!isMuted);
    
    // Update volume of media elements
    if (mediaType === 'video' && videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
  };
  
  // Toggle control lock
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
  
  // Function to determine optimal styling based on aspect ratio
  const getMediaStyle = (): React.CSSProperties => {
    // For vertical media in compact view, maintain height and center
    if (isVertical && isCompactView) {
      return {
        width: 'auto',
        height: '100%',
        maxHeight: '190px',
        margin: 'auto',
        display: 'block',
        objectFit: 'contain' as const
      };
    }
    
    // For horizontal media or expanded view, fill the space
    return {
      width: '100%',
      height: '100%',
      maxHeight: isCompactView ? '190px' : '400px',
      margin: 'auto',
      display: 'block',
      objectFit: isCompactView ? 'cover' : 'contain' as const
    };
  };
  
  // Determine if controls should be visible
  const shouldShowControls = isHovering || controlsLocked;
  
  return (
    <div 
      ref={containerRef}
      className={`flex flex-col bg-gray-900 rounded-lg overflow-hidden ${className}`}
      data-testid="scene-preview-player"
      style={{ maxWidth: isCompactView ? (isVertical ? 'min(160px, 100%)' : '100%') : '100%' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Media Display */}
      <div className="relative bg-black flex items-center justify-center">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        )}
        
        {mediaType === 'video' ? (
          <video 
            ref={videoRef}
            src={mediaUrl}
            className="w-auto h-auto object-contain"
            playsInline
            muted={isMuted}
            data-testid="video-element"
            style={getMediaStyle()}
          />
        ) : (
          <img 
            ref={imageRef}
            src={mediaUrl}
            alt="Scene content"
            className="w-auto h-auto object-contain"
            data-testid="image-element"
            style={getMediaStyle()}
          />
        )}
        
        {/* Hidden audio element */}
        {audioUrl && (
          <audio 
            ref={audioRef} 
            src={audioUrl} 
            preload="metadata"
            data-testid="audio-element"
          />
        )}
        
        {/* Play/Pause overlay */}
        <button
          onClick={isPlaying ? handlePause : handlePlay}
          className="absolute inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity"
          data-testid="play-pause-button"
        >
          {isPlaying ? (
            <PauseIcon className={`${isCompactView ? 'w-10 h-10' : 'w-16 h-16'} text-white opacity-70`} />
          ) : (
            <PlayIcon className={`${isCompactView ? 'w-10 h-10' : 'w-16 h-16'} text-white opacity-70`} />
          )}
        </button>
        
        {/* Hoverable controls - updated for better transparency and hover interaction */}
        <div 
          className={`absolute bottom-0 left-0 right-0 transition-opacity duration-300 ${shouldShowControls ? 'opacity-100' : 'opacity-0'}`}
          style={{ pointerEvents: shouldShowControls ? 'auto' : 'none' }}
          data-testid="hover-controls"
        >
          {/* Integrated timeline scrubber with trim controls - more transparent */}
          <div className="bg-black bg-opacity-30 backdrop-blur-sm px-2 py-1">
            {/* Time display and timeline */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-white opacity-90">{formatTime(currentTime)}</span>
              
              {/* Timeline container */}
              <div 
                ref={timelineRef}
                className="flex-grow relative h-4 flex items-center cursor-pointer"
                onClick={handleTimelineClick}
                data-testid="timeline-container"
              >
                {/* Timeline track */}
                <div className="absolute w-full h-0.5 bg-gray-500 bg-opacity-60 rounded-full"></div>
                
                {/* Voiceover/active region */}
                <div 
                  className="absolute h-0.5 bg-blue-400 bg-opacity-70 rounded-full"
                  style={{ 
                    left: `${(trimStart / duration) * 100}%`, 
                    width: `${((trimEnd || duration) - trimStart) / duration * 100}%` 
                  }}
                  data-testid="active-region"
                ></div>
                
                {/* Current position indicator */}
                <div
                  className="absolute w-0.5 h-2.5 bg-white rounded-full pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                  data-testid="position-indicator"
                ></div>
                
                {/* Trim handles - only visible when trim mode is active */}
                {trimActive && (
                  <>
                    {/* Start trim handle - more subtle bracket */}
                    <div 
                      className="absolute h-2.5 w-1 bg-white bg-opacity-80 rounded cursor-ew-resize"
                      style={{ 
                        left: `${(trimStart / duration) * 100}%`,
                        marginLeft: '-0.5px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                      onMouseDown={(e) => handleTrimHandleMouseDown('start', e)}
                      data-testid="trim-start-handle"
                    >
                      <div className="absolute h-2.5 w-1 border-l border-white opacity-80" style={{ left: '-2px' }}></div>
                    </div>
                    
                    {/* End trim handle - more subtle bracket */}
                    <div 
                      className="absolute h-2.5 w-1 bg-white bg-opacity-80 rounded cursor-ew-resize"
                      style={{ 
                        left: `${(trimEnd / duration) * 100}%`,
                        marginLeft: '-0.5px',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                      onMouseDown={(e) => handleTrimHandleMouseDown('end', e)}
                      data-testid="trim-end-handle"
                    >
                      <div className="absolute h-2.5 w-1 border-r border-white opacity-80" style={{ right: '-2px' }}></div>
                    </div>
                    
                    {/* Trim duration display - more subtle */}
                    <div 
                      className="absolute text-[8px] text-white py-0.5 px-1 bg-black bg-opacity-30 rounded pointer-events-none"
                      style={{ 
                        left: `${((trimStart + (trimEnd - trimStart) / 2) / duration) * 100}%`,
                        bottom: '-14px',
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {formatTime(trimEnd - trimStart)}
                    </div>
                  </>
                )}
                
                {/* Hidden range input for keyboard accessibility */}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute w-full h-full opacity-0 cursor-pointer"
                  step="0.1"
                  data-testid="hover-seek-slider"
                />
              </div>
              
              <span className="text-xs text-white opacity-90">{formatTime(duration)}</span>
            </div>
            
            {/* Controls row - more compact */}
            <div className="flex items-center justify-between">
              {/* Left controls: volume */}
              <div className="flex items-center">
                <button
                  onClick={toggleMute}
                  className="text-white opacity-80 p-0.5"
                  data-testid="hover-mute-button"
                >
                  {isMuted ? (
                    <VolumeXIcon className="w-2.5 h-2.5" />
                  ) : volume < 0.5 ? (
                    <VolumeIcon className="w-2.5 h-2.5" />
                  ) : (
                    <Volume2Icon className="w-2.5 h-2.5" />
                  )}
                </button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-10 h-0.5 rounded-full bg-gray-500 bg-opacity-60 appearance-none ml-1"
                  data-testid="hover-volume-slider"
                />
              </div>
              
              {/* Right controls: trim toggle and lock */}
              <div className="flex items-center">
                {/* Trim mode toggle */}
                <button
                  onClick={toggleTrimMode}
                  className={`text-white opacity-80 p-0.5 mx-0.5 rounded-sm ${trimActive ? 'bg-blue-500 bg-opacity-40' : ''}`}
                  data-testid="trim-mode-toggle"
                  title={trimActive ? "Exit Trim Mode" : "Trim Mode"}
                >
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 5L7 19" strokeLinecap="round" />
                    <path d="M17 5L17 19" strokeLinecap="round" />
                  </svg>
                </button>
                
                {/* Lock button */}
                <button
                  onClick={toggleControlsLock}
                  className="text-white opacity-80 p-0.5"
                  data-testid="controls-lock-toggle"
                  title={controlsLocked ? "Hide Controls" : "Lock Controls"}
                >
                  {controlsLocked ? (
                    <ChevronDownIcon className="w-2.5 h-2.5" />
                  ) : (
                    <ChevronUpIcon className="w-2.5 h-2.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenePreviewPlayer; 