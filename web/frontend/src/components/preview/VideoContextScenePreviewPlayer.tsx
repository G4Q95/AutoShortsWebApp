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
  const [isReady, setIsReady] = useState<boolean>(false);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const forceResetOnPlayRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(false);
  const animationFrameRef = useRef<number | null>(null);
  const imageTimerRef = useRef<number | null>(null);
  
  // Add these needed references
  const videoRef = useRef<HTMLVideoElement>(null);
  const justResetRef = useRef<boolean>(false);
  const isResumingRef = useRef<boolean>(false);
  
  // Add state for first frame display
  const [showFirstFrame, setShowFirstFrame] = useState<boolean>(true);
  
  // Add state for local media
  const [localMediaUrl, setLocalMediaUrl] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  
  // Add state for fallback image rendering
  const [useImageFallback, setUseImageFallback] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  // Add state for fullscreen
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  
  // Add state for showing video information
  const [showAspectRatio, setShowAspectRatio] = useState<boolean>(false);
  const [showTemporaryAspectRatio, setShowTemporaryAspectRatio] = useState<boolean>(false);

  // VideoContext references
  const mediaManager = useRef<MediaDownloadManager>(MediaDownloadManager.getInstance());
  
  // Use usePlaybackState hook for core playback state
  const {
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    visualTime, setVisualTime
  } = usePlaybackState(); 

  // NEW: Use our bridgeAdapter hook
  const videoContextBridge = useVideoContextBridge({
    videoRef,
    canvasRef,
    mediaUrl,
    localMediaUrl,
    mediaType,
    showFirstFrame,
    onIsReadyChange: (ready: boolean) => {
      console.log(`[VCSPP] Bridge reported isReady=${ready}`);
      setIsLoading(!ready);
      setIsReady(ready);
    },
    onDurationChange: (duration: number) => {
      console.log(`[VCSPP] Bridge reported duration=${duration}`);
      // Handle duration change
      if (duration && isFinite(duration)) {
        // Use trimEnd directly instead of trimValues
        setTrimEnd(Math.min(trimEnd, duration));
      }
    },
    onError: (error: Error) => {
      console.error(`[VCSPP] Bridge error:`, error);
      setIsLoading(false);
      // If this is a video error, try image fallback for video thumbnails
    if (isVideoType(mediaType)) {
        setUseImageFallback(true);
      }
    },
    onTimeUpdate: (time: number) => {
      if (!isDraggingScrubber) {
        setVisualTime(time);
      }
    }
  });
  
  // --- Rest of component state---
  // (keep the existing state variables and refs)
  
  // Get the trim controls
  const { 
    trimStart, trimEnd, activeHandle, setTrimStart, setTrimEnd, 
    setActiveHandle, userTrimEndRef 
  } = useTrimControls({
    initialTrimStart: trim.start,
    initialTrimEnd: trim.end,
    duration: videoContextBridge.duration || 0,
    onTrimChange,
    containerRef,
    videoContext: videoContextBridge.videoContext,
    audioRef,
    isPlaying,
    setCurrentTime,
    setVisualTime,
    setIsPlaying,
    forceResetOnPlayRef,
    videoRef
  });
  
  // Function to get local media URL
  const getLocalMedia = useCallback(async () => {
    if (!mediaUrl) return;
    
    try {
      setIsLoading(true);

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
  }, [mediaUrl, getLocalMedia, sceneId, localMediaUrl]); // getLocalMedia is stable due to useCallback
  
  // Handle audio separately
  useEffect(() => {
    if (audioRef.current && !isImageType(mediaType)) { 
      if (isPlaying) {
        audioRef.current.play().catch(err => console.error("[AudioDiag] Effect Play Error:", err));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioUrl, audioRef, mediaType]); // Added mediaType dependency
  
  // Handle fullscreen changes
  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);
  
  // Handle position lock toggling
  const [isPositionLocked, setIsPositionLocked] = useState<boolean>(false);
  
  // Calculate aspect ratio and get media element style
  const { calculatedAspectRatio, mediaElementStyle } = useMediaAspectRatio({
    initialMediaAspectRatio,
    projectAspectRatio,
    showLetterboxing,
    mediaType,
    // Fix for type error by making sure we only pass valid props to the hook
    // We'll define any additional properties the hook needs as separate objects
  });
  
  // Define Fullscreen Toggle Handler here (moved before usage)
  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`[FS] Error attempting to enable full-screen mode:`, err);
      });
        } else {
      document.exitFullscreen().catch(err => {
        console.error(`[FS] Error attempting to exit full-screen mode:`, err);
      });
    }
  }, [containerRef]);
  
  // == DEFINE PLAYBACK HANDLERS (needed for mediaEventHandlers) ==
  const handlePlay = useCallback(async () => {
    try {
      console.log('[VCSPP] handlePlay triggered');
      
      // Always ensure we're not showing first frame when playing
      if (showFirstFrame) {
        setShowFirstFrame(false);
        
        // Ensure video element is correctly shown
        if (videoRef.current) {
          videoRef.current.style.display = 'block';
          videoRef.current.style.visibility = 'visible';
        }
        
        // Ensure canvas is hidden
        if (canvasRef.current) {
          canvasRef.current.style.display = 'none';
        }
        
        // Add a small delay to let the DOM update before playing
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Ensure the context is aware we intend to play
      setIsPlaying(true);
      
      // Use the bridge to play
      await videoContextBridge.play();
      
    } catch (error) {
      console.error('[VCSPP] Play error:', error);
      setIsPlaying(false); // Ensure state reflects failure
    }
  }, [setIsPlaying, videoContextBridge, showFirstFrame, videoRef, canvasRef]);

  const handlePause = useCallback(async () => {
    try {
      console.log('[VCSPP] handlePause triggered');
      // Use the bridge to pause
      await videoContextBridge.pause();
      
      // Update state after successful pause
      setIsPlaying(false);
      
    } catch (error) {
      console.error('[VCSPP] Pause error:', error);
    }
  }, [setIsPlaying, videoContextBridge]);

  const toggleFirstFrame = useCallback(() => {
    const newState = !showFirstFrame;
    console.log(`[VCSPP] toggleFirstFrame to ${newState}`);
    
    // If playing, pause first
    if (isPlaying) {
      handlePause();
    }
    
    setShowFirstFrame(newState);
    
    // Update DOM elements directly for immediate effect
    if (newState) {
      // Show canvas, hide video
      if (canvasRef.current) {
        canvasRef.current.style.display = 'block';
      }
      if (videoRef.current) {
        videoRef.current.style.visibility = 'hidden';
      }
    } else {
      // Hide canvas, show video
      if (canvasRef.current) {
        canvasRef.current.style.display = 'none';
      }
      if (videoRef.current) {
        videoRef.current.style.visibility = 'visible';
        videoRef.current.style.display = 'block';
      }
    }
  }, [showFirstFrame, setShowFirstFrame, canvasRef, videoRef, isPlaying, handlePause]);
  
  const handleSeek = useCallback(async (time: number) => {
    console.log(`[VCSPP] handleSeek called with time=${time}`);
    
    try {
      // Make sure time is within trim boundaries
      const clampedTime = Math.max(trimStart, Math.min(time, trimEnd));
      
      // Update visual time immediately for better UX
      setVisualTime(clampedTime);
      
      // For images, just update the current time
      if (isImageType(mediaType)) {
        setCurrentTime(clampedTime);
        return;
      }
      
      // For videos, use the bridge
      await videoContextBridge.seek(clampedTime);
      setCurrentTime(clampedTime);
    } catch (error) {
      console.error('[VCSPP] Seek error:', error);
    }
  }, [trimStart, trimEnd, setVisualTime, mediaType, videoContextBridge, setCurrentTime]);
  
  // Get media event handlers - Ensure all handlers are defined above
  const mediaEventHandlers = useMediaEventHandlers({
    sceneId, // Pass from props
    mediaType, // Pass from props
    setIsLoading, // Pass from state
    setIsReady, // Pass new state setter
    setIsHovering, // Pass from state
    setImageLoadError, // Pass from state
    setTrimEnd, // Pass from useTrimControls hook
    handlePlay, // Pass the function defined above
    handlePause, // Pass the function defined above
    isPlaying, // Pass from usePlaybackState hook
    handleFullscreenToggle, // Pass the function defined above
  });
  
  // Handle video error
  const handleVideoError = useCallback((error: Error) => {
    console.error('[VCSPP] Video error:', error);
    // Try image fallback for video thumbnails
    setUseImageFallback(true);
    setIsLoading(false);
  }, []);
  
  // -- Animation Frame Loop --
  useAnimationFrameLoop({
    isPlaying,
    isReady,
    currentTime,
    trimStart,
    trimEnd,
    onPause: handlePause,
    onUpdate: (newTime: number) => {
      if (!isDraggingScrubber) {
    setVisualTime(newTime);
      }
    },
    isImageType: isImageType(mediaType),
    animationFrameRef,
    forceResetOnPlayRef,
    justResetRef,
    isResumingRef,
  });
  
  // == DEFINE UI CONTROL HANDLERS ==
  const handlePlayPauseToggle = useCallback(() => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);
  
  const handleLockToggle = useCallback(() => {
    setIsPositionLocked(prev => !prev);
  }, [setIsPositionLocked]); // Added dependency

  const handleInfoToggle = useCallback(() => {
    setShowAspectRatio(prev => !prev);
  }, [setShowAspectRatio]);
  
  const handleTrimToggle = useCallback(() => {
    setTrimActive(prev => !prev);
    // When activating trim, pause playback and store current time
    if (!trimActive) {
      setOriginalPlaybackTime(currentTime);
      handlePause();
    } else {
      // When deactivating trim, potentially resume playback? Or just reset?
    }
  }, [setTrimActive, currentTime, handlePause]);
  
  // Helper functions for position calculations (keep these as is)
  const positionToPercent = (position: number): number => {
    const duration = videoContextBridge.duration || 0;
    return duration ? (position / duration) * 100 : 0;
  };

  const percentValueToPosition = (percentValue: string | number): number => {
    const percent = typeof percentValue === 'string' ? parseFloat(percentValue) : percentValue;
    const duration = videoContextBridge.duration || 0;
    return (percent / 100) * duration;
  };
  
  // Get media container style (RESTORED - assumes useMediaAspectRatio provides calculatedAspectRatio)
  const getMediaContainerStyle = useCallback(() => {
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
    const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
    const projectRatio = projWidth / projHeight;
    const mediaRatio = calculatedAspectRatio || projectRatio;
    const style: CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      backgroundColor: '#000',
      overflow: 'hidden',
    };
    if (isCompactView) {
      style.height = '100%';
      style.width = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
      style.margin = 'auto'; 
    } else {
      style.width = '100%';
      style.height = 'auto';
      style.aspectRatio = projectAspectRatio.replace(':', '/');
    }
    return style;
  }, [calculatedAspectRatio, projectAspectRatio, showLetterboxing, isCompactView]);
  
  // Additional state for error boundary resets
  const [errorBoundaryResetKey, setErrorBoundaryResetKey] = useState<number>(0);
  
  // Reset error boundary when URL changes
  useEffect(() => {
    setErrorBoundaryResetKey(prev => prev + 1);
  }, [mediaUrl, localMediaUrl]);
  
  // Update isPlayingRef
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);
  
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
        initialMediaAspectRatio={initialMediaAspectRatio}
        calculatedAspectRatio={calculatedAspectRatio}
        projectAspectRatio={projectAspectRatio}
        showLetterboxing={showLetterboxing}
        onAspectRatioInfoClose={() => {
          setShowAspectRatio(false);
          setShowTemporaryAspectRatio(false);
        }}
        
        // Player Controls props
        duration={videoContextBridge.duration || 0}
        trimStart={trimStart}
        trimEnd={trimEnd}
        isPlaying={isPlaying}
          onPlayPauseToggle={handlePlayPauseToggle}
          onLockToggle={handleLockToggle}
        onInfoToggle={handleInfoToggle}
        onTrimToggle={handleTrimToggle}
        onFullscreenToggle={handleFullscreenToggle}
        onSeek={handleSeek}
        
        // DragState
        onDragScrubberStart={() => setIsDraggingScrubber(true)}
        onDragScrubberEnd={() => setIsDraggingScrubber(false)}
      />
    </MediaErrorBoundary>
  );
};

export default VideoContextScenePreviewPlayer;  