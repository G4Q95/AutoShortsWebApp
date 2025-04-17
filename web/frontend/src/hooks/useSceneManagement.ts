'use client';

import { useCallback } from 'react';
import { Project, Scene } from '@/contexts/ProjectContext'; // Assuming types are exported from context

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

      // Create new scene with generated ID
      const newScene: Scene = {
        id: `scene${Date.now()}`, // Replace with better ID generation if needed
        title: sceneData.title || "New Scene",
        order: project.scenes.length, // Default order
        // Sensible defaults - ensure all required fields are present
        mediaUrl: sceneData.mediaUrl,
        audioUrl: sceneData.audioUrl,
        content: sceneData.content,
        mediaType: sceneData.mediaType || 'image',
        trim: sceneData.trim,
        duration: sceneData.duration || 5, // Default duration
        mediaAspectRatio: sceneData.mediaAspectRatio,
        mediaOriginalWidth: sceneData.mediaOriginalWidth,
        mediaOriginalHeight: sceneData.mediaOriginalHeight,
        ...sceneData // Spread last to allow overrides
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
          scenes: prev.scenes.map(scene =>
            scene.id === sceneId ? { ...scene, ...sceneData } : scene
          ).sort((a, b) => a.order - b.order), // Ensure order is maintained
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      console.error(`[useSceneManagement] Error updating scene ${sceneId}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]);

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


  return {
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
  };
} 