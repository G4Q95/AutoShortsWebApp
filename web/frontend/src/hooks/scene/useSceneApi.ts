import { useCallback, useState } from 'react';
import { updateScene } from '@/lib/api/projects';
import { Scene } from '@/components/project/ProjectTypes';
import { ApiResponse } from '@/lib/api-types';
import { Project } from '@/components/project/ProjectTypes';

/**
 * Hook for managing API interactions related to a Scene
 */
export function useSceneApi(scene: Scene, projectId: string) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  /**
   * Saves scene updates to the backend API
   */
  const saveSceneUpdate = useCallback(
    async (updates: Partial<Scene>) => {
      if (!scene || !scene.id) {
        setApiError('Cannot update: Invalid scene data');
        return { success: false };
      }

      try {
        setIsUpdating(true);
        setApiError(null);
        
        const response: ApiResponse<Project> = await updateScene(projectId, scene.id, updates);
        
        setIsUpdating(false);
        
        if (response.error) {
          setApiError(response.error.message);
          return { success: false, error: response.error.message };
        }
        
        return { success: true, data: response.data };
      } catch (error) {
        setIsUpdating(false);
        const errorMessage = error instanceof Error 
          ? error.message 
          : 'Failed to update scene';
        
        setApiError(errorMessage);
        console.error('Error updating scene:', error);
        return { success: false, error: errorMessage };
      }
    },
    [projectId, scene]
  );

  /**
   * Clears any API errors
   */
  const clearApiError = useCallback(() => {
    setApiError(null);
  }, []);

  return {
    isUpdating,
    apiError,
    saveSceneUpdate,
    clearApiError
  };
} 