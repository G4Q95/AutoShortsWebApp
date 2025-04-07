import { useCallback } from 'react';

/**
 * Props for the useMediaEventHandlers hook
 */
interface UseMediaEventHandlersProps {
  // Identifiers
  sceneId: string;
  mediaType: 'image' | 'video' | 'gallery';
  
  // State setters
  setIsLoading: (isLoading: boolean) => void;
  setIsReady: (isReady: boolean) => void;
  setIsHovering: (isHovering: boolean) => void;
  setImageLoadError: (hasError: boolean) => void;
  setTrimEnd: (trimEnd: number) => void;
  
  // Playback control functions
  handlePlay: () => void;
  handlePause: () => void;
  isPlaying: boolean;
  
  // Optional fullscreen handler
  handleFullscreenToggle?: () => void;
}

/**
 * Return type for the useMediaEventHandlers hook
 */
interface UseMediaEventHandlersReturn {
  // Mouse event handlers
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  
  // Media event handlers  
  onImageLoad: () => void;
  onImageError: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  
  // Container events
  onContainerClick: (e: React.MouseEvent<HTMLElement>) => void;
  
  // Optional fullscreen handler
  onFullscreenToggle: () => void;
}

/**
 * useMediaEventHandlers - Custom Hook for Managing Media Event Handlers
 * 
 * This hook consolidates various event handlers related to media elements in the 
 * VideoContextScenePreviewPlayer component. It provides consistent handling for
 * hover events, image loading events, error handling, and container interactions.
 * 
 * Key features:
 * - Centralizes media event handling logic
 * - Provides consistent hover state management
 * - Handles image loading and error states
 * - Manages container click behavior (play/pause toggling)
 * - Consistent logging for debugging
 * 
 * @param props Configuration object containing state setters and handlers
 * @returns Object containing event handler functions
 * 
 * @example
 * // Basic usage
 * const { 
 *   onMouseEnter, 
 *   onMouseLeave, 
 *   onImageLoad,
 *   onImageError,
 *   onContainerClick 
 * } = useMediaEventHandlers({
 *   sceneId,
 *   mediaType,
 *   setIsLoading,
 *   setIsReady,
 *   setIsHovering,
 *   setImageLoadError,
 *   setTrimEnd,
 *   handlePlay,
 *   handlePause,
 *   isPlaying
 * });
 */
export function useMediaEventHandlers({
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
}: UseMediaEventHandlersProps): UseMediaEventHandlersReturn {
  
  // Mouse event handlers
  const onMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, [setIsHovering]);
  
  const onMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, [setIsHovering]);
  
  // Image load handler
  const onImageLoad = useCallback(() => {
    const instanceId = `${sceneId}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[Image onLoad][${instanceId}] Fired for scene ${sceneId}. Media Type: ${mediaType}`);
    
    // ALWAYS set default 30s duration for images
    console.log(`[Image onLoad][${instanceId}] Setting default duration (30s).`);
    setTrimEnd(30);
    
    setIsLoading(false);
    setIsReady(true);
  }, [sceneId, mediaType, setIsLoading, setIsReady, setTrimEnd]);
  
  // Image error handler
  const onImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error(`[DEBUG-FALLBACK] Error loading image:`, e);
    setIsLoading(false);
    setImageLoadError(true);
  }, [setIsLoading, setImageLoadError]);
  
  // Container click handler
  const onContainerClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    // Don't trigger play/pause if clicking on interactive elements
    const target = e.target as HTMLElement;
    const isButton = target.tagName === 'BUTTON' || 
                    target.closest('button') !== null ||
                    target.closest('[data-drag-handle-exclude]') !== null;
    
    if (!isButton) {
      isPlaying ? handlePause() : handlePlay();
    }
  }, [isPlaying, handlePlay, handlePause]);
  
  // Fullscreen toggle handler (pass through if provided)
  const onFullscreenToggle = useCallback(() => {
    if (handleFullscreenToggle) {
      handleFullscreenToggle();
    }
  }, [handleFullscreenToggle]);
  
  return {
    onMouseEnter,
    onMouseLeave,
    onImageLoad,
    onImageError,
    onContainerClick,
    onFullscreenToggle
  };
} 