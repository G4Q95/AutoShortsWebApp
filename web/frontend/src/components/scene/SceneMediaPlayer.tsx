/**
 * SceneMediaPlayer component
 * Wrapper around media player for scene media display with view mode toggle
 * Now using VideoContextScenePreviewPlayer for improved timeline scrubbing
 */
import React from 'react';
import { transformRedditVideoUrl } from '@/lib/media-utils';
import { Maximize, Minimize } from 'lucide-react';

// Import both player implementations
import ScenePreviewPlayer from '@/components/preview/ScenePreviewPlayer';
import VideoContextScenePreviewPlayer from '@/components/preview/VideoContextScenePreviewPlayer';

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
    thumbnailUrl?: string;
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

  /**
   * Flag to enable VideoContext-based player
   * Set to true to use the VideoContext implementation
   */
  useVideoContext?: boolean;
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
  className = '',
  useVideoContext = true, // Default to using VideoContext player
}) => {
  if (!media) {
    // Render placeholder for empty media
    return (
      <div 
        className={`bg-gray-800 rounded-lg flex items-center justify-center w-full h-full ${className}`}
        style={{ height: isCompactView ? '190px' : 'auto' }}
        data-testid="scene-media-empty"
      >
        <p className="text-gray-400">No media</p>
      </div>
    );
  }
  
  // Use the stored URL if available, otherwise the original URL
  const mediaUrl = media.storedUrl || media.url;
  
  // Use the trim values if available, or default to 0
  const trimStart = media.trim?.start || 0;
  const trimEnd = media.trim?.end || 0;
  
  // Handle trim changes
  const handleTrimChange = (start: number, end: number) => {
    if (onTrimChange) {
      onTrimChange(start, end);
    }
  };
  
  return (
    <div 
      className={`relative w-full bg-black rounded-t-lg overflow-hidden ${className}`}
      style={{ height: isCompactView ? '190px' : 'auto', minHeight: '190px' }}
      data-testid="scene-media"
    >
      {/* Center the content in compact view */}
      <div className="flex items-center justify-center w-full h-full">
        {useVideoContext ? (
          <VideoContextScenePreviewPlayer
            projectId={projectId}
            sceneId={sceneId}
            mediaUrl={mediaUrl}
            audioUrl={audioUrl || undefined}
            mediaType={media.type}
            trim={{ start: trimStart, end: trimEnd }}
            onTrimChange={handleTrimChange}
            className="rounded-t-lg"
            isCompactView={isCompactView}
            thumbnailUrl={media.thumbnailUrl}
          />
        ) : (
          <ScenePreviewPlayer
            projectId={projectId}
            sceneId={sceneId}
            mediaUrl={media.type === 'video' ? transformRedditVideoUrl(mediaUrl) : mediaUrl}
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
        onClick={onToggleViewMode}
        className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-70 transition-opacity"
        data-testid="view-mode-toggle"
      >
        {isCompactView ? (
          <Maximize className="h-4 w-4" />
        ) : (
          <Minimize className="h-4 w-4" />
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