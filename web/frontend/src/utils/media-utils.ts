import { MediaType } from '../types/Media';
import { Scene } from '../components/project/ProjectTypes';
import { SceneMedia } from '../types/Scene';
import { MediaStorageRequest } from '../lib/api-client';
import { MediaStorageResponse, storeMediaContent } from '../lib/api-client';

// Define SceneMedia type inline to avoid dependencies
// export interface SceneMedia {
// ... existing code ...
// }

/**
 * Store scene media content to R2 storage via the backend API
 * 
 * @param scene - The scene object
 * @param projectId - The ID of the project 
 * @param mongoDbId - The actual MongoDB _id
 * @param updateSceneMediaCallback - Optional callback to update scene media
 * @returns Promise with the storage result
 */
export const storeSceneMedia = async (
  scene: Scene,
  projectId: string,
  mongoDbId: string,
  updateSceneMediaCallback?: (sceneId: string, mediaData: Partial<SceneMedia>) => void
): Promise<{
  success: boolean;
  url?: string;
  storageKey?: string;
  error?: string;
}> => {
  // Extract needed data from the scene object
  const sceneId = scene.id;
  const media = scene.media;
  
  // Log with extracted values
  console.log(`[MEDIA-UTILS] Storing scene media for project ${projectId}, scene ${sceneId}`);
  
  // Ensure media object exists before proceeding
  if (!media) {
    console.warn(`[MEDIA-UTILS] No media object found in scene ${sceneId}`);
    return {
      success: false,
      error: 'No media object found in scene'
    };
  }
  
  console.log(`[MEDIA-UTILS] Media details:`, {
    type: media.type,
    url: media.url,
    hasExistingStoredUrl: !!media.storedUrl,
    hasExistingStorageKey: !!media.storageKey
  });

  // Don't re-store if we already have stored media
  if (media.storedUrl && media.storageKey) {
    console.log(`[MEDIA-UTILS] Media already stored, skipping storage: ${media.storageKey}`);
    return {
      success: true,
      url: media.storedUrl,
      storageKey: media.storageKey
    };
  }

  // If no URL, can't store anything
  if (!media.url) {
    console.warn(`[MEDIA-UTILS] No media URL to store for scene ${sceneId}`);
    return {
      success: false,
      error: 'No media URL to store'
    };
  }

  try {
    console.log(`[MEDIA-UTILS] Calling storeMediaContent API for ${media.url}`);
    
    // Build the storage request object
    const storageRequest: MediaStorageRequest = {
      url: scene.media?.url || '',
      project_id: projectId,
      mongo_db_id: mongoDbId,
      scene_id: scene.id,
      user_id: "local_test_user",
      media_type: media.type,
      create_thumbnail: media.type === 'image' || media.type === 'video',
    };
    
    // Log details of the storage request
    console.log(`[MEDIA-UTILS] Storage request details:`, JSON.stringify(storageRequest, null, 2));
    
    // Call API to store media
    const response = await storeMediaContent(storageRequest);
    
    // Log the API response for debugging
    console.log(`[MEDIA-UTILS] Storage API response:`, {
      success: !!response.data?.success,
      hasError: !!response.error,
      url: response.data?.url,
      storageKey: response.data?.storage_key,
      responseTime: response.timing?.duration || 0,
      statusCode: response.connectionInfo?.status
    });

    // Handle API error
    if (response.error) {
      console.error(`[MEDIA-UTILS] Error storing media: ${response.error.message}`);
      return {
        success: false,
        error: response.error.message
      };
    }

    // Handle successful response
    const mediaData = response.data;
    if (mediaData && mediaData.success && mediaData.url && mediaData.storage_key) {
      console.log(`[MEDIA-UTILS] Media stored successfully:`, {
        url: mediaData.url,
        storageKey: mediaData.storage_key
      });
      
      // Update scene media
      if (updateSceneMediaCallback) {
        updateSceneMediaCallback(sceneId, {
          url: mediaData.url,
          storageKey: mediaData.storage_key
        });
      }
      
      return {
        success: true,
        url: mediaData.url,
        storageKey: mediaData.storage_key
      };
    }

    // Handle case where API returns success but missing data
    console.warn(`[MEDIA-UTILS] API returned success but missing data:`, mediaData);
    return {
      success: false,
      error: 'Server returned success but missing URL or storage key'
    };
  } catch (error) {
    // Log and return detailed error
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MEDIA-UTILS] Exception storing media: ${errorMessage}`);
    return {
      success: false,
      error: `Failed to store media: ${errorMessage}`
    };
  }
}; 