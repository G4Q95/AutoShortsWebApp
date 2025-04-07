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
  const [showTemporaryAspectRatio, setShowTemporaryAspectRatio] = useState<boolean>(false);

  // Add state for position locking
  const [isPositionLocked, setIsPositionLocked] = useState<boolean>(false);

  // --- Playback State ---
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

  // Initialize the bridge hook *before* callbacks that use it
  const bridge = useVideoContextBridge({
    videoContextInstance: videoContext,
    canvasRef,
    localMediaUrl,
    mediaType,
    initialMediaAspectRatio,
    // Pass placeholder callbacks for now
    onReady: () => {},
    onError: () => {},
    onDurationChange: () => {},
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
      if (bridge.videoContext) { // *** USE BRIDGE CONTEXT ***
         try { bridge.videoContext.currentTime = startTime; } 
         catch (e) { console.warn("[handlePlay Reset] Error setting video context time:", e); }
      }
      // Reset the flag after handling
      forceResetOnPlayRef.current = false; 
    }
    
    // --- Playback Logic --- 
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
    if (!bridge.videoContext) { // *** USE BRIDGE CONTEXT ***
      console.error(`[handlePlay Video] Cannot play - videoContext is null`);
      return;
    }
    if (!isReady) {
      console.error(`[handlePlay Video] Cannot play - videoContext not ready yet`);
      return;
    }
    
    // Sync video context time if needed (using currentTime from state)
    if (Math.abs(bridge.videoContext.currentTime - currentTime) > 0.1) { // *** USE BRIDGE CONTEXT ***
        try { bridge.videoContext.currentTime = currentTime; } 
        catch (e) { console.warn("[handlePlay Video] Error syncing video context time:", e); }
    }
    
    // Play video context using the bridge
    bridge.play(); // *** USE BRIDGE PLAY ***
    setIsPlayingWithLog(true); // Use wrapper (starts rAF loop)
      
    // Play separate audio if present, syncing to video context
    if (audioRef.current && audioUrl) {
        try {
          // Ensure bridge.videoContext is not null before accessing currentTime
          if (bridge.videoContext) {
            audioRef.current.currentTime = bridge.videoContext.currentTime; // *** USE BRIDGE CONTEXT ***
            audioRef.current.play().catch(err => console.error(`[handlePlay Video] Error playing audio:`, err));
          }
        } catch (e) {
          console.warn("[handlePlay Video] Error setting/playing audio time:", e);
        }
    }

  }, [
      // Dependencies:
      bridge, isReady, // Use bridge instead of videoContext
      currentTime, trimStart, // Read state from playback/trim hooks
      audioUrl, audioRef, // Props and Refs
      setCurrentTime, setVisualTime, // Setters from playback hook
      setIsPlayingWithLog, // Callback wrapper
      forceResetOnPlayRef, mediaType // Ref and Prop
  ]);
  
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
    
    // Use original videoContext for now, will be moved later
    const currentVideoContext = videoContext; 
    if (!currentVideoContext) return;
    
    const clampedTime = Math.min(Math.max(newTime, trimStart), trimEnd); // Read trim state
    
    // Update video context (attempt)
    try {
       currentVideoContext.currentTime = clampedTime;
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
    videoContext, // Keep original dependency for now
    trimStart, trimEnd, // Read state from trim hook
    setCurrentTime, setVisualTime, // *** ADDED setVisualTime to dependencies ***
    setIsPlayingWithLog, // Other callbacks
    audioRef, mediaType, imageTimerRef, forceResetOnPlayRef
  ]);
  
  // SAFE ADDITION: Add the animation frame hook with required callbacks (just testing)
  // This won't replace the existing animation loop yet, just runs in parallel
  useAnimationFrameLoop({
    isPlaying,
    isReady,
    currentTime,
    trimStart,
    trimEnd,
    onUpdate: (newTime) => {
      // Update both currentTime and visualTime 
      setCurrentTime(newTime);
      
      // Only update visual time if not dragging scrubber
      if (!isDraggingScrubber) {
        setVisualTime(newTime);
      }
    },
    onPause: handlePause,
    isImageType: isImageType(mediaType),
    animationFrameRef,
    forceResetOnPlayRef,
    // Additional needed properties
    videoContext,
    audioRef,
    isDraggingScrubber,
    userTrimEndRef,
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
  
  // Scrubbing/Time update logic
  const handleScrubberDragStart = useCallback(() => {
    // ... existing logic ...
  }, [isPlaying, isDraggingScrubber, visualTime, handlePause, setIsDraggingScrubber, setOriginalPlaybackTime]);

  const handleScrubberDragEnd = useCallback(() => {
    // ... existing logic ...
  }, [
    isDraggingScrubber, visualTime, 
    setCurrentTime, // Playback hook state
    bridge.videoContext, // *** USE CONTEXT FROM BRIDGE ***
    audioRef, forceResetOnPlayRef, setIsDraggingScrubber 
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
          visualTime={visualTime}
          duration={duration}
          trimStart={trimStart}
          effectiveTrimEnd={getEffectiveTrimEnd()}
          activeHandle={activeHandle}
          trimActive={trimActive}
          isDraggingScrubber={isDraggingScrubber}
          onTimeUpdate={handleTimeUpdate}
          onScrubberDragStart={handleScrubberDragStart}
          onScrubberDragEnd={handleScrubberDragEnd}
          setActiveHandle={setActiveHandle}
          setTimeBeforeDrag={setTimeBeforeDrag}
          setOriginalPlaybackTime={setOriginalPlaybackTime}
          videoContext={videoContext}
          getEffectiveTrimEnd={getEffectiveTrimEnd}
          // Time Display
          currentTime={currentTime}
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