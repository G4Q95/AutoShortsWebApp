import { useCallback } from 'react';
import { Project } from '@/contexts/ProjectContext'; // Import types

// Define the props the hook will accept
interface UseProjectApiProps {
  setProject: React.Dispatch<React.SetStateAction<Project | null>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<Error | null>>;
}

export function useProjectApi({
  setProject,
  setIsLoading,
  setError,
}: UseProjectApiProps) {

  // Load project data
  const loadProject = useCallback(async (projectId: string) => {
    // Uses setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock implementation - replace with actual API call
      console.log(`Loading project ${projectId}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock project data (This should eventually come from the API)
      const mockProject: Project = {
        id: projectId,
        title: "Sample Project",
        description: "This is a sample project",
        scenes: [
          {
            id: "scene1",
            title: "Introduction",
            mediaUrl: "https://example.com/media/1.mp4",
            mediaType: "video",
            content: "This is the introduction scene",
            order: 0,
            trim: { start: 0, end: 10 },
            duration: 10
          },
          {
            id: "scene2",
            title: "Main Content",
            mediaUrl: "https://example.com/media/2.jpg",
            mediaType: "image",
            content: "This is the main content scene",
            order: 1,
            duration: 5
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: "draft",
        aspectRatio: "16:9", // Default or loaded aspect ratio
        showLetterboxing: true
      };
      
      setProject(mockProject);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [setProject, setIsLoading, setError]); // Added dependencies

  // Save project data
  const saveProject = useCallback(async (projectData: Partial<Project>) => {
    // Uses setIsLoading, setError, setProject
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock implementation - replace with actual API call
      console.log("Saving project:", projectData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state (This might change depending on API response)
      setProject(prev => 
        prev ? { ...prev, ...projectData, updatedAt: new Date().toISOString() } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [setProject, setIsLoading, setError]); // Added dependencies

  // Return the functions
  return {
    loadProject,
    saveProject,
  };
} 