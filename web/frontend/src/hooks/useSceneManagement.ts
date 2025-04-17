'use client';

import { useCallback } from 'react';
// Revert back to importing from Context
import { Project, Scene, SceneMedia } from '@/contexts/ProjectContext'; 
// Import SceneMedia type explicitly if needed, or rely on Scene['media']
// It seems Scene['media'] might not be directly usable here, let's adjust
// Assuming Scene type is correctly imported above

// Define the props for the hook
interface UseSceneManagementProps {
  project: Project | null;
  setProject: (updater: (prev: Project | null) => Project | null) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;
}

// Define the return type of the hook
interface UseSceneManagementReturn {
  addScene: (sceneData: Partial<Scene>) => Promise<void>;
  updateScene: (sceneId: string, sceneData: Partial<Scene>) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  reorderScenes: (sceneIds: string[]) => Promise<void>;
  updateSceneStorageInfo: (sceneId: string, storageKey: string, thumbnailUrl?: string, storedUrl?: string) => Promise<void>;
}

export function useSceneManagement({
  project,
  setProject,
  setIsLoading,
  setError
}: UseSceneManagementProps): UseSceneManagementReturn {

  // Add a new scene
  const addScene = useCallback(async (sceneData: Partial<Scene>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!project) {
        throw new Error("No project loaded");
      }

      // Mock implementation - replace with actual API call
      console.log("[useSceneManagement] Adding scene:", sceneData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create new scene with generated ID and nested media
      const newScene: Scene = {
        id: `scene${Date.now()}`, 
        title: sceneData.title || "New Scene",
        order: project.scenes.length, 
        mediaUrl: sceneData.mediaUrl, // Keep original URL top-level
        audioUrl: sceneData.audioUrl,
        content: sceneData.content,
        trim: sceneData.trim,
        
        // Initialize nested media object from sceneData if provided
        media: {
          type: sceneData.media?.type || 'image', // Default to image if not provided
          url: sceneData.media?.url,
          storageKey: sceneData.media?.storageKey,
          thumbnailUrl: sceneData.media?.thumbnailUrl,
          duration: sceneData.media?.duration || 5, // Default duration
          width: sceneData.media?.width,
          height: sceneData.media?.height,
          aspectRatio: sceneData.media?.aspectRatio,
          // Add other media fields if necessary
        },
        // Spread other top-level sceneData properties (like order, title if overridden)
        // Make sure not to spread the entire sceneData object if it contains old top-level media keys
        ...{ 
            ...(sceneData.title && { title: sceneData.title }),
            ...(sceneData.order !== undefined && { order: sceneData.order }),
            ...(sceneData.mediaUrl && { mediaUrl: sceneData.mediaUrl }),
            ...(sceneData.audioUrl && { audioUrl: sceneData.audioUrl }),
            ...(sceneData.content && { content: sceneData.content }),
            ...(sceneData.trim && { trim: sceneData.trim }),
            // Explicitly ignore old top-level keys if they exist on sceneData
        }
      };

      // Update local state using the provided setter
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: [...prev.scenes, newScene].sort((a, b) => a.order - b.order), // Ensure order is maintained
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      console.error("[useSceneManagement] Error adding scene:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]);

  // Update an existing scene
  const updateScene = useCallback(async (sceneId: string, sceneData: Partial<Scene>) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!project) {
        throw new Error("No project loaded");
      }

      // Mock implementation - replace with actual API call
      console.log(`[useSceneManagement] Updating scene ${sceneId}:`, sceneData);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update local state using the provided setter
      setProject(prev => {
        if (!prev) return null;
        const sceneExists = prev.scenes.some(scene => scene.id === sceneId);
        if (!sceneExists) {
             console.warn(`[useSceneManagement] Attempted to update non-existent scene ID: ${sceneId}`);
             // Optionally throw an error or just return previous state
             // throw new Error(`Scene with ID ${sceneId} not found for update.`);
             return prev; // Return previous state if scene not found
        }
        return {
          ...prev,
          scenes: prev.scenes.map(scene => {
            if (scene.id === sceneId) {
              // Create updated scene object, merging carefully
              const updatedScene = {
                ...scene, // Start with existing scene
                // Update top-level fields if provided in sceneData
                ...(sceneData.title && { title: sceneData.title }),
                ...(sceneData.order !== undefined && { order: sceneData.order }),
                ...(sceneData.mediaUrl && { mediaUrl: sceneData.mediaUrl }),
                ...(sceneData.audioUrl && { audioUrl: sceneData.audioUrl }),
                ...(sceneData.content && { content: sceneData.content }),
                ...(sceneData.trim && { trim: sceneData.trim }),
                
                // Merge media object if provided in sceneData
                media: sceneData.media 
                  ? { ...(scene.media || {}), ...sceneData.media } 
                  : scene.media, // Keep existing media if not updated
              };
              return updatedScene;
            }
            return scene;
          }).sort((a, b) => a.order - b.order), // Ensure order is maintained
          updatedAt: new Date().toISOString()
        };
      });

      // --- End Optimistic UI Update ---
      // Add logging AFTER the state update is applied
      setProject(prev => {
        if(prev) {
          const updatedScene = prev.scenes.find(s => s.id === sceneId);
          console.log(`[DEBUG][updateScene] Local state updated for ${sceneId}. New Trim:`, updatedScene?.trim);
        }
        return prev; // Important: return the state unmodified here
      });

      // NOTE: Original implementation had no API call here.
      // Persistence is handled by auto-save in ProjectProvider.
      
    } catch (err) {
      console.error(`[useSceneManagement] Error updating scene ${sceneId}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject]); // Removed setIsLoading, setError if not used in reverted version

  // Delete a scene
  const deleteScene = useCallback(async (sceneId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!project) {
        throw new Error("No project loaded");
      }

      // Mock implementation - replace with actual API call
      console.log(`[useSceneManagement] Deleting scene ${sceneId}`);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update local state using the provided setter
      setProject(prev => {
        if (!prev) return null;

        // Remove the scene
        const filteredScenes = prev.scenes.filter(scene => scene.id !== sceneId);

        // Reorder remaining scenes based on their original order
        const reorderedScenes = filteredScenes
            .sort((a, b) => a.order - b.order) // Sort first by original order
            .map((scene, index) => ({ // Then assign new sequential order
               ...scene,
               order: index
             }));


        return {
          ...prev,
          scenes: reorderedScenes,
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      console.error(`[useSceneManagement] Error deleting scene ${sceneId}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]);

  // Reorder scenes
  const reorderScenes = useCallback(async (orderedSceneIds: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!project) {
        throw new Error("No project loaded");
      }

      // Mock implementation - replace with actual API call
      console.log("[useSceneManagement] Reordering scenes:", orderedSceneIds);

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Update local state using the provided setter
      setProject(prev => {
        if (!prev) return null;

        // Create a map for quick scene lookup
        const sceneMap = new Map(prev.scenes.map(scene => [scene.id, scene]));

        // Create reordered scene array based on the provided IDs
        const reorderedScenes = orderedSceneIds.map((id, index) => {
          const scene = sceneMap.get(id);
          if (!scene) {
            // This case should ideally not happen if orderedSceneIds are derived correctly
            console.error(`[useSceneManagement] Scene with ID ${id} not found during reorder.`);
            throw new Error(`Scene with ID ${id} not found during reorder.`);
          }
          return { ...scene, order: index }; // Assign new order based on index in the array
        });

         // Ensure all original scenes are accounted for (sanity check)
         if (reorderedScenes.length !== prev.scenes.length) {
             console.warn("[useSceneManagement] Mismatch in scene count during reorder. Check input IDs.");
             // Decide handling: throw error, return prev state, etc.
             // For now, we'll proceed but log a warning.
         }


        return {
          ...prev,
          scenes: reorderedScenes, // Already ordered correctly by the map operation
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      console.error("[useSceneManagement] Error reordering scenes:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]);

  // Add the new function to update storage info
  const updateSceneStorageInfo = useCallback(async (
    sceneId: string, 
    storageKey: string, 
    thumbnailUrl?: string,
    storedUrl?: string
  ) => {
    console.log(`[useSceneManagement] Updating storage info for scene ${sceneId} with key: ${storageKey}, storedURL: ${storedUrl}, thumb: ${thumbnailUrl}`);
    setProject(prev => {
      if (!prev) return null;

      const updatedScenes = prev.scenes.map(scene => {
        if (scene.id === sceneId) {
          // Log before updating the scene
          console.log(`[useSceneManagement] Found scene ${sceneId}. Current scene data:`, scene);
          
          // Create or update the nested media object
          const updatedMedia: SceneMedia = {
            ...(scene.media || {}), // Spread existing media properties first, or start with empty object
            storageKey: storageKey,      // Add/Update storageKey
            thumbnailUrl: thumbnailUrl,    // Add/Update thumbnailUrl
            url: storedUrl,              // Add/Update the stored R2 URL as 'url'
          };

          console.log(`[useSceneManagement] Updated media object for scene ${sceneId}:`, updatedMedia);

          // Return the updated scene with the nested media object
          return {
            ...scene,
            media: updatedMedia,
          };
        }
        return scene;
      });

      // Log the entire scenes array after the update attempt
      console.log(`[useSceneManagement] Scenes array after nested media update for ${sceneId}:`, updatedScenes);

      return {
        ...prev,
        scenes: updatedScenes,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [setProject]); // Dependency array only needs setProject

  return {
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    updateSceneStorageInfo,
  };
} 