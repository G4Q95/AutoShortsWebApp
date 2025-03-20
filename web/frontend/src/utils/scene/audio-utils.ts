/**
 * Audio utility functions for scene components
 */
import { getStoredAudio } from '@/lib/api-client';
import { base64ToBlob } from './event-handlers/audio-handlers';
import { Scene } from '@/components/project/ProjectTypes';
import { VoiceSettings } from '@/lib/api-types';

/**
 * Fetches stored audio for a scene from storage or cache
 * @param projectId - ID of the current project
 * @param sceneId - ID of the scene
 * @param scene - Scene data
 * @param setAudioSrc - Function to set the audio source state
 * @param updateSceneAudio - Function to update the scene audio data
 * @param voiceId - Optional voice ID
 */
export const fetchStoredAudio = async (
  projectId: string,
  sceneId: string,
  scene: Scene,
  setAudioSrc: (src: string | null) => void,
  updateSceneAudio: (sceneId: string, audio: NonNullable<Scene['audio']>, voiceSettings: Scene['voice_settings']) => void,
  voiceId?: string
): Promise<void> => {
  console.log(`[AUDIO-UTILS] Fetching stored audio for scene ${sceneId}`);
  
  // If we already have an audio_url in the scene, use that first
  if (scene.audio?.audio_url) {
    console.log(`[AUDIO-UTILS] Using existing audio_url for scene ${sceneId}`);
    setAudioSrc(scene.audio.audio_url);
    return;
  }
  
  // Try to restore from base64 data if available
  if (scene.audio?.audio_base64) {
    try {
      console.log(`[AUDIO-UTILS] Restoring from base64 data for scene ${sceneId}`);
      const blob = base64ToBlob(scene.audio.audio_base64);
      const url = URL.createObjectURL(blob);
      setAudioSrc(url);
      return;
    } catch (error) {
      console.error(`[AUDIO-UTILS] Error restoring from base64:`, error);
    }
  }
  
  // If we have a persistentUrl, use that
  if (scene.audio?.persistentUrl) {
    console.log(`[AUDIO-UTILS] Using persistent URL for scene ${sceneId}`);
    setAudioSrc(scene.audio.persistentUrl);
    return;
  }
  
  // If nothing else is available, try to fetch from storage
  try {
    console.log(`[AUDIO-UTILS] Fetching from storage for scene ${sceneId}`);
    const response = await getStoredAudio(projectId, sceneId);
    
    if (response.data?.exists && response.data?.url) {
      console.log(`[AUDIO-UTILS] Retrieved from storage for scene ${sceneId}`);
      setAudioSrc(response.data.url);
      
      // Update the scene with the persistent URL
      if (scene.audio) {
        const updatedAudio = {
          ...scene.audio,
          persistentUrl: response.data.url
        };
        
        // Create or use existing voice settings
        const voiceSettings = scene.voice_settings || {
          voice_id: voiceId || '',
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          speaker_boost: true,
          speed: 1.0
        };
        
        updateSceneAudio(sceneId, updatedAudio, voiceSettings);
      }
    } else {
      console.log(`[AUDIO-UTILS] No audio found in storage for scene ${sceneId}`);
    }
  } catch (error) {
    console.error(`[AUDIO-UTILS] Error fetching from storage:`, error);
  }
};

/**
 * Cleans up a Blob URL when it's no longer needed
 * @param url - The URL to clean up
 */
export const cleanupAudioUrl = (url: string | null): void => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}; 