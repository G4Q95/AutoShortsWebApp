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
import { Scene, useProject } from '@/components/project/ProjectProvider';
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
  /** Project aspect ratio */
  projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  /** Whether to show letterboxing */
  showLetterboxing?: boolean;
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
  projectAspectRatio = '9:16',
  showLetterboxing = true
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
  
  // Access the Scene type from our updated context for type consistency
  useProject();
  
  // Prepare media object for SceneMediaPlayer with improved error handling
  const mediaObject = scene.media ? {
    url: scene.media.url || '',
    storedUrl: scene.media.storageKey ? 
      constructStorageUrl(scene.media.storageKey, projectId, scene.id) : undefined,
    thumbnailUrl: scene.media.thumbnailUrl || undefined,
    type: scene.media.type as 'image' | 'video' | 'gallery',
    trim: scene.media.trim || { start: 0, end: 0 },
    storageKey: scene.media.storageKey,
    isStorageBacked: !!scene.media.storageKey
  } : null;
  
  // Calculate aspect ratio from scene data without excessive logging
  if (mediaObject) {
    const mediaAspectRatio = (scene as any).mediaAspectRatio || 
      (scene.media as any).mediaAspectRatio || 
      (scene.media?.width && scene.media?.height ? 
        scene.media.width / scene.media.height : undefined);
    
    (mediaObject as any).aspectRatio = mediaAspectRatio || 9/16; // Provide default aspect ratio
  }
  
  // Use fallback media object if scene.media is null or undefined
  const safeMediaObject = mediaObject || {
    url: '',
    type: 'image' as const,
    trim: { start: 0, end: 0 },
    isStorageBacked: false,
    aspectRatio: 9/16
  };
  
  return (
    <SceneMediaPlayer
      projectId={projectId}
      sceneId={scene.id}
      media={safeMediaObject}
      audioUrl={audioUrl}
      isCompactView={isCompactView}
      onToggleViewMode={toggleViewMode}
      onTrimChange={handleTrimChange}
      className={className}
      projectAspectRatio={projectAspectRatio}
      showLetterboxing={showLetterboxing}
    />
  );
};

export { SceneVideoPlayerWrapper };
export default SceneVideoPlayerWrapper; 