import { MediaStorageResponse, storeMediaContent } from '../lib/api-client';

// Define SceneMedia type inline to avoid dependencies
interface SceneMedia {
  url: string;
  type: 'image' | 'video' | 'gallery';
  storedUrl?: string;
  storageKey?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  isStoring?: boolean;
  hasStored?: boolean;
}

/**
 * Store scene media content to R2 storage via the backend API
 * 
 * @param projectId - The ID of the project 
 * @param sceneId - The ID of the scene
 * @param media - The media data to store
 * @returns Promise with the storage result
 */
export const storeSceneMedia = async (
  projectId: string,
  sceneId: string,
  media: SceneMedia
): Promise<{
  success: boolean;
  url?: string;
  storageKey?: string;
  error?: string;
}> => {
  console.log(`[MEDIA-UTILS] Storing scene media for project ${projectId}, scene ${sceneId}`);
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
    
    // Request object for storing media content
    const storageRequest = {
      url: media.url,
      project_id: projectId,
      scene_id: sceneId,
      media_type: media.type,
      create_thumbnail: true
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