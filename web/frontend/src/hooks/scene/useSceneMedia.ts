import { useState, useRef, useEffect, useCallback } from 'react';
import { base64ToBlob } from '@/utils/scene/event-handlers/audio-handlers';
import { Scene } from '@/components/project/ProjectTypes';
import { getStoredAudio } from '@/lib/api-client';

/**
 * Custom hook to manage media-related state and operations for a scene
 * 
 * @param scene - The scene object containing media information
 * @param currentProjectId - The ID of the current project
 * @param updateSceneMedia - Function to update scene media data
 * @param updateSceneAudio - Function to update scene audio data
 * @returns An object containing media state and functions
 */
export function useSceneMedia(
  scene: Scene,
  currentProjectId: string | undefined,
  updateSceneMedia: (sceneId: string, mediaData: any) => void,
  updateSceneAudio: (sceneId: string, audioData: any, voiceSettings?: any) => void
) {
  // Media state
  const [isLoading, setIsLoading] = useState(scene.isLoading || false);
  const [mediaError, setMediaError] = useState<string | null>(scene.error || null);
  const [aspectRatio, setAspectRatio] = useState<number | null>(scene.media?.width && scene.media?.height ? scene.media.width / scene.media.height : null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(scene.media?.url || scene.url || null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'gallery' | 'unknown'>(
    scene.media?.type || 'unknown'
  );
  
  // Progress bar state for media storage
  const [progress, setProgress] = useState(0);
  
  // Media element references
  const localPreview = useRef<string | null>(null);
  const mediaRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  
  // Retry state
  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Update media metadata when media elements load
   */
  const handleMediaMetadata = useCallback((
    width: number, 
    height: number, 
    type: 'image' | 'video' | 'gallery'
  ) => {
    // Calculate aspect ratio
    const ratio = width / height;
    setAspectRatio(ratio);
    
    // Update media type
    setMediaType(type);
    
    // Update scene data if there's a project ID
    if (currentProjectId) {
      updateSceneMedia(scene.id, {
        type,
        width,
        height,
        contentType: type === 'image' ? 'image/jpeg' : 'video/mp4'
      });
    }
    
    setIsLoading(false);
  }, [currentProjectId, scene.id, updateSceneMedia]);

  /**
   * Handle media loading errors
   */
  const handleMediaError = useCallback((error: string) => {
    setMediaError(error);
    setIsLoading(false);
  }, []);

  /**
   * Check for stored media on component mount
   */
  useEffect(() => {
    const fetchStoredMedia = async () => {
      // If there's already a valid media source and aspect ratio, don't fetch again
      if (mediaUrl && aspectRatio && !isRetrying) {
        return;
      }
      
      setIsLoading(true);
      setMediaError(null);
      
      try {
        // Logic for fetching and loading media would go here
        // This would interact with your media storage service
        
        // If media is successfully loaded, update state
        setIsLoading(false);
      } catch (err) {
        handleMediaError(`Error loading media: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    fetchStoredMedia();
  }, [mediaUrl, aspectRatio, isRetrying, handleMediaError]);

  // Store local preview reference for potential fallbacks
  useEffect(() => {
    const preview = scene.url;
    if (preview && !localPreview.current) {
      localPreview.current = preview;
    }
  }, [scene.url]);

  return {
    // Media state
    isLoading,
    mediaError,
    mediaUrl,
    mediaType,
    aspectRatio,
    progress,
    
    // References
    mediaRef,
    
    // Functions
    setMediaUrl,
    setMediaType,
    setAspectRatio,
    setProgress,
    setIsLoading,
    setMediaError,
    
    // Retry state
    isRetrying,
    setIsRetrying,
    
    // Event handlers
    handleMediaMetadata,
    handleMediaError
  };
} 