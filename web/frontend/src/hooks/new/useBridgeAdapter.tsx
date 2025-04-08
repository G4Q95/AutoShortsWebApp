import { useEffect, useRef, MutableRefObject, useState, useCallback, RefObject } from 'react';
import { VideoContext } from '@/contexts/VideoContext';

export interface UseBridgeAdapterProps {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  canvasRef?: MutableRefObject<HTMLCanvasElement | null>;
  mediaUrl?: string;
  showFirstFrame?: boolean;
  onError?: (error: Error) => void;
}

interface UseBridgeAdapterReturn {
  isPlaying: boolean;
  isReady: boolean;
  duration: number;
  currentTime: number;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => Promise<void>;
  toggleFirstFrame: () => void;
  errorMessage: string | null;
}

interface BridgeAdapterOptions {
  initialShowFirstFrame?: boolean;
  onError?: (error: Error) => void;
}

export function useBridgeAdapter(
  videoRef: RefObject<HTMLVideoElement>,
  canvasRef: RefObject<HTMLCanvasElement>,
  options: BridgeAdapterOptions = {}
): UseBridgeAdapterReturn {
  const { initialShowFirstFrame = false, onError } = options;
  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showFirstFrame, setShowFirstFrame] = useState(initialShowFirstFrame);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const log = useCallback((...args: any[]) => {
    console.log('[BridgeAdapter]', ...args);
  }, []);

  const timeUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const errorLog = useCallback((...args: any[]) => {
    console.error('[useBridgeAdapter ERROR]', ...args);
  }, []);

  const triggerError = useCallback((message: string, originalError?: any) => {
    errorLog(message, originalError);
    setErrorMessage(message);
    setIsReady(false);
    const errorToSend = originalError instanceof Error ? originalError : new Error(message);
    onError?.(errorToSend);
  }, [errorLog, onError]);

  const bridgeRef = useRef<VideoContext | null>(null);

  useEffect(() => {
    // Initialize bridge if not already created
    if (!bridgeRef.current && videoRef.current) {
      try {
        const bridge = new VideoContext(true); // Debug mode on
        bridge.setVideo(videoRef.current);
        
        if (canvasRef?.current) {
          bridge.setCanvas(canvasRef.current);
        }
        
        bridgeRef.current = bridge;
        console.log('Bridge adapter initialized');
      } catch (error) {
        console.error('Failed to initialize bridge:', error);
        if (onError && error instanceof Error) {
          onError(error);
        }
      }
    }
    
    // Cleanup function
    return () => {
      if (bridgeRef.current) {
        console.log('Destroying bridge adapter');
        // Any cleanup needed for the bridge
        bridgeRef.current = null;
      }
    };
  }, [videoRef, canvasRef, onError]);

  // Setup video element and event listeners
  useEffect(() => {
    log('Setting up video element...');
    const videoElement = videoRef.current;
    const canvasElement = canvasRef?.current;

    if (!videoElement) {
      triggerError('Video element ref not available on mount.');
      return;
    }

    // Cleanup function
    const cleanup = () => {
      log('Cleaning up video listeners');
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
      if (videoElement) {
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.removeEventListener('loadeddata', handleLoadedData);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        videoElement.removeEventListener('durationchange', handleDurationChange);
        // Reset src to prevent memory leaks
        videoElement.src = '';
        videoElement.removeAttribute('src');
        videoElement.load();
      }
    };

    const handleLoadedMetadata = () => {
      log('Video metadata loaded');
      setDuration(videoElement.duration || 0);
      // Sometimes canplay doesn't fire after metadata, check readyState
      if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          handleCanPlay();
      }
      // Attempt to draw frame if needed
      if (showFirstFrame && canvasElement) {
          drawFrameToCanvas();
      }
    };
    
    const handleLoadedData = () => {
        log('Video data loaded');
        // Additional check for readiness
        if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA
            handleCanPlay();
        }
    };

    const handleCanPlay = () => {
      if (!isReady) { // Only trigger updates if state changes
        log('Video can play (readyState >= 2)');
        setIsReady(true);
        setIsPlaying(true);
      }
    };

    const handleError = (e: Event) => {
      const errorDetails = videoElement.error
        ? `${videoElement.error.code}: ${videoElement.error.message || 'Unknown video error'}`
        : 'Unknown video error event';
      triggerError(`Video loading failed: ${errorDetails}`, e);
      setIsReady(false);
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
        timeUpdateIntervalRef.current = null;
      }
    };
    
    const handleDurationChange = () => {
        const newDuration = videoElement.duration || 0;
        log('Duration changed:', newDuration);
        setDuration(newDuration);
    };

    // --- Initialization ---
    cleanup(); // Clean up any previous listeners first
    setIsReady(false);
    setIsPlaying(false);

    // Configure video element
    videoElement.crossOrigin = 'anonymous';
    videoElement.preload = 'auto';
    videoElement.playsInline = true;
    videoElement.muted = true; // Often required for autoplay / initial play

    // Add listeners
    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoElement.addEventListener('loadeddata', handleLoadedData);
    videoElement.addEventListener('canplay', handleCanPlay);
    videoElement.addEventListener('error', handleError);
    videoElement.addEventListener('durationchange', handleDurationChange);


    // Set source and load
    const sourceUrl = '';
    log('Setting video source to:', sourceUrl);
    videoElement.src = sourceUrl;
    videoElement.load(); // Explicitly call load

    return cleanup; // Return cleanup function

  }, [
      videoRef, canvasRef, showFirstFrame, // dependencies
      isReady, // Include isReady to re-evaluate canplay if needed
      triggerError, log, onError // Stable callbacks
  ]);

  // Effect to handle drawing the first frame / visibility toggle
  useEffect(() => {
    log('Visibility effect: showFirstFrame =', showFirstFrame);
    const videoElement = videoRef.current;
    const canvasElement = canvasRef?.current;

    if (!videoElement || !canvasElement) return;

    if (showFirstFrame) {
      // Draw frame and show canvas, hide video
      const drawn = drawFrameToCanvas();
      if (drawn) {
        canvasElement.style.display = 'block';
        videoElement.style.display = 'none';
        log('Show canvas, hide video');
      } else {
         log('Failed to draw frame, ensuring video is visible as fallback');
         canvasElement.style.display = 'none';
         videoElement.style.display = 'block';
      }
    } else {
      // Show video, hide canvas
      canvasElement.style.display = 'none';
      videoElement.style.display = 'block';
      log('Show video, hide canvas');
    }
  }, [showFirstFrame, videoRef, canvasRef, isReady, log]); // Re-run if isReady changes, as drawing needs ready state

  // Helper to draw frame
  const drawFrameToCanvas = useCallback((): boolean => {
    if (!videoRef.current || !canvasRef?.current) {
      return false;
    }

    const context = canvasRef.current.getContext('2d');
    if (!context) {
      return false;
    }

    try {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
      return true;
    } catch (err) {
      log('Error drawing frame to canvas:', err);
      return false;
    }
  }, [videoRef, canvasRef, log]);

  // Canvas sync functions
  const syncCanvasSize = useCallback(() => {
    if (videoRef.current && canvasRef?.current) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      log(`Canvas size synced to ${canvasRef.current.width}x${canvasRef.current.height}`);
    }
  }, [videoRef]);

  // Update canvas size when video dimensions change
  const handleResize = useCallback(() => {
    if (videoRef.current && canvasRef?.current) {
      syncCanvasSize();
    }
  }, [videoRef]);

  // Handle showing first frame (thumbnail)
  useEffect(() => {
    if (
      videoRef.current &&
      canvasRef?.current &&
      videoRef.current.readyState >= 2 &&
      showFirstFrame
    ) {
      log('Drawing first frame to canvas...');
      drawFrameToCanvas();
    }
  }, [showFirstFrame, videoRef, canvasRef]);

  // --- Actions ---

  const play = useCallback(async () => {
    log('Play action called');
    const videoElement = videoRef.current;
    if (!videoElement) return triggerError('Play failed: Video element not available');
    if (!isReady) {
         log('Video not ready, attempting to load/wait...');
         videoElement.load(); // Try loading again
         // Wait a short time for potential readiness
         await new Promise(resolve => setTimeout(resolve, 200));
         if (!videoRef.current || videoRef.current.readyState < 2) { // Check again
             return triggerError('Play failed: Video not ready after wait');
         }
         log('Video became ready after wait, proceeding with play.');
         setIsReady(true); // Update state if it became ready
    }

    // Ensure video is visible before playing (handled by useEffect now, but double-check)
     if (showFirstFrame) {
         errorLog('Attempted to play while showFirstFrame is true. This should not happen.');
         // Force video visible as a recovery mechanism - UI state should control this via showFirstFrame prop
         if (canvasRef.current) canvasRef.current.style.display = 'none';
         videoElement.style.display = 'block';
     }


    try {
      // Ensure muted for autoplay policies
      videoElement.muted = true;
      await videoElement.play();
      log('Playback started via video.play()');
      setIsPlaying(true);
    } catch (err) {
      triggerError('Play failed', err);
    }
  }, [videoRef, isReady, showFirstFrame, triggerError, log, errorLog]);

  const pause = useCallback(async () => {
    log('Pause action called');
    const videoElement = videoRef.current;
    if (!videoElement) return triggerError('Pause failed: Video element not available');

    try {
      videoElement.pause();
      log('Playback paused via video.pause()');
       if (timeUpdateIntervalRef.current) {
         clearInterval(timeUpdateIntervalRef.current);
         timeUpdateIntervalRef.current = null;
       }
      setIsPlaying(false);
    } catch (err) {
      // Pause rarely throws errors, but good practice
      triggerError('Pause failed', err);
    }
  }, [videoRef, triggerError, log]);

  const seek = useCallback(async (time: number) => {
    const videoElement = videoRef.current;
    if (!videoElement) {
      return triggerError('Seek failed: Video element not available');
    }

    try {
      videoElement.currentTime = time;
      // Only attempt to draw frame if we have both video and canvas elements
      if (showFirstFrame && videoElement.readyState >= 2 && canvasRef?.current) {
        log(`Seeking to ${time} and drawing to canvas`);
        drawFrameToCanvas();
      }
    } catch (err) {
      triggerError('Seek failed', err);
    }
  }, [videoRef, canvasRef, showFirstFrame, drawFrameToCanvas, triggerError]);

  const toggleFirstFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setShowFirstFrame(prev => {
      const newValue = !prev;
      if (newValue) {
        drawFrameToCanvas();
      }
      return newValue;
    });
  }, [videoRef, canvasRef, drawFrameToCanvas]);

  return {
    isPlaying,
    isReady,
    duration,
    currentTime,
    play,
    pause,
    seek,
    toggleFirstFrame,
    errorMessage
  };
} 