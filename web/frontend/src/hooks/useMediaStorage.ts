import { useState, useCallback } from 'react';
// import apiClient from '@/lib/api-client'; // No default export
import { storeMediaContent, MediaStorageRequest, MediaStorageResponse } from '@/lib/api-client';
import { ApiResponse } from '@/lib/api-types'; // Import ApiResponse from the correct location
// Import the project context hook
import { useProject } from '@/contexts/ProjectContext';

// Match the request interface from api-client.ts
interface MediaStorageParams extends Omit<MediaStorageRequest, 'project_id' | 'scene_id'> { // Omit IDs, they might be handled differently or added within the hook
  projectId: string;
  sceneId: string; // Making sceneId required for now, adjust if batching is needed differently
  url: string;
  media_type?: string;
  create_thumbnail?: boolean;
}

interface UseMediaStorageReturn {
  storeMedia: (params: MediaStorageParams) => Promise<ApiResponse<MediaStorageResponse>>; // Use specific API response type
  isLoading: boolean;
  error: Error | null; // Keep general Error type for hook-level errors
}

/**
 * Custom hook for handling media storage operations via the backend API.
 * Encapsulates logic for storing media for individual scenes.
 *
 * @returns {UseMediaStorageReturn} Object containing the storeMedia function, loading state, and error state.
 */
export function useMediaStorage(): UseMediaStorageReturn {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  // Get the context function to update scene storage info
  const { updateSceneStorageInfo } = useProject();

  const storeMedia = useCallback(async (params: MediaStorageParams): Promise<ApiResponse<MediaStorageResponse>> => {
    setIsLoading(true);
    setError(null);
    try {
      // Prepare the request data conforming to MediaStorageRequest
      const requestData: MediaStorageRequest = {
        project_id: params.projectId,
        scene_id: params.sceneId,
        url: params.url,
        media_type: params.media_type,
        create_thumbnail: params.create_thumbnail,
      };

      console.log('Calling storeMediaContent with:', requestData); // Log before API call
      const response = await storeMediaContent(requestData);
      console.log('storeMediaContent response:', response); // Log response

      if (response.error) {
        // Throw an error that can be caught locally if needed, but also set state
        const apiError = new Error(response.error.message || 'API error storing media');
        setError(apiError);
        throw apiError;
      }

      // ----> ADDED: Update project context state upon success <----
      if (response.data?.storage_key) {
        try {
          // Call the context function to update the specific scene
          await updateSceneStorageInfo(
            params.sceneId, // Pass the sceneId from the initial params
            response.data.storage_key,
            response.data.thumbnail_url, // Pass thumbnail if available
            response.data.url // Pass the public R2 URL
          );
          console.log(`[useMediaStorage] Dispatched updateSceneStorageInfo for scene ${params.sceneId}`);
        } catch (contextError) {
           // Log context update errors separately if needed
          console.error(`[useMediaStorage] Error updating context for scene ${params.sceneId}:`, contextError);
           // Decide if this should also set the hook's error state or re-throw
        }
      }
      // ----> END ADDED SECTION <----

      return response;
    } catch (err) {
      console.error('Error in useMediaStorage hook:', err);
      // Ensure error state is set even if storeMediaContent itself throws
      const fetchError = err instanceof Error ? err : new Error('Failed to store media');
      if (!error) { // Avoid overwriting specific API error if already set
          setError(fetchError);
      }
      // Re-throw error for the caller to handle if needed
      throw fetchError; 
    } finally {
      setIsLoading(false);
    }
  }, [error, updateSceneStorageInfo]);

  return { storeMedia, isLoading, error };
}

export default useMediaStorage; 