/**
 * SceneVideoPlayerWrapper
 * 
 * Extracts video player functionality from SceneComponent without merging with
 * existing components like SceneMediaPlayer and ScenePreviewPlayer.
 * Serves as a bridge between SceneComponent and media-specific components.
 */
'use client';

import React, { useState, useCallback } from 'react';
import { SceneMediaPlayer } from './SceneMediaPlayer';
import { Scene } from '@/components/project/ProjectProvider';
import { constructStorageUrl } from '@/utils/scene';

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
  onMediaTrimChange
}) => {
  // Extract media state from scene
  const [isCompactView, setIsCompactView] = useState<boolean>(true);
  
  // Toggle view mode between compact and expanded
  const toggleViewMode = useCallback(() => {
    setIsCompactView(prev => !prev);
  }, []);
  
  // Handle trim changes
  const handleTrimChange = useCallback((start: number, end: number) => {
    if (onMediaTrimChange) {
      onMediaTrimChange(start, end);
    }
  }, [onMediaTrimChange]);
  
  // Prepare media object for SceneMediaPlayer
  const mediaObject = scene.media ? {
    url: scene.media.url || '',
    storedUrl: scene.media.storageKey ? constructStorageUrl(scene.media.storageKey, projectId, scene.id) : undefined,
    type: scene.media.type as 'image' | 'video' | 'gallery',
    trim: scene.media.trim,
    storageKey: scene.media.storageKey,
    isStorageBacked: !!scene.media.storageKey
  } : null;
  
  return (
    <SceneMediaPlayer
      projectId={projectId}
      sceneId={scene.id}
      media={mediaObject}
      audioUrl={audioUrl}
      isCompactView={isCompactView}
      onToggleViewMode={toggleViewMode}
      onTrimChange={handleTrimChange}
      className={className}
    />
  );
};

export default SceneVideoPlayerWrapper; 