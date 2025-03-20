/**
 * Audio utilities for Scene component
 */
import { getStoredAudio } from '@/lib/api/voice';
import { base64ToBlob } from './event-handlers/audio-handlers';
import { Scene } from '@/components/project/ProjectTypes';
import { VoiceSettings } from '@/lib/api-types';

// Define SceneAudio type from Scene type
type SceneAudio = NonNullable<Scene['audio']>;

/**
 * Fetch stored audio for a scene
 * @param projectId The project ID
 * @param sceneId The scene ID
 * @param scene The current scene data
 * @param setAudioSrc Function to set the audio source
 * @param updateSceneAudio Function to update the scene audio in context
 * @param voiceId Current voice ID (fallback for voice settings)
 * @returns Promise resolving to the audio URL if successful
 */
export const fetchStoredAudio = async (
  projectId: string,
  sceneId: string,
  scene: Scene,
  setAudioSrc: (src: string | null) => void,
  updateSceneAudio: (sceneId: string, audio: SceneAudio, voiceSettings: VoiceSettings) => void,
  voiceId: string = ''
): Promise<string | null> => {
  console.log(`SceneContainer ${sceneId}: Checking for audio...`);
  
  // If there's already a valid audio source, don't fetch again
  if (scene.audio?.audio_url || scene.audio?.persistentUrl) {
    const audioSource = scene.audio.persistentUrl || scene.audio.audio_url;
    console.log(`SceneContainer ${sceneId}: Already have audio source: ${audioSource}`);
    setAudioSrc(audioSource || null);
    return audioSource || null;
  }
  
  // First try to restore from base64 data in the scene
  if (scene.audio?.audio_base64) {
    console.log(`SceneContainer ${sceneId}: Found base64 audio data in scene, restoring...`);
    try {
      const audioBlob = base64ToBlob(scene.audio.audio_base64, scene.audio.content_type || 'audio/mp3');
      const blobUrl = URL.createObjectURL(audioBlob);
      setAudioSrc(blobUrl);
      console.log(`SceneContainer ${sceneId}: Restored audio from base64 data`);
      return blobUrl;
    } catch (err) {
      console.error(`SceneContainer ${sceneId}: Error creating blob from base64:`, err);
      // Continue to next method if this fails
    }
  }
  
  // Next, try to use a persistent URL from the scene data
  if (scene.audio?.persistentUrl) {
    console.log(`SceneContainer ${sceneId}: Found persistent URL in scene, using: ${scene.audio.persistentUrl}`);
    try {
      // Test if the URL is accessible
      const response = await fetch(scene.audio.persistentUrl, { method: 'HEAD' });
      if (response.ok) {
        setAudioSrc(scene.audio.persistentUrl);
        console.log(`SceneContainer ${sceneId}: Persistent URL is valid, using it`);
        return scene.audio.persistentUrl;
      } else {
        console.warn(`SceneContainer ${sceneId}: Persistent URL failed HEAD request with status ${response.status}, will try to fetch from storage`);
      }
    } catch (err) {
      console.warn(`SceneContainer ${sceneId}: Error checking persistent URL, will try to fetch from storage:`, err);
    }
  }
  
  // If no base64 data or valid persistent URL in scene, try to fetch from storage
  if (projectId) {
    try {
      console.log(`SceneContainer ${sceneId}: Checking for stored audio in storage for project ${projectId}...`);
      const response = await getStoredAudio(projectId, sceneId);
      
      if (response.error) {
        console.error(`SceneContainer ${sceneId}: Error fetching stored audio:`, response.error);
      } else if (response.data && response.data.exists && response.data.url) {
        console.log(`SceneContainer ${sceneId}: Found stored audio at URL: ${response.data.url}`);
        
        // Update the audio source
        setAudioSrc(response.data.url);
        
        // Update the scene data with the audio URL and voice settings
        const updatedAudioData = {
          ...(scene.audio || {}),
          persistentUrl: response.data.url,
          storageKey: response.data.storage_key
        };
        
        // Create default voice settings if none exist
        const voiceSettings = scene.voice_settings || {
          voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default ElevenLabs voice
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0,
          speaker_boost: false,
          speed: 1.0
        };
        
        // Update the scene in the project context
        updateSceneAudio(sceneId, updatedAudioData, voiceSettings);
        console.log(`SceneContainer ${sceneId}: Updated scene with audio data from storage`);
        
        return response.data.url;
      } else {
        console.log(`SceneContainer ${sceneId}: No stored audio found for project ${projectId}, scene ${sceneId}`);
      }
    } catch (err) {
      console.error(`SceneContainer ${sceneId}: Error checking for stored audio:`, err);
    }
  } else {
    console.warn(`SceneContainer ${sceneId}: Cannot retrieve stored audio - no project ID available`);
  }
  
  return null;
};

/**
 * Clean up blob URLs
 * @param audioSrc The audio source URL
 */
export const cleanupAudioUrl = (audioSrc: string | null): void => {
  if (audioSrc && audioSrc.startsWith('blob:')) {
    URL.revokeObjectURL(audioSrc);
  }
}; 