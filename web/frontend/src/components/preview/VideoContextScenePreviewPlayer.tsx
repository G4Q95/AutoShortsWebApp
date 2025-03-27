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
    
    console.log(`[VideoContext] Initialize effect triggered, projectAspectRatio=${projectAspectRatio}`);
    
    // For static images, ONLY use the fallback image approach and skip VideoContext entirely
    if (isImageType(mediaType)) {
      console.log(`[VideoContext] Static media detected (${mediaType}), using ONLY fallback for ${sceneId}`);
      setUseImageFallback(true);
      setIsLoading(false);
      
      // For images with audio, setup duration now
      if (audioRef.current && audioRef.current.duration) {
        setDuration(audioRef.current.duration);
        setTrimEnd(audioRef.current.duration);
      } else {
        // Default duration for images without audio
        setDuration(30);
        setTrimEnd(30);
      }
      
      // Set is ready to true so controls work properly
      setIsReady(true);
      
      return; // Skip VideoContext initialization completely for images
    }
    
    const canvas = canvasRef.current;
    
    // Set the high-quality base size for creating the canvas
    const baseSize = 1920;
    let canvasWidth, canvasHeight;
    
    const initVideoContext = async () => {
      try {
        // Clean up existing context if any
        if (videoContext) {
          console.log(`[VideoContext] Cleaning up existing context for ${sceneId}`);
          try {
            videoContext.reset();
            // Check if dispose is a function before calling it
            if (typeof videoContext.dispose === 'function') {
              videoContext.dispose();
            } else {
              console.warn(`[VideoContext] dispose is not a function on existing context, skipping disposal`);
            }
          } catch (cleanupError) {
            console.error(`[VideoContext] Error during context cleanup:`, cleanupError);
          }
          setVideoContext(null);
        }
        
        // Dynamically import VideoContext
        const VideoContextModule = await import('videocontext');
        const VideoContext = VideoContextModule.default || VideoContextModule;
        
        console.log(`[VideoContext] Initializing for scene ${sceneId} with media type ${mediaType}`);
        
        if (initialMediaAspectRatio) {
          console.log(`[VideoContext] Using provided media aspect ratio: ${initialMediaAspectRatio}`);
          
          // Use media's original aspect ratio if provided
          if (initialMediaAspectRatio >= 1) {
            // Landscape or square
            canvasWidth = baseSize;
            canvasHeight = Math.round(baseSize / initialMediaAspectRatio);
            console.log(`[VideoContext] Landscape media (${initialMediaAspectRatio.toFixed(2)}) - Setting canvas to ${canvasWidth}x${canvasHeight}`);
          } else {
            // Portrait
            canvasHeight = baseSize;
            canvasWidth = Math.round(baseSize * initialMediaAspectRatio);
            console.log(`[VideoContext] Portrait media (${initialMediaAspectRatio.toFixed(2)}) - Setting canvas to ${canvasWidth}x${canvasHeight}`);
          }
        } else {
          console.log(`[VideoContext] No media aspect ratio provided, using default 16:9`);
          // Default to 16:9 if no media aspect ratio is provided
          canvasWidth = 1920;
          canvasHeight = 1080;
          console.log(`[VideoContext] Default canvas size: ${canvasWidth}x${canvasHeight}`);
        }
        
        // Set canvas dimensions
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        console.log(`[VideoContext] Canvas resized to ${canvas.width}x${canvas.height}`);
        
        // Create VideoContext instance after setting canvas dimensions
        let ctx = new VideoContext(canvas);
        console.log(`[VideoContext] VideoContext instance created for ${sceneId}:`, 
                    { hasReset: typeof ctx.reset === 'function', 
                      hasDispose: typeof ctx.dispose === 'function' });
        setVideoContext(ctx);
        
        // Create source node (using local media URL)
        let source: any; // Explicitly type as any since we're accessing non-standard properties
        console.log(`[VideoContext] Creating source node for ${mediaType} media: ${localMediaUrl.substring(0, 50)}...`);

        if (mediaType === 'video') {
          // Create the source
          source = ctx.video(localMediaUrl);
          console.log(`[VideoContext] Video source node created:`, source);
          
          // Check for positioning and scaling properties on source node
          console.log(`[VideoContext] Source node initial properties:`, {
            position: (source as any).position,
            scale: (source as any).scale,
            sourceWidth: (source.element as HTMLVideoElement)?.videoWidth,
            sourceHeight: (source.element as HTMLVideoElement)?.videoHeight
          });
          
          // When source element is created, store aspect ratio info
          if (source.element) {
            console.log(`[VideoContext] Video element attached to source node:`, source.element);
            
            source.element.addEventListener('loadedmetadata', () => {
              // Get dimensions from the actual source
              const videoWidth = source.element.videoWidth;
              const videoHeight = source.element.videoHeight;
              const ratio = videoWidth / videoHeight;
              
              // Log source node position and scale
              const sourceScale = source.scale || 1;
              const sourcePosition = source.position || [0, 0];
              
              console.log(`[VideoContext] Video source loaded with dimensions: ${videoWidth}x${videoHeight}, ratio: ${ratio.toFixed(2)}`);
              console.log(`[VideoContext] Source node scale: ${sourceScale}, position: [${sourcePosition}]`);
              console.log(`[VideoContext] Canvas vs Media ratio check:`, {
                canvasWidth: canvas.width,
                canvasHeight: canvas.height,
                canvasRatio: canvas.width / canvas.height,
                mediaWidth: videoWidth,
                mediaHeight: videoHeight,
                mediaRatio: ratio,
                difference: (canvas.width / canvas.height) - ratio
              });
              
              // If there's a mismatch, log a warning
              if (Math.abs((canvas.width / canvas.height) - ratio) > 0.01) {
                console.warn(`[VideoContext] ⚠️ ASPECT RATIO MISMATCH: Canvas (${(canvas.width / canvas.height).toFixed(2)}) doesn't match video (${ratio.toFixed(2)})`);
              }
              
              // Save aspect ratio for use in other parts of the component
              setAspectRatio(ratio);
              
              // Determine if video is square (within a small margin of error)
              const isSquareVideo = ratio >= 0.9 && ratio <= 1.1;
              setIsSquare(isSquareVideo);
              setIsVertical(ratio < 0.9);
            });
          }
        } else if (mediaType === 'image') {
          // Add a unique instance ID for tracking this specific component instance
          const instanceId = `${sceneId}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Increment attempt counter
          DEBUG_COUNTERS.totalImageAttempts++;
          console.log(`[DEBUG][${instanceId}] Initializing image handler for scene ${sceneId} with URL: ${localMediaUrl.substring(0, 30)}...`);
          
          // Reset fallback flags when re-initializing
          setUseImageFallback(false);
          setImageLoadError(false);
          
          // For images, immediately set up the fallback as a precaution
          const preloadImage = new Image();
          preloadImage.src = localMediaUrl;
          
          console.log(`[DEBUG][${instanceId}] Preloading image for fallback`);
          
          // For images, create a checking mechanism before using VideoContext
          const testImage = new Image();
          testImage.onload = () => {
            // Create image source after confirming the image loads
            try {
              console.log(`[DEBUG][${instanceId}] Test image loaded successfully, dimensions: ${testImage.width}x${testImage.height}`);
              console.log(`[DEBUG][${instanceId}] Creating VideoContext image source node`);
              
              source = ctx.image(localMediaUrl);
              
              // Log detailed information about the source node
              console.log(`[DEBUG][${instanceId}] Image source created:`, {
                source: !!source,
                hasStart: typeof source?.start === 'function',
                hasConnect: typeof source?.connect === 'function',
                element: source?.element ? 'exists' : 'missing',
                state: source?._state || 'unknown'
              });
              
              // Additional safeguards for image source creation
              if (!source || typeof source.start !== 'function') {
                console.error(`[DEBUG][${instanceId}] Invalid image source created, switching to fallback`);
                setUseImageFallback(true);
                return;
              }
              
              // Canvas state before source setup
              console.log(`[DEBUG][${instanceId}] Canvas state before source setup:`, {
                width: canvas.width,
                height: canvas.height,
                context2d: !!canvas.getContext('2d'),
                webgl: !!canvas.getContext('webgl')
              });
              
              // Set up error checking timeouts - check multiple times with increasing delays
              [100, 300, 800].forEach(delay => {
                setTimeout(() => {
                  // Check if component is still mounted
                  if (!canvas || !canvasRef.current) {
                    console.log(`[DEBUG][${instanceId}] Component unmounted before ${delay}ms check`);
                    return;
                  }
                  
                  // Check if any pixels were drawn to the canvas
                  try {
                    const ctx2d = canvas.getContext('2d');
                    const pixelData = ctx2d?.getImageData(0, 0, canvas.width, canvas.height).data;
                    
                    if (!pixelData) {
                      console.warn(`[DEBUG][${instanceId}] ${delay}ms check: Couldn't get pixel data`);
                      return;
                    }
                    
                    // Count non-zero pixels to see if canvas has content
                    let nonZeroPixels = 0;
                    for (let i = 0; i < pixelData.length; i += 40) { // Check every 10th pixel for performance
                      if (pixelData[i] !== 0 || pixelData[i+1] !== 0 || pixelData[i+2] !== 0 || pixelData[i+3] !== 0) {
                        nonZeroPixels++;
                      }
                    }
                    
                    const pixelSampleSize = Math.floor(pixelData.length / 40);
                    const percentNonZero = (nonZeroPixels / pixelSampleSize) * 100;
                    
                    console.log(`[DEBUG][${instanceId}] ${delay}ms check: Canvas content analysis:`, {
                      sampledPixels: pixelSampleSize,
                      nonZeroPixels,
                      percentNonZero: percentNonZero.toFixed(2) + '%'
                    });
                    
                    // If less than 1% of pixels have content, consider it empty
                    if (percentNonZero < 1) {
                      console.warn(`[DEBUG][${instanceId}] ${delay}ms check: Canvas appears empty (${percentNonZero.toFixed(2)}% non-zero), switching to fallback`);
                      if (delay === 800) { // Only count failures on the final check
                        DEBUG_COUNTERS.videoContextFailure++;
                      }
                      setUseImageFallback(true);
                    } else {
                      console.log(`[DEBUG][${instanceId}] ${delay}ms check: Canvas has content (${percentNonZero.toFixed(2)}% non-zero)`);
                      if (delay === 800) { // Only count success on the final check
                        DEBUG_COUNTERS.videoContextSuccess++;
                        console.log(`[DEBUG-COUNTERS] Updated stats:`, {
                          totalAttempts: DEBUG_COUNTERS.totalImageAttempts,
                          vcSuccess: DEBUG_COUNTERS.videoContextSuccess,
                          vcFailure: DEBUG_COUNTERS.videoContextFailure,
                          fbSuccess: DEBUG_COUNTERS.fallbackSuccess,
                          fbFailure: DEBUG_COUNTERS.fallbackFailure,
                          successRate: `${((DEBUG_COUNTERS.videoContextSuccess + DEBUG_COUNTERS.fallbackSuccess) / 
                            DEBUG_COUNTERS.totalImageAttempts * 100).toFixed(1)}%`
                        });
                      }
                    }
                  } catch (pixelCheckError) {
                    console.error(`[DEBUG][${instanceId}] ${delay}ms check: Error analyzing canvas:`, pixelCheckError);
                    setUseImageFallback(true);
                  }
                }, delay);
              });
              
              // For images, we need to manually get the dimensions
              const imageWidth = testImage.width;
              const imageHeight = testImage.height;
              const ratio = imageWidth / imageHeight;
              
              // Save aspect ratio for use in other parts of the component
              setAspectRatio(ratio);
              
              // Determine if image is square (within a small margin of error)
              const isSquareImage = ratio >= 0.9 && ratio <= 1.1;
              setIsSquare(isSquareImage);
              setIsVertical(ratio < 0.9);
              
              // Source setup for image - with error handling
              try {
                console.log(`[DEBUG][${instanceId}] Setting up source: start(0) and connect`);
                source.start(0);
                source.connect(ctx.destination);
                console.log(`[DEBUG][${instanceId}] Source connected to destination successfully`);
              } catch (sourceConnectError) {
                console.error(`[DEBUG][${instanceId}] Failed to connect image source:`, sourceConnectError);
                setUseImageFallback(true);
                return;
              }
              
              // Set default duration for images
              console.log(`[DEBUG][${instanceId}] Setting default duration for image`);
              setDuration(30);
              setTrimEnd(30);
              
              // Initialize userTrimEnd if not already set
              if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
                userTrimEndRef.current = 30;
              }
              
              // Mark as ready after a brief delay to ensure rendering
              setTimeout(() => {
                console.log(`[DEBUG][${instanceId}] Setting component to ready state`);
                setIsLoading(false);
                setIsReady(true);
              }, 200);
              
            } catch (imageSourceError) {
              console.error(`[DEBUG][${instanceId}] Error creating image source:`, imageSourceError);
              setUseImageFallback(true);
              setImageLoadError(false); // Don't set this to true yet, let the fallback try
            }
          };
          
          testImage.onerror = (err) => {
            console.error(`[DEBUG][${instanceId}] Failed to load test image:`, err);
            setUseImageFallback(true);
            setImageLoadError(false); // Let the fallback <img> try first
          };
          
          // Set a timeout to ensure we don't wait forever
          const timeoutId = setTimeout(() => {
            console.warn(`[DEBUG][${instanceId}] Image load timeout, switching to fallback`);
            setUseImageFallback(true);
          }, 3000);
          
          console.log(`[DEBUG][${instanceId}] Starting image load: ${localMediaUrl.substring(0, 30)}...`);
          testImage.src = localMediaUrl;
          
          // Cleanup function for the timeout
          return () => {
            console.log(`[DEBUG][${instanceId}] Cleanup called for image loading timeouts`);
            clearTimeout(timeoutId);
          };
        } else {
          // Unsupported media type
          throw new Error(`Unsupported media type: ${mediaType}`);
        }
        
        // Only add callbacks for videos - image callbacks are handled separately
        if (mediaType === 'video') {
          // Set up source timing and connect to output
          source.start(0);
          source.connect(ctx.destination);
          console.log(`[VideoContext] Source connected to destination`);
          
          // Handle video loading
          source.registerCallback('loaded', () => {
            console.log(`[VideoContext] Source node 'loaded' callback fired`);
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
                isFinite: isFinite(videoElement.duration),
                canvasWidth: canvas.width,
                canvasHeight: canvas.height
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
              
              // Set aspect ratio from video dimensions (don't change canvas dimensions here)
              const videoWidth = videoElement.videoWidth;
              const videoHeight = videoElement.videoHeight;
              const ratio = videoWidth / videoHeight;
              setAspectRatio(ratio);
              
              // Determine if video is square (within a small margin of error)
              const isSquareVideo = ratio >= 0.9 && ratio <= 1.1;
              setIsSquare(isSquareVideo);
              setIsVertical(ratio < 0.9); // Only truly vertical if ratio is less than 0.9
              
              // Log canvas dimensions to verify
              console.log(`[VideoContext] Current canvas dimensions: ${canvas.width}x${canvas.height} for ratio ${ratio.toFixed(2)}`);
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
              setDuration(30);
              
              // Always ensure trimEnd is set to the full duration initially
              setTrimEnd(30);
              
              // Initialize userTrimEnd if not already set
              if (userTrimEndRef.current === null || userTrimEndRef.current <= 0) {
                userTrimEndRef.current = 30;
                console.log("[VideoContext] Setting initial userTrimEnd to", 30);
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
        }
        
        return {
          context: ctx,
          source
        };
      } catch (error) {
        console.error('Error initializing VideoContext:', error);
        setIsLoading(false);
        
        // Fall back to regular image element for images
        if (isImageType(mediaType)) {
          console.log(`[VideoContext] Activating image fallback due to initialization error`);
          setUseImageFallback(true);
        }
        
        return null;
      }
    };
    
    const setup = initVideoContext();
    
    // Clean up
    return () => {
      console.log(`[VideoContext] Cleanup function called for scene ${sceneId}`);
      setup.then(result => {
        // Check if result exists and is an object with a context property
        if (result && typeof result === 'object' && 'context' in result && result.context) {
          console.log(`[VideoContext] Cleaning up context in effect cleanup`, {
            hasContext: !!result.context,
            hasReset: typeof result.context.reset === 'function',
            hasDispose: typeof result.context.dispose === 'function'
          });
          
          try {
            // Always check if methods exist before calling
            if (typeof result.context.reset === 'function') {
              result.context.reset();
            }
            
            if (typeof result.context.dispose === 'function') {
              result.context.dispose();
            } else {
              console.warn(`[VideoContext] dispose is not a function on context during cleanup`);
            }
          } catch (cleanupError) {
            console.error(`[VideoContext] Error during effect cleanup:`, cleanupError);
          }
        } else {
          console.log(`[VideoContext] No context to clean up for scene ${sceneId}`);
        }
      }).catch(error => {
        console.error(`[VideoContext] Error in cleanup Promise:`, error);
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
    // For images without VideoContext, update state and start animation
    if (isImageType(mediaType)) {
      console.log(`[DEBUG-TIMER] Play requested for image: isPlaying=${isPlaying}, currentTime=${currentTime.toFixed(2)}`);
      
      // Set playing state
      setIsPlayingWithLog(true);
      
      // Play the audio if available
      if (audioRef.current && audioUrl) {
        audioRef.current.currentTime = currentTime;
        audioRef.current.play().catch(err => console.error("Error playing audio:", err));
      }
      
      // If we're at the end already, loop back to start
      if (currentTime >= getEffectiveTrimEnd() - 0.1) {
        console.log(`[DEBUG-TIMER] At end of timeline, resetting to start`);
        setCurrentTime(trimStart);
        if (audioRef.current) {
          audioRef.current.currentTime = trimStart;
        }
      }
      
      // Clear any existing timer
      if (imageTimerRef.current !== null) {
        window.clearInterval(imageTimerRef.current);
        imageTimerRef.current = null;
      }
      
      // Start a new interval timer - update 10 times per second
      const startTime = currentTime;
      const startRealTime = Date.now();
      
      console.log(`[DEBUG-TIMER] Starting interval timer for image playback`);
      imageTimerRef.current = window.setInterval(() => {
        if (!isPlayingRef.current) {
          console.log(`[DEBUG-TIMER] Not playing anymore, clearing timer`);
          if (imageTimerRef.current !== null) {
            window.clearInterval(imageTimerRef.current);
            imageTimerRef.current = null;
          }
          return;
        }
        
        // Calculate elapsed time
        const elapsedSeconds = (Date.now() - startRealTime) / 1000;
        const newTime = Math.min(startTime + elapsedSeconds, getEffectiveTrimEnd());
        
        console.log(`[DEBUG-TIMER] Timer tick: elapsed=${elapsedSeconds.toFixed(2)}s, newTime=${newTime.toFixed(2)}s`);
        
        // Update time
        setCurrentTime(newTime);
        
        // Update audio position
        if (audioRef.current) {
          audioRef.current.currentTime = newTime;
        }
        
        // Check if we've reached the end
        if (newTime >= getEffectiveTrimEnd() - 0.05) {
          console.log(`[DEBUG-TIMER] Reached end of timeline, stopping`);
          setIsPlayingWithLog(false);
          setCurrentTime(trimStart);
          
          // Reset audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = trimStart;
          }
          
          // Clear timer
          if (imageTimerRef.current !== null) {
            window.clearInterval(imageTimerRef.current);
            imageTimerRef.current = null;
          }
        }
      }, 100); // 100ms interval = 10 updates per second
      
      return;
    }
    
    // For videos with VideoContext
    if (!videoContext || !isReady) return;
    
    // When playing, switch from first frame to canvas
    setShowFirstFrame(false);
    
    // If current time is outside trim bounds, reset to trim start
    if (currentTime < trimStart || currentTime >= trimEnd) {
      videoContext.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
    
    videoContext.play();
    setIsPlaying(true);
    
    // Play the audio in sync
    if (audioRef.current && audioUrl) {
      audioRef.current.currentTime = videoContext.currentTime;
      audioRef.current.play().catch(err => console.error("Error playing audio:", err));
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
    
    // For videos with VideoContext
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
      className={`relative bg-gray-800 flex items-center justify-center ${className}`}
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
    >
      {/* Black inner container for letterboxing/pillarboxing */}
      <div 
        className="bg-black flex items-center justify-center w-full h-full relative"
        style={getMediaContainerStyle()}
      >
        {/* Add aspect ratio indicator for debugging */}
        {(showAspectRatio || showTemporaryIndicator) && (
          <div 
            className="absolute left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 px-1 py-0.5 text-white rounded"
            style={{ 
              zIndex: 60, 
              pointerEvents: 'none', 
              top: '0px',
              fontSize: '0.65rem',
              opacity: showTemporaryIndicator ? '0.8' : '1'
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
                  <span style={{ color: '#fff' }}> [{closestRatio[0]}]</span>
                  <span style={{ color: '#4ade80' }}> / {projectAspectRatio}</span>
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
          
          {/* Play/Pause overlay */}
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent click from bubbling up to scene
              isPlaying ? handlePause() : handlePlay();
              console.log(`[VideoContext] Play/Pause button clicked: isPlaying=${isPlaying} -> ${!isPlaying}`);
            }}
            className="absolute inset-0 w-full h-full flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-20 transition-opacity"
            style={{ 
              zIndex: 20, // Lower than controls but higher than media
              pointerEvents: 'auto' // Explicitly enable pointer events
            }}
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