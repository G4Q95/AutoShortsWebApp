/**
 * SceneMediaPlayer component
 * Wrapper around ScenePreviewPlayer for scene media display with view mode toggle
 */
import React from 'react';
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
export const SceneMediaPlayer: React.FC<SceneMediaPlayerProps> = ({
  projectId,
  sceneId,
  media,
  audioUrl,
  isCompactView,
  onToggleViewMode,
  onTrimChange,
  className = ''
}) => {
  // If no media is available, show a placeholder
  if (!media) {
    return (
      <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
        <p className="text-gray-500">No media available</p>
      </div>
    );
  }

  // Prioritize the stored URL if available
  const mediaUrl = media.storedUrl || media.url;
  
  // Default trim values
  const trimStart = media.trim?.start || 0;
  const trimEnd = media.trim?.end || 0;
  
  // Handle trim change
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
      </div>
      
      {/* View mode toggle button */}
      <button 
        className="absolute top-2 right-2 p-1 bg-gray-800 bg-opacity-60 rounded text-white z-10 hover:bg-opacity-80 transition-colors"
        onClick={onToggleViewMode}
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
      
      {/* Loading indicator for media storage */}
      {media.isStorageBacked === false && (
        <div className="absolute bottom-0 left-0 right-0 bg-blue-500 h-1">
          <div className="bg-blue-700 h-full transition-all" style={{ width: `${0}%` }}></div>
        </div>
      )}
    </div>
  );
}; 