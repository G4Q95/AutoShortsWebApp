import { useState, useCallback } from 'react';
// import apiClient from '@/lib/api-client'; // No default export
import { storeMediaContent, MediaStorageRequest, MediaStorageResponse } from '@/lib/api-client';
import { ApiResponse } from '@/lib/api-types'; // Import ApiResponse from the correct location

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
  }, [error]); // Added error to dependency array

  return { storeMedia, isLoading, error };
}

export default useMediaStorage; 