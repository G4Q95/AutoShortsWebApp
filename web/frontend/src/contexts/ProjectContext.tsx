'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useProjectState } from '@/hooks/useProjectState'; // Import the new hook
import { useSceneManagement } from '@/hooks/useSceneManagement'; // Import scene hook

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
  isLoading: false, // Match initial state from useProjectState if different
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
  // Use the state hook
  const {
    project,
    isLoading,
    error,
    setProject,
    setIsLoading,
    setError,
    setProjectAspectRatio,
    toggleLetterboxing
  } = useProjectState();

  // Use the scene management hook, passing state and setters
  const {
    addScene,
    updateScene,
    deleteScene,
    reorderScenes
  } = useSceneManagement({ project, setProject, setIsLoading, setError });

  // Load project data - Stays here for now
  const loadProject = async (projectId: string) => {
    // This function will need access to setProject, setIsLoading, setError from the hook
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
        aspectRatio: "16:9", // Default or loaded aspect ratio
        showLetterboxing: true
      };
      
      setProject(mockProject);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // Save project data - Stays here for now
  const saveProject = async (projectData: Partial<Project>) => {
    // This function will need access to setProject, setIsLoading, setError from the hook
    try {
      setIsLoading(true);
      setError(null);
      
      // Mock implementation - replace with actual API call
      console.log("Saving project:", projectData);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update local state using the setter from the hook
      setProject(prev => 
        prev ? { ...prev, ...projectData, updatedAt: new Date().toISOString() } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  };

  // REMOVED: Scene management functions now in useSceneManagement hook
  // const addScene = async (...) => { ... };
  // const updateScene = async (...) => { ... };
  // const deleteScene = async (...) => { ... };
  // const reorderScenes = async (...) => { ... };

  // Define context value
  const value = {
    project,
    isLoading,
    error,
    saveProject,  // Stays
    addScene,     // From useSceneManagement hook
    updateScene,  // From useSceneManagement hook
    deleteScene,  // From useSceneManagement hook
    reorderScenes,// From useSceneManagement hook
    loadProject,    // Stays
    setProjectAspectRatio, // From useProjectState hook
    toggleLetterboxing,    // From useProjectState hook
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

// Custom hook for using the project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
} 