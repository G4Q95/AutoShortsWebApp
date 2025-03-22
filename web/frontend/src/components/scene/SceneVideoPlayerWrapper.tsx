/**
 * SceneVideoPlayerWrapper
 * 
 * Extracts video player functionality from SceneComponent without merging with
 * existing components like SceneMediaPlayer and ScenePreviewPlayer.
 * Serves as a bridge between SceneComponent and media-specific components.
 */
'use client';

import React, { useState, useCallback, useEffect, MouseEvent } from 'react';
import { SceneMediaPlayer } from './SceneMediaPlayer';
import { Scene } from '@/components/project/ProjectProvider';
import { constructStorageUrl } from '@/utils/scene/scene-utils';
import { transformRedditVideoUrl } from '@/lib/media-utils';
import { createToggleViewModeHandler } from '@/utils/scene/event-handlers/ui-handlers';

interface SceneVideoPlayerWrapperProps {
  /** The scene object containing media information */
  scene: Scene;
  /** The project ID */
  projectId: string;
  /** Audio URL for synchronized playback */
  audioUrl?: string | null;
  /** Class name for additional styling */
  className?: string;
  /** Callback for when media trim points change */
  onMediaTrimChange?: (start: number, end: number) => void;
  /** Optional override for compact view state */
  initialCompactView?: boolean;
  /** Whether the video is expanded (controlled by parent) */
  isExpanded?: boolean;
  /** Callback to request expansion from parent */
  onExpansionRequest?: (shouldExpand: boolean) => void;
}

/**
 * Wrapper component that handles video player functionality extracted from SceneComponent
 * Acts as a bridge to existing components without merging them
 */
const SceneVideoPlayerWrapper: React.FC<SceneVideoPlayerWrapperProps> = ({
  scene,
  projectId,
  audioUrl,
  className = '',
  onMediaTrimChange,
  initialCompactView = true,
  isExpanded = false,
  onExpansionRequest
}) => {
  console.log(`[SceneVideoPlayerWrapper] Rendering for scene: ${scene.id} with compact view: ${initialCompactView}, expansion: ${isExpanded}`);

  // Media state - use local state as fallback if parent doesn't control expansion
  const [localCompactView, setLocalCompactView] = useState<boolean>(initialCompactView);
  
  // Use either parent-controlled expansion state or local state
  const isCompactView = onExpansionRequest ? !isExpanded : localCompactView;
  
  // Update local state when the prop changes (for fallback mode)
  useEffect(() => {
    if (!onExpansionRequest) {
      setLocalCompactView(initialCompactView);
      console.log(`[SceneVideoPlayerWrapper] Updating compact view from prop: ${initialCompactView}`);
    }
  }, [initialCompactView, onExpansionRequest]);
  
  // Create toggle handler that uses expansion request if available
  const toggleViewMode = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    
    if (onExpansionRequest) {
      // Use parent-controlled expansion
      onExpansionRequest(!isExpanded);
      console.log(`[SceneVideoPlayerWrapper] Requesting expansion change to: ${!isExpanded}`);
    } else {
      // Fallback to local state
      setLocalCompactView(prev => {
        const newState = !prev;
        console.log(`[SceneVideoPlayerWrapper] Toggling local view state from ${prev} to ${newState}`);
        return newState;
      });
    }
  }, [isExpanded, onExpansionRequest]);
  
  // Handle trim changes with proper validation
  const handleTrimChange = useCallback((start: number, end: number) => {
    if (onMediaTrimChange && scene.media) {
      console.log(`[SceneVideoPlayerWrapper] Trim changed: ${start} - ${end}`);
      onMediaTrimChange(start, end);
    }
  }, [onMediaTrimChange, scene.media]);
  
  // Log media information when it changes (helpful for debugging)
  useEffect(() => {
    if (scene.media) {
      console.log(`[WRAPPER-MEDIA] Scene ${scene.id} media info:`, {
        url: scene.media.url,
        storedUrl: scene.media.storedUrl,
        storageKey: scene.media.storageKey,
        isStorageBacked: scene.media.isStorageBacked,
        type: scene.media.type
      });
    }
  }, [scene.id, scene.media]);
  
  // If no media is available, show placeholder
  if (!scene.media) {
    return (
      <div className="bg-gray-100 w-full h-48 flex items-center justify-center text-gray-500 rounded-t-lg">
        <span data-testid="no-media-placeholder">No media available</span>
      </div>
    );
  }
  
  // Prepare media object for SceneMediaPlayer
  const mediaUrl = scene.media.storageKey
    ? constructStorageUrl(scene.media.storageKey, projectId, scene.id)
    : scene.media.url;
    
  // Transform Reddit video URLs if needed
  const finalMediaUrl = scene.media.type === 'video' 
    ? transformRedditVideoUrl(mediaUrl) 
    : mediaUrl;
  
  // Prepare complete media object for SceneMediaPlayer
  const mediaObject = {
    url: scene.media.url || '',
    storedUrl: finalMediaUrl,
    type: scene.media.type as 'image' | 'video' | 'gallery',
    trim: scene.media.trim || { start: 0, end: 0 },
    storageKey: scene.media.storageKey,
    isStorageBacked: !!scene.media.storageKey
  };
  
  // Create a wrapper for the toggle function to match the expected signature
  const handleViewModeToggle = () => {
    if (onExpansionRequest) {
      // Use parent-controlled expansion
      onExpansionRequest(!isExpanded);
      console.log(`[SceneVideoPlayerWrapper] Requesting expansion via button: ${!isExpanded}`);
    } else {
      // Fallback to local toggle
      const mockEvent = {} as MouseEvent;
      toggleViewMode(mockEvent);
      console.log(`[SceneVideoPlayerWrapper] Toggled view mode for scene: ${scene.id}, new state: ${!isCompactView}`);
    }
  };
  
  return (
    <SceneMediaPlayer
      projectId={projectId}
      sceneId={scene.id}
      media={mediaObject}
      audioUrl={audioUrl}
      isCompactView={isCompactView}
      onToggleViewMode={handleViewModeToggle}
      onTrimChange={handleTrimChange}
      className={className}
      isParentControlled={!!onExpansionRequest}
    />
  );
};

export default SceneVideoPlayerWrapper; 