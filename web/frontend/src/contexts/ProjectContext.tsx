'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { useProjectState } from '@/hooks/useProjectState'; // Import the new hook
import { useSceneManagement } from '@/hooks/useSceneManagement'; // Import the new hook
import { useProjectCore, useGetLatestProjectState } from '@/hooks/useProjectCore'; // Ensure useProjectCore is imported
import { useMediaStorage } from '@/hooks/useMediaStorage';
import { useProjectPersistence } from '@/hooks/useProjectPersistence'; // Import the new persistence hook

// Define interfaces for projects and scenes

// Define the nested media object structure
export interface SceneMedia {
  url?: string;                 // Stored URL (e.g., R2 public URL)
  storageKey?: string;          // R2 Storage Key
  thumbnailUrl?: string;        // R2 Thumbnail URL
  type?: 'image' | 'video' | 'gallery'; // Renamed from mediaType
  width?: number;               // Original width (renamed from mediaOriginalWidth)
  height?: number;              // Original height (renamed from mediaOriginalHeight)
  duration?: number;            // Media duration
  aspectRatio?: number;         // Numerical aspect ratio (renamed from mediaAspectRatio)
  isStorageBacked?: boolean;  // Flag indicating media is stored in R2
  storedAt?: number;          // Timestamp (Date.now()) when stored
  // Add any other media-specific properties here
}

export interface Scene {
  id: string;
  title: string;
  mediaUrl?: string;            // Keep original source URL? Or rename to sourceUrl?
  audioUrl?: string;
  content?: string;
  trim?: { start: number; end: number }; // Keep trim separate? Or move into media? (Keep separate for now)
  order: number;
  
  // Remove redundant top-level media properties
  // storedUrl?: string;        // Moved to SceneMedia.url
  // thumbnailUrl?: string;     // Moved to SceneMedia.thumbnailUrl
  // storageKey?: string;       // Moved to SceneMedia.storageKey
  // mediaType?: 'image' | 'video' | 'gallery'; // Moved to SceneMedia.type
  // duration?: number;         // Moved to SceneMedia.duration
  // mediaAspectRatio?: number; // Moved to SceneMedia.aspectRatio
  // mediaOriginalWidth?: number; // Moved to SceneMedia.width
  // mediaOriginalHeight?: number; // Moved to SceneMedia.height

  // Add the nested media object
  media?: SceneMedia;
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
  loadProject: (projectId: string) => Promise<void>;
  addScene: (scene: Partial<Scene>) => Promise<void>;
  updateScene: (sceneId: string, sceneData: Partial<Scene>) => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
  reorderScenes: (sceneIds: string[]) => Promise<void>;
  setProjectAspectRatio: (aspectRatio: '9:16' | '16:9' | '1:1' | '4:5') => void;
  toggleLetterboxing: (show: boolean) => void;
  updateSceneStorageInfo: (sceneId: string, storageKey: string, thumbnailUrl?: string, storedUrl?: string) => Promise<void>;
}

// Create context with default values
const ProjectContext = createContext<ProjectContextState>({
  project: null,
  isLoading: false,
  error: null,
  saveProject: async () => {},
  loadProject: async () => {},
  addScene: async () => {},
  updateScene: async () => {},
  deleteScene: async () => {},
  reorderScenes: async () => {},
  setProjectAspectRatio: () => {},
  toggleLetterboxing: () => {},
  updateSceneStorageInfo: async () => {},
});

// Create provider component
export function ProjectProvider({ children }: { children: ReactNode }) {
  // Use the hook for core state and basic setters
  const {
    project,
    setProject,
    isLoading,
    error,
    setIsLoading,
    setError,
    setProjectAspectRatio,
    toggleLetterboxing
  } = useProjectState(); 

  // Get persistence functions
  const {
    projects: persistedProjects,
    isLoadingProjects,
    persistenceError,
    loadProjectsList, 
    saveProject: saveProjectPersistence, // Rename persistence save
    isSavingProject,
    lastSavedTimestamp,
    loadProject: loadProjectPersistence, // Rename persistence load     
    deleteAllProjects: deleteAllProjectsPersistence, // Rename persistence delete
    projectExists: projectExistsPersistence,    
  } = useProjectPersistence();

  // Get core functions (assuming dispatch and state are handled internally or via useProjectState)
  // const { ... } = useProjectCore(...) // This hook seems removed or unused based on current context, simplify

  // Use the scene management hook, passing state/setters from useProjectState
  const sceneManagement = useSceneManagement({
    project,
    setProject,
    setIsLoading,
    setError
  });
  
  // Get media storage functions
  const { 
    storeMedia: storeMediaFromHook,
    isLoading: isStoringMediaHook, 
    error: mediaStorageErrorHook,
  } = useMediaStorage();

  // --- Sync persistence state with useProjectState --- 
  useEffect(() => {
    setIsLoading(isLoadingProjects);
  }, [isLoadingProjects, setIsLoading]);

  useEffect(() => {
    if (persistenceError) {
      setError(new Error(persistenceError));
    } 
    // Maybe clear error if persistenceError becomes null? Consider reducer approach later.
  }, [persistenceError, setError]);

  useEffect(() => {
    // Sync saving state (if needed, might be internal to persistence hook)
    // setIsLoading(isSavingProject); ? Or a different loading state?
  }, [isSavingProject, setIsLoading]);

  // --- Define Core Actions --- 
  // Mocking load/save here, assuming persistence hook handles the real work
  const loadProject = useCallback(async (projectId: string): Promise<void> => {
      // In a real scenario, this would likely call loadProjectPersistence
      // and then update state via setProject
      console.warn("ProjectProvider.loadProject is mock, using persistence hook is preferred");
      return;
  }, []);

  const saveProject = useCallback(async (projectData: Partial<Project>) => {
      // In a real scenario, this would call saveProjectPersistence 
      // and potentially update state optimistically via setProject
      console.warn("ProjectProvider.saveProject is mock, using persistence hook is preferred");
  }, []); // Add saveProjectPersistence, setProject dependencies if implemented
  
  // === Memoize functions passed to context ===
  const memoizedAddScene = useCallback(sceneManagement.addScene, [sceneManagement]);
  const memoizedUpdateScene = useCallback(sceneManagement.updateScene, [sceneManagement]);
  const memoizedDeleteScene = useCallback(sceneManagement.deleteScene, [sceneManagement]);
  const memoizedReorderScenes = useCallback(sceneManagement.reorderScenes, [sceneManagement]);
  // This is the crucial one - ensure it gets a stable reference
  const memoizedUpdateSceneStorageInfo = useCallback(sceneManagement.updateSceneStorageInfo, [sceneManagement]); 

  const memoizedSetProjectAspectRatio = useCallback(setProjectAspectRatio, [setProjectAspectRatio]);
  const memoizedToggleLetterboxing = useCallback(toggleLetterboxing, [toggleLetterboxing]);

  // Define context value using memoized functions
  const contextValue = useMemo(() => ({
    project, // from useProjectState
    isLoading, // from useProjectState
    error, // from useProjectState
    // Core Actions (using mocks or persistence hook directly)
    saveProject, 
    loadProject,
    // Scene Actions (Memoized)
    addScene: memoizedAddScene, 
    updateScene: memoizedUpdateScene,
    deleteScene: memoizedDeleteScene,
    reorderScenes: memoizedReorderScenes,
    updateSceneStorageInfo: memoizedUpdateSceneStorageInfo,
    // Settings Actions (Memoized)
    setProjectAspectRatio: memoizedSetProjectAspectRatio,
    toggleLetterboxing: memoizedToggleLetterboxing,
    // Add other functions/state from persistence/other hooks if needed by consumers
    // e.g., isSavingProject, lastSavedTimestamp? 
  }), [
    // List all dependencies for useMemo
    project, isLoading, error, 
    saveProject, loadProject, 
    memoizedAddScene, memoizedUpdateScene, memoizedDeleteScene, memoizedReorderScenes, memoizedUpdateSceneStorageInfo,
    memoizedSetProjectAspectRatio, memoizedToggleLetterboxing
  ]);

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
}

// Custom hook for using the project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}

// Helper function to generate unique IDs (if needed elsewhere)
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
}; 