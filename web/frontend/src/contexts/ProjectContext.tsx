'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useProjectState } from '@/hooks/useProjectState'; // Import the new hook
import { useSceneManagement } from '@/hooks/useSceneManagement'; // Import the new hook

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
    isLoading,
    error,
    setProject,
    setIsLoading,
    setError,
    setProjectAspectRatio,
    toggleLetterboxing
  } = useProjectState();

  // Use the new hook for scene actions
  const sceneManagement = useSceneManagement({
    project,
    setProject,
    setIsLoading,
    setError
  });

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
            mediaUrl: "https://example.com/media/1.mp4", // Original URL
            content: "This is the introduction scene",
            order: 0,
            trim: { start: 0, end: 10 },
            media: {
              type: "video", // Use nested type
              duration: 10, // Use nested duration
              url: "https://example.com/media/processed/1.mp4", // Example stored URL
              storageKey: "mock-storage-key-1",
              width: 1920,
              height: 1080,
              aspectRatio: 16/9
            }
          },
          {
            id: "scene2",
            title: "Main Content",
            mediaUrl: "https://example.com/media/2.jpg", // Original URL
            content: "This is the main content scene",
            order: 1,
            media: {
              type: "image", // Use nested type
              duration: 5,  // Use nested duration (maybe less relevant for images, but for consistency)
              url: "https://example.com/media/processed/2.jpg", // Example stored URL
              storageKey: "mock-storage-key-2",
              width: 800,
              height: 600,
              aspectRatio: 4/3
            }
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

  // Define context value
  const contextValue = {
    project,
    isLoading,
    error,
    saveProject,
    loadProject,
    addScene: sceneManagement.addScene,
    updateScene: sceneManagement.updateScene,
    deleteScene: sceneManagement.deleteScene,
    reorderScenes: sceneManagement.reorderScenes,
    setProjectAspectRatio,
    toggleLetterboxing,
    updateSceneStorageInfo: sceneManagement.updateSceneStorageInfo,
  };

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