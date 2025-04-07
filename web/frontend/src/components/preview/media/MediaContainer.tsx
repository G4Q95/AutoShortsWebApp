import React, { CSSProperties, ReactNode, RefObject, useCallback } from 'react';
import { VideoElement } from './VideoElement';
import { ImageElement } from './ImageElement';
import { FullscreenButton } from '../FullscreenButton';

// Helper function for media type checking (extracted from VideoContextScenePreviewPlayer)
const isImageType = (type: string): boolean => type === 'image' || type === 'gallery';
const isVideoType = (type: string): boolean => type === 'video';

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
  containerRef: React.RefObject<HTMLDivElement>;
  
  // Media state
  isLoading: boolean;
  isHovering: boolean;
  isPlaying: boolean;
  showFirstFrame: boolean;
  isFullscreen: boolean;
  imageLoadError: boolean;
  
  // Refs
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imgRef: React.RefObject<HTMLImageElement>;
  
  // Styling
  mediaElementStyle: CSSProperties;
  getMediaContainerStyle: () => CSSProperties;
  
  // Event handlers
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFullscreenToggle: () => void;
  onImageLoad: () => void;
  onImageError: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  onContainerClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  
  // Extra props
  sceneId?: string;
  
  // For PlayerControls
  children?: ReactNode;
}

/**
 * MediaContainer - A wrapper component for all media elements
 * 
 * Handles the container styling, media type selection, and event handling
 * for all media types (video, image).
 */
export function MediaContainer({
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
  onContainerClick,
  
  // Extra props
  sceneId = '',
  
  // Children (PlayerControls)
  children
}: MediaContainerProps) {
  
  // Determine which media element to render based on type
  const renderMediaElement = useCallback(() => {
    if (isImageType(mediaType)) {
      return (
        <ImageElement
          mediaUrl={mediaUrl}
          isLoading={isLoading}
          isPlaying={isPlaying}
          isCompactView={isCompactView}
          imageLoadError={imageLoadError}
          imgRef={imgRef}
          mediaElementStyle={mediaElementStyle}
          onImageLoad={onImageLoad}
          onImageError={onImageError}
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
          sceneId={sceneId}
        />
      );
    }
  }, [
    mediaType, mediaUrl, localMediaUrl, isLoading, isPlaying, 
    isCompactView, showFirstFrame, imageLoadError, mediaElementStyle,
    videoRef, canvasRef, imgRef, sceneId,
    onImageLoad, onImageError
  ]);

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
      
      {/* Fullscreen toggle button */}
      <FullscreenButton 
        isFullscreen={isFullscreen}
        onToggle={onFullscreenToggle}
      />
      
      {/* Render children (PlayerControls) */}
      {children}
    </div>
  );
}

export default MediaContainer; 