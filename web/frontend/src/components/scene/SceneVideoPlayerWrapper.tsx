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
import { useProject as useProjectContext } from '@/contexts/ProjectContext';

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
  const { project } = useProjectContext();
  console.log(`[SceneVideoPlayerWrapper] Scene ID: ${scene.id}, Project ID: ${projectId}`);
  console.log(`[SceneVideoPlayerWrapper] Scene media:`, scene.media);
  
  // Prepare media object for SceneMediaPlayer
  const mediaObject = scene.media ? {
    url: scene.media.url || '',
    storedUrl: scene.media.storageKey ? constructStorageUrl(scene.media.storageKey, projectId, scene.id) : undefined,
    thumbnailUrl: scene.media.thumbnailUrl || undefined,
    type: scene.media.type as 'image' | 'video' | 'gallery',
    trim: scene.media.trim,
    storageKey: scene.media.storageKey,
    isStorageBacked: !!scene.media.storageKey
  } : null;
  
  // Log the media dimensions and aspect ratio if available
  console.log(`[SceneVideoPlayerWrapper] Original scene aspect ratio data:`, {
    mediaAspectRatio: (scene as any).mediaAspectRatio,
    mediaOriginalWidth: (scene as any).mediaOriginalWidth,
    mediaOriginalHeight: (scene as any).mediaOriginalHeight,
    mediaWidth: scene.media?.width,
    mediaHeight: scene.media?.height
  });
  
  // Log the aspectRatio assignment in more detail with type checking
  if (mediaObject) {
    const mediaAspectRatio = (scene as any).mediaAspectRatio || 
      (scene.media as any).mediaAspectRatio || 
      (scene.media?.width && scene.media?.height ? 
        scene.media.width / scene.media.height : undefined);
    
    console.log(`[SceneVideoPlayerWrapper] Calculated aspect ratio:`, {
      fromScene: (scene as any).mediaAspectRatio,
      fromMedia: (scene.media as any).mediaAspectRatio,
      fromDimensions: scene.media?.width && scene.media?.height ? 
        scene.media.width / scene.media.height : undefined,
      calculatedValue: mediaAspectRatio
    });
    
    (mediaObject as any).aspectRatio = mediaAspectRatio;
    
    console.log(`[SceneVideoPlayerWrapper] Final mediaObject:`, mediaObject);
  }
  
  // Add logging to the SceneMediaPlayer props
  console.log(`[SceneVideoPlayerWrapper] Rendering with:`, {
    projectAspectRatio,
    showLetterboxing
  });
  
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
      projectAspectRatio={projectAspectRatio}
      showLetterboxing={showLetterboxing}
    />
  );
};

export default SceneVideoPlayerWrapper; 