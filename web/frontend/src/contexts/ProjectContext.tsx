'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useProjectState } from '@/hooks/useProjectState';
import { useSceneManagement } from '@/hooks/useSceneManagement';
import { useProjectApi } from '@/hooks/useProjectApi'; // Import project API hook

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

  // Use the scene management hook
  const {
    addScene,
    updateScene,
    deleteScene,
    reorderScenes
  } = useSceneManagement({ project, setProject, setIsLoading, setError });

  // Use the project API hook
  const {
    loadProject,
    saveProject
  } = useProjectApi({ setProject, setIsLoading, setError });

  // REMOVED: Load project data function now in useProjectApi hook
  // const loadProject = async (...) => { ... };

  // REMOVED: Save project data function now in useProjectApi hook
  // const saveProject = async (...) => { ... };

  // REMOVED: Scene management functions now in useSceneManagement hook
  // ...

  // Define context value
  const value = {
    project,
    isLoading,
    error,
    saveProject,  // From useProjectApi hook
    addScene,     // From useSceneManagement hook
    updateScene,  // From useSceneManagement hook
    deleteScene,  // From useSceneManagement hook
    reorderScenes,// From useSceneManagement hook
    loadProject,    // From useProjectApi hook
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