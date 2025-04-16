import { useCallback } from 'react';
import { Project, Scene } from '@/contexts/ProjectContext'; // Import types

// Define the props the hook will accept
interface UseSceneManagementProps {
  project: Project | null;
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
}

export function useSceneManagement({
  project,
  setProject,
  setIsLoading,
  setError,
}: UseSceneManagementProps) {
  // Add a new scene
  const addScene = useCallback(async (sceneData: Partial<Scene>) => {
    // Uses project, setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      if (!project) {
        throw new Error("No project loaded");
      }
      
      // Mock implementation - replace with actual API call
      console.log("Adding scene:", sceneData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create new scene with generated ID
      const newScene: Scene = {
        id: `scene${Date.now()}`,
        title: sceneData.title || "New Scene",
        mediaUrl: sceneData.mediaUrl,
        audioUrl: sceneData.audioUrl,
        content: sceneData.content,
        mediaType: sceneData.mediaType || "image",
        trim: sceneData.trim,
        duration: sceneData.duration || 5,
        order: project.scenes.length,
        ...sceneData
      };
      
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: [...prev.scenes, newScene],
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]); // Added dependencies

  // Update an existing scene
  const updateScene = useCallback(async (sceneId: string, sceneData: Partial<Scene>) => {
    // Uses setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      if (!project) { // Check against the project from props
        throw new Error("No project loaded");
      }
      
      // Mock implementation - replace with actual API call
      console.log(`Updating scene ${sceneId}:`, sceneData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: prev.scenes.map(scene => 
            scene.id === sceneId ? { ...scene, ...sceneData } : scene
          ),
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]); // Added dependencies

  // Delete a scene
  const deleteScene = useCallback(async (sceneId: string) => {
    // Uses project, setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      if (!project) {
        throw new Error("No project loaded");
      }
      
      // Mock implementation - replace with actual API call
      console.log(`Deleting scene ${sceneId}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setProject(prev => {
        if (!prev) return null;
        
        // Remove the scene
        const filteredScenes = prev.scenes.filter(scene => scene.id !== sceneId);
        
        // Reorder remaining scenes
        const reorderedScenes = filteredScenes.map((scene, index) => ({
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
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]); // Added dependencies

  // Reorder scenes
  const reorderScenes = useCallback(async (sceneIds: string[]) => {
    // Uses project, setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      if (!project) {
        throw new Error("No project loaded");
      }
      
      // Mock implementation - replace with actual API call
      console.log("Reordering scenes:", sceneIds);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Create a map for quick scene lookup
      const sceneMap = new Map(project.scenes.map(scene => [scene.id, scene]));
      
      // Create reordered scene array
      const reorderedScenes = sceneIds.map((id, index) => {
        const scene = sceneMap.get(id);
        if (!scene) {
          throw new Error(`Scene with ID ${id} not found`);
        }
        return { ...scene, order: index };
      });
      
      setProject(prev => {
        if (!prev) return null;
        return {
          ...prev,
          scenes: reorderedScenes,
          updatedAt: new Date().toISOString()
        };
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [project, setProject, setIsLoading, setError]); // Added dependencies

  // Return the functions
  return {
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
  };
} 