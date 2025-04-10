import React, { CSSProperties, ReactNode, RefObject, useCallback } from 'react';
import { VideoElement } from './VideoElement';
import { ImageElement } from './ImageElement';
import { FullscreenButton } from '../FullscreenButton';

// Helper function for media type checking (extracted from VideoContextScenePreviewPlayer)
const isImageType = (type: string): boolean => type === 'image' || type === 'gallery';
const isVideoType = (type: string): boolean => type === 'video';

// Helper to determine closest standard aspect ratio
const getClosestStandardRatio = (ratio: number): string => {
  // Common aspect ratios to check against
  const standardRatios = [
    { ratio: 1, name: '1:1' },      // Square
    { ratio: 4/3, name: '4:3' },    // Standard TV
    { ratio: 16/9, name: '16:9' },  // Widescreen
    { ratio: 9/16, name: '9:16' },  // Vertical video
    { ratio: 4/5, name: '4:5' },    // Instagram portrait
    { ratio: 5/4, name: '5:4' },    // Medium format
    { ratio: 3/2, name: '3:2' },    // 35mm film
    { ratio: 2/3, name: '2:3' },    // Portrait
    { ratio: 21/9, name: '21:9' },  // Ultrawide
  ];

  // Find closest match
  let closest = standardRatios[0];
  let minDiff = Math.abs(ratio - closest.ratio);

  for (let i = 1; i < standardRatios.length; i++) {
    const diff = Math.abs(ratio - standardRatios[i].ratio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = standardRatios[i];
    }
  }

  return closest.name;
};

// Shared props for both media types
interface MediaContainerProps {
  // Media properties
  mediaUrl: string;
  localMediaUrl?: string | null;
  mediaType: string;
  
  // Container props
  className?: string;
  isCompactView: boolean;
  projectAspectRatio: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  
  // Media state
  isLoading: boolean;
  isHovering: boolean;
  isPlaying: boolean;
  showFirstFrame: boolean;
  isFullscreen: boolean;
  imageLoadError: boolean;
  
  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
  
  // Styling
  mediaElementStyle: CSSProperties;
  getMediaContainerStyle: () => CSSProperties;
  
  // Event handlers
  onMouseEnter?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onFullscreenToggle?: (isFullscreen: boolean) => void;
  onImageLoad?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onImageError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onVideoError?: (error: Error) => void;
  onContainerClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  // Extra props
  sceneId?: string;
  
  // Aspect ratio info display
  showAspectRatio?: boolean;
  calculatedAspectRatio?: number;
  
  // For PlayerControls
  children?: ReactNode;
  
  // NEW PROP
  isMediaReady: boolean;
  
  // View mode toggle button
  toggleButton?: ReactNode;
}

/**
 * MediaContainer - A wrapper component for all media elements
 * 
 * Handles the container styling, media type selection, and event handling
 * for all media types (video, image).
 */
function _MediaContainer({
  // Media properties
  mediaUrl,
  localMediaUrl,
  mediaType,
  
  // Container props
  className = '',
  isCompactView,
  projectAspectRatio,
  containerRef,
  
  // Media state
  isLoading,
  isHovering,
  isPlaying,
  showFirstFrame,
  isFullscreen,
  imageLoadError,
  
  // Refs
  videoRef,
  canvasRef,
  imgRef,
  
  // Styling
  mediaElementStyle,
  getMediaContainerStyle,
  
  // Event handlers
  onMouseEnter,
  onMouseLeave,
  onFullscreenToggle,
  onImageLoad,
  onImageError,
  onVideoError,
  onContainerClick,
  
  // Extra props
  sceneId = '',
  
  // Aspect ratio info
  showAspectRatio = false,
  calculatedAspectRatio,
  
  // Children (PlayerControls)
  children,

  // NEW PROP
  isMediaReady, // Passed down from parent based on bridge.isReady
  
  // View mode toggle button
  toggleButton
}: MediaContainerProps) {
  
  // Determine which media element to render based on type
  const renderMediaElement = useCallback(() => {
    if (isImageType(mediaType)) {
      // Create an adapter function that calls onImageLoad without passing the event
      const handleImageLoad = () => {
        if (onImageLoad) {
          // Call the original function but don't pass any arguments
          onImageLoad({} as React.SyntheticEvent<HTMLImageElement, Event>);
        }
      };
      
      return (
        <ImageElement
          mediaUrl={mediaUrl}
          isLoading={isLoading}
          isPlaying={isPlaying}
          isCompactView={isCompactView}
          imageLoadError={imageLoadError}
          imgRef={imgRef}
          mediaElementStyle={mediaElementStyle}
          onImageLoad={handleImageLoad} // Use the adapter function
          onImageError={onImageError || ((_e: React.SyntheticEvent<HTMLImageElement, Event>) => {})}
          sceneId={sceneId}
        />
      );
    } else {
      // Default to video
      return (
        <VideoElement
          mediaUrl={mediaUrl}
          localMediaUrl={localMediaUrl}
          isLoading={isLoading}
          isPlaying={isPlaying}
          isCompactView={isCompactView}
          showFirstFrame={showFirstFrame}
          videoRef={videoRef}
          canvasRef={canvasRef}
          mediaElementStyle={mediaElementStyle}
          onVideoError={onVideoError}
          sceneId={sceneId}
        />
      );
    }
  }, [
    mediaType, mediaUrl, localMediaUrl, isLoading, isPlaying, 
    isCompactView, showFirstFrame, imageLoadError, mediaElementStyle,
    videoRef, canvasRef, imgRef, sceneId,
    onImageLoad, onImageError, onVideoError
  ]);
  
  // Calculate aspect ratio values for information display
  const [projWidth, projHeight] = projectAspectRatio.split(':').map(Number);
  const projectRatio = projWidth / projHeight;
  const mediaRatio = calculatedAspectRatio || projectRatio;
  const closestRatio = getClosestStandardRatio(mediaRatio);

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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onContainerClick}
      data-testid="video-context-preview"
      data-media-status={isMediaReady ? 'ready' : 'loading'}
    >
      {/* Black inner container for letterboxing/pillarboxing */}
      <div 
        className="bg-black flex items-center justify-center w-full h-full relative"
        style={getMediaContainerStyle()}
      >
        {/* Media element container - ensures proper positioning */}
        <div
          className="relative bg-black flex items-center justify-center"
          style={{
            ...mediaElementStyle,
            position: 'relative', 
            zIndex: 5 // Ensure media container has proper z-index
          }}
        >
          {renderMediaElement()}
        </div>
      </div>
      
      {/* Controls container - all UI controls should be in this container to share stacking context */}
      <div className="absolute inset-0 z-10">
        {/* Aspect ratio information overlay - styled to match the original */}
        {showAspectRatio && (
          <div className="absolute top-0 left-0 right-0 flex justify-center text-[10px]">
            <div className="inline-flex bg-black bg-opacity-90 px-1">
              <span className="text-red-400">{mediaRatio.toFixed(4)}</span>
              <span className="text-gray-300 mx-1">[{closestRatio}]</span>
              <span className="text-green-400">{projectAspectRatio}</span>
            </div>
          </div>
        )}
        
        {/* Fullscreen toggle button */}
        <div className="absolute top-2 right-2">
          <FullscreenButton
            isFullscreen={isFullscreen}
            onToggle={onFullscreenToggle ? () => onFullscreenToggle(!isFullscreen) : () => {}}
          />
        </div>
        
        {/* View mode toggle button - render if provided */}
        {toggleButton}
      </div>
      
      {/* Render children (PlayerControls) */}
      {children}
    </div>
  );
}

// Export the memoized component with the original name
export const MediaContainer = React.memo(_MediaContainer); 