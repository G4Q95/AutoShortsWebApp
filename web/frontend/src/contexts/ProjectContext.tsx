'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Define interfaces for projects and scenes
export interface Scene {
  id: string;
  title: string;
  mediaUrl?: string;
  audioUrl?: string;
  content?: string;
  mediaType?: 'image' | 'video' | 'gallery';
  trim?: { start: number; end: number };
  duration?: number;
  order: number;
  
  // New fields for aspect ratio support
  mediaAspectRatio?: number;        // Numerical ratio (e.g., 1.78 for 16:9)
  mediaOriginalWidth?: number;      // Original width in pixels
  mediaOriginalHeight?: number;     // Original height in pixels
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'processing' | 'completed';
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';  // Project-wide aspect ratio setting
  showLetterboxing: boolean;  // Whether to show letterboxing in preview
}

// Define the context state interface
interface ProjectContextState {
  project: Project | null;
  isLoading: boolean;
  error: Error | null;
  saveProject: (projectData: Partial<Project>) => Promise<void>;
  addScene: (scene: Partial<Scene>) => Promise<void>;
  updateScene: (sceneId: string, sceneData: Partial<Scene>) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  reorderScenes: (sceneIds: string[]) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  setProjectAspectRatio: (aspectRatio: '9:16' | '16:9' | '1:1' | '4:5') => void;
  toggleLetterboxing: (show: boolean) => void;
}

// Create context with default values
const ProjectContext = createContext<ProjectContextState>({
  project: null,
  isLoading: false,
  error: null,
  saveProject: async () => {},
  addScene: async () => {},
  updateScene: async () => {},
  deleteScene: async () => {},
  reorderScenes: async () => {},
  loadProject: async () => {},
  setProjectAspectRatio: () => {},
  toggleLetterboxing: () => {},
});

// Create provider component
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Load project data
  const loadProject = async (projectId: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock implementation - replace with actual API call
      console.log(`Loading project ${projectId}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock project data
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
        aspectRatio: "16:9",
        showLetterboxing: true
      };
      
      setProject(mockProject);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Save project data
  const saveProject = async (projectData: Partial<Project>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock implementation - replace with actual API call
      console.log("Saving project:", projectData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
      setProject(prev => 
        prev ? { ...prev, ...projectData, updatedAt: new Date().toISOString() } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new scene
  const addScene = async (sceneData: Partial<Scene>) => {
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
      
      // Update local state
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
  };

  // Update an existing scene
  const updateScene = async (sceneId: string, sceneData: Partial<Scene>) => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!project) {
        throw new Error("No project loaded");
      }
      
      // Mock implementation - replace with actual API call
      console.log(`Updating scene ${sceneId}:`, sceneData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state
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
  };

  // Delete a scene
  const deleteScene = async (sceneId: string) => {
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
      
      // Update local state
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
  };

  // Reorder scenes
  const reorderScenes = async (sceneIds: string[]) => {
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
      
      // Update local state
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
  };

  // Set project aspect ratio
  const setProjectAspectRatio = (aspectRatio: '9:16' | '16:9' | '1:1' | '4:5') => {
    setProject(prev => prev ? { ...prev, aspectRatio } : null);
  };

  // Toggle letterboxing
  const toggleLetterboxing = (show: boolean) => {
    setProject(prev => prev ? { ...prev, showLetterboxing: show } : null);
  };

  // Value for the context provider
  const contextValue = {
    project,
    isLoading,
    error,
    loadProject,
    saveProject,
    addScene,
    updateScene,
    deleteScene,
    reorderScenes,
    setProjectAspectRatio,
    toggleLetterboxing
  };

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook for using the project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
} 