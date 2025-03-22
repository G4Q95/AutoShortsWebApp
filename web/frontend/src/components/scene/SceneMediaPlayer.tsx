/**
 * SceneMediaPlayer component
 * Wrapper around ScenePreviewPlayer for scene media display with view mode toggle
 */
import React, { useRef, useEffect } from 'react';
import ScenePreviewPlayer from '@/components/preview/ScenePreviewPlayer';
import { transformRedditVideoUrl } from '@/lib/media-utils';

interface SceneMediaPlayerProps {
  /**
   * Project ID
   */
  projectId: string;
  
  /**
   * Scene ID
   */
  sceneId: string;
  
  /**
   * Media information
   */
  media: {
    url: string;
    storedUrl?: string;
    type: 'image' | 'video' | 'gallery';
    trim?: { start: number; end: number };
    storageKey?: string;
    isStorageBacked?: boolean;
  } | null;
  
  /**
   * Audio URL for synchronized playback
   */
  audioUrl?: string | null;
  
  /**
   * Whether the view is compact or expanded
   */
  isCompactView: boolean;
  
  /**
   * Handler for view mode toggle
   */
  onToggleViewMode: () => void;
  
  /**
   * Handler for trim change
   */
  onTrimChange?: (start: number, end: number) => void;
  
  /**
   * Additional class names
   */
  className?: string;
}

/**
 * Media player component for scene with view mode toggle
 * Integrates with ScenePreviewPlayer for media display and controls
 */
const SceneMediaPlayerComponent: React.FC<SceneMediaPlayerProps> = ({
  projectId,
  sceneId,
  media,
  audioUrl,
  isCompactView,
  onToggleViewMode,
  onTrimChange,
  className = ''
}) => {
  // Ref for container element to allow direct DOM manipulation
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Effect to update container height on view mode change
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      if (isCompactView) {
        container.style.height = '190px';
        container.style.maxHeight = '190px';
      } else {
        container.style.height = 'auto';
        container.style.maxHeight = '500px';
        // Ensure minimum height in expanded mode
        container.style.minHeight = '300px';
      }
    }
  }, [isCompactView]);

  // If no media is available, show a placeholder
  if (!media) {
    return (
      <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
        <p className="text-gray-500">No media available</p>
      </div>
    );
  }

  // Prioritize the stored URL if available
  const mediaUrl = React.useMemo(() => {
    if (!media?.url) return null;

    // Transform Reddit video URLs to use our proxy to avoid CORS issues
    if (media.type === 'video' && media.url.includes('v.redd.it')) {
      console.log('Processing Reddit video:', media.url);
      const transformedUrl = transformRedditVideoUrl(media.url);
      console.log('Transformed video URL:', transformedUrl);
      return transformedUrl;
    }

    return media.url;
  }, [media?.url, media?.type]);
  
  // Default trim values
  const trimStart = media.trim?.start || 0;
  const trimEnd = media.trim?.end || 0;
  
  // Handle trim change
  const handleTrimChange = (start: number, end: number) => {
    if (onTrimChange) {
      onTrimChange(start, end);
    }
  };
  
  // Use stored URL if available, otherwise use the (potentially transformed) URL
  const finalMediaUrl = media?.storedUrl || mediaUrl;
  
  // Create enhanced toggle handler to update DOM directly
  const handleToggleView = () => {
    // Call the provided toggle function
    onToggleViewMode();
    
    // Direct DOM manipulation to ensure immediate visual feedback
    if (containerRef.current) {
      const container = containerRef.current;
      const currentCompact = container.style.maxHeight === '190px';
      
      if (currentCompact) {
        // Expanding
        console.log('Expanding video player directly via DOM...');
        container.style.transition = 'all 0.3s ease-in-out';
        container.style.maxHeight = '500px';
        container.style.height = 'auto';
        container.style.minHeight = '300px';
      } else {
        // Collapsing
        console.log('Collapsing video player directly via DOM...');
        container.style.transition = 'all 0.3s ease-in-out';
        container.style.maxHeight = '190px';
        container.style.height = '190px';
        container.style.minHeight = '190px';
      }
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-black rounded-t-lg ${className}`}
      style={{ 
        height: isCompactView ? '190px' : 'auto',
        minHeight: '190px',
        maxHeight: isCompactView ? '190px' : '500px',
        overflow: 'hidden',
        transition: 'all 0.3s ease-in-out'
      }}
      data-testid="scene-media"
    >
      {/* Center the content in compact view */}
      <div className={`flex items-center justify-center w-full h-full ${!isCompactView ? 'overflow-visible' : ''}`}>
        {finalMediaUrl && (
          <ScenePreviewPlayer
            projectId={projectId}
            sceneId={sceneId}
            mediaUrl={finalMediaUrl}
            audioUrl={audioUrl || undefined}
            mediaType={media.type}
            trim={{ start: trimStart, end: trimEnd }}
            onTrimChange={handleTrimChange}
            className="rounded-t-lg"
            isCompactView={isCompactView}
          />
        )}
      </div>
      
      {/* View mode toggle button */}
      <button 
        className="absolute top-2 right-2 p-1 bg-gray-800 bg-opacity-60 rounded text-white z-10 hover:bg-opacity-80 transition-colors"
        onClick={handleToggleView}
        title={isCompactView ? "Expand view" : "Compact view"}
        aria-label={isCompactView ? "Expand view" : "Compact view"}
        data-testid="view-mode-toggle"
      >
        {isCompactView ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20"></polyline>
            <polyline points="20 10 14 10 14 4"></polyline>
            <line x1="14" y1="10" x2="21" y2="3"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
        )}
      </button>
    </div>
  );
};

/**
 * Custom comparison function for React.memo
 * Only re-render when media content or view state changes
 */
function arePropsEqual(prevProps: SceneMediaPlayerProps, nextProps: SceneMediaPlayerProps): boolean {
  // Check for media presence first
  const prevHasMedia = !!prevProps.media;
  const nextHasMedia = !!nextProps.media;
  
  if (prevHasMedia !== nextHasMedia) {
    return false;
  }
  
  // If no media in both cases, other changes don't matter much
  if (!prevHasMedia && !nextHasMedia) {
    return true;
  }
  
  // Compare essential media properties
  const mediaChanged = prevProps.media && nextProps.media && (
    prevProps.media.url !== nextProps.media.url ||
    prevProps.media.storedUrl !== nextProps.media.storedUrl ||
    prevProps.media.type !== nextProps.media.type ||
    prevProps.media.isStorageBacked !== nextProps.media.isStorageBacked ||
    // Compare trim values
    (prevProps.media.trim?.start !== nextProps.media.trim?.start) ||
    (prevProps.media.trim?.end !== nextProps.media.trim?.end)
  );
  
  // Compare view state and audio
  return !(
    mediaChanged ||
    prevProps.audioUrl !== nextProps.audioUrl ||
    prevProps.isCompactView !== nextProps.isCompactView ||
    prevProps.projectId !== nextProps.projectId ||
    prevProps.sceneId !== nextProps.sceneId
  );
}

/**
 * Memoized version of SceneMediaPlayer to prevent unnecessary re-renders
 */
export const SceneMediaPlayer = React.memo(SceneMediaPlayerComponent, arePropsEqual); 