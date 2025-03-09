'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { extractContent } from '../../lib/api-client';

// Define the structure of a scene 
export interface Scene {
  id: string;
  url: string;
  media?: {
    type: 'image' | 'video' | 'gallery';
    url: string;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    duration?: number;
  };
  text: string;
  source: {
    author?: string;
    subreddit?: string;
    platform: string;
  };
  createdAt: number;
  isLoading?: boolean;
  error?: string;
}

// Define project state interface
export interface Project {
  id: string;
  title: string;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'processing' | 'completed' | 'error';
}

// Project context state
interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

// Initial state
const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null
};

// Action types
type ProjectAction =
  | { type: 'CREATE_PROJECT'; payload: { title: string } }
  | { type: 'SET_CURRENT_PROJECT'; payload: { projectId: string } }
  | { type: 'ADD_SCENE'; payload: { url: string } }
  | { type: 'ADD_SCENE_LOADING'; payload: { sceneId: string; url: string } }
  | { type: 'ADD_SCENE_SUCCESS'; payload: { sceneId: string; sceneData: Partial<Scene> } } 
  | { type: 'ADD_SCENE_ERROR'; payload: { sceneId: string; error: string } }
  | { type: 'REMOVE_SCENE'; payload: { sceneId: string } }
  | { type: 'REORDER_SCENES'; payload: { sceneIds: string[] } }
  | { type: 'UPDATE_SCENE_TEXT'; payload: { sceneId: string; text: string } }
  | { type: 'SET_PROJECT_TITLE'; payload: { title: string } }
  | { type: 'SET_ERROR'; payload: { error: string } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } };

// Helper to generate unique IDs
const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Project reducer
function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'CREATE_PROJECT': {
      const newProject: Project = {
        id: generateId(),
        title: action.payload.title,
        scenes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'draft'
      };
      
      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
        error: null
      };
    }
    
    case 'SET_CURRENT_PROJECT': {
      const project = state.projects.find(p => p.id === action.payload.projectId) || null;
      return {
        ...state,
        currentProject: project,
        error: project ? null : 'Project not found'
      };
    }
    
    case 'ADD_SCENE_LOADING': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to'
        };
      }
      
      const newScene: Scene = {
        id: action.payload.sceneId,
        url: action.payload.url,
        text: '',
        source: {
          platform: 'reddit' // Default to reddit for now
        },
        createdAt: Date.now(),
        isLoading: true
      };
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: [...state.currentProject.scenes, newScene],
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'ADD_SCENE_SUCCESS': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in'
        };
      }
      
      const updatedScenes = state.currentProject.scenes.map(scene => 
        scene.id === action.payload.sceneId
          ? { ...scene, ...action.payload.sceneData, isLoading: false, error: undefined }
          : scene
      );
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'ADD_SCENE_ERROR': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in'
        };
      }
      
      const updatedScenes = state.currentProject.scenes.map(scene => 
        scene.id === action.payload.sceneId
          ? { ...scene, isLoading: false, error: action.payload.error }
          : scene
      );
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'REMOVE_SCENE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to remove scene from'
        };
      }
      
      const updatedScenes = state.currentProject.scenes.filter(
        scene => scene.id !== action.payload.sceneId
      );
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'REORDER_SCENES': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to reorder scenes'
        };
      }
      
      // Create a map of scenes by ID for quick lookup
      const scenesMap = new Map(
        state.currentProject.scenes.map(scene => [scene.id, scene])
      );
      
      // Reorder scenes based on the provided IDs
      const reorderedScenes = action.payload.sceneIds
        .map(id => scenesMap.get(id))
        .filter(Boolean) as Scene[];
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: reorderedScenes,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'UPDATE_SCENE_TEXT': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene'
        };
      }
      
      const updatedScenes = state.currentProject.scenes.map(scene => 
        scene.id === action.payload.sceneId
          ? { ...scene, text: action.payload.text }
          : scene
      );
      
      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'SET_PROJECT_TITLE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update title'
        };
      }
      
      const updatedProject: Project = {
        ...state.currentProject,
        title: action.payload.title,
        updatedAt: Date.now()
      };
      
      return {
        ...state,
        currentProject: updatedProject,
        projects: state.projects.map(p => p.id === updatedProject.id ? updatedProject : p),
        error: null
      };
    }
    
    case 'SET_ERROR': {
      return {
        ...state,
        error: action.payload.error
      };
    }
    
    case 'CLEAR_ERROR': {
      return {
        ...state,
        error: null
      };
    }
    
    case 'SET_LOADING': {
      return {
        ...state,
        isLoading: action.payload.isLoading
      };
    }
    
    default:
      return state;
  }
}

// Create the context
interface ProjectContextType extends ProjectState {
  createProject: (title: string) => void;
  setCurrentProject: (projectId: string) => void;
  addScene: (url: string) => Promise<void>;
  removeScene: (sceneId: string) => void;
  updateSceneText: (sceneId: string, text: string) => void;
  reorderScenes: (sceneIds: string[]) => void;
  setProjectTitle: (title: string) => void;
  clearError: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Project provider props
interface ProjectProviderProps {
  children: ReactNode;
}

// Project provider component
export function ProjectProvider({ children }: ProjectProviderProps) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  
  // Context actions
  const createProject = (title: string) => {
    dispatch({ type: 'CREATE_PROJECT', payload: { title } });
  };
  
  const setCurrentProject = (projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });
  };
  
  // Updated addScene function to fetch content from API
  const addScene = async (url: string) => {
    console.log('addScene called with URL:', url);
    
    if (!state.currentProject) {
      console.error('No active project to add scene to');
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'No active project to add scene to' } 
      });
      return;
    }
    
    // Generate a scene ID for tracking
    const sceneId = generateId();
    console.log('Generated scene ID:', sceneId);
    
    // Add scene with loading state
    dispatch({ 
      type: 'ADD_SCENE_LOADING', 
      payload: { sceneId, url } 
    });
    
    console.log('ProjectProvider: Fetching content for URL:', url);
    console.log('ProjectProvider: Using extractContent function to fetch from backend API');
    
    try {
      // Call the API to extract content
      console.log('Before API call');
      const response = await extractContent(url);
      console.log('After API call, response:', response);
      
      if (response.error) {
        // Handle API error
        console.error('ProjectProvider: API Error:', response.error);
        dispatch({ 
          type: 'ADD_SCENE_ERROR', 
          payload: { 
            sceneId, 
            error: response.error.detail || 'Failed to extract content from URL' 
          } 
        });
        return;
      }
      
      if (!response.data) {
        console.error('ProjectProvider: No data in API response');
        dispatch({ 
          type: 'ADD_SCENE_ERROR', 
          payload: { 
            sceneId, 
            error: 'No content data returned from URL' 
          } 
        });
        return;
      }
      
      // Parse and format the API response to match Scene interface
      const { data } = response;
      console.log('ProjectProvider: Processing API data:', data);
      
      // Create scene data from API response
      const sceneData: Partial<Scene> = {
        text: data.text || data.title || '',
        source: {
          platform: 'reddit',
          author: data.author,
          subreddit: data.subreddit
        }
      };
      
      // Add media data if available
      if (data.has_media && data.media_url) {
        console.log('ProjectProvider: Media found in response:', { 
          type: determineMediaType(data),
          url: data.media_url,
          thumbnailUrl: data.thumbnail_url
        });
        
        sceneData.media = {
          type: determineMediaType(data),
          url: data.media_url,
          thumbnailUrl: data.thumbnail_url
        };
        
        // Add dimension data if available
        if (data.preview_images && data.preview_images.length > 0) {
          const preview = data.preview_images[0];
          if (preview.width && preview.height) {
            sceneData.media.width = preview.width;
            sceneData.media.height = preview.height;
          }
        }
      } else {
        console.log('ProjectProvider: No media found in response. has_media:', data.has_media, 'media_url:', data.media_url);
      }
      
      console.log('ProjectProvider: Final scene data:', sceneData);
      
      // Update the scene with fetched data
      dispatch({ 
        type: 'ADD_SCENE_SUCCESS', 
        payload: { sceneId, sceneData } 
      });
    } catch (error) {
      // Handle unexpected errors
      console.error('ProjectProvider: Unexpected error:', error);
      dispatch({ 
        type: 'ADD_SCENE_ERROR', 
        payload: { 
          sceneId, 
          error: error instanceof Error ? error.message : 'An unknown error occurred' 
        } 
      });
    }
  };
  
  // Helper function to determine media type from API response
  const determineMediaType = (data: any): 'image' | 'video' | 'gallery' => {
    if (data.media_type) {
      if (data.media_type === 'video') return 'video';
      if (data.media_type === 'image') return 'image';
    }
    
    // Check URL patterns as fallback
    const mediaUrl = data.media_url || '';
    if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) return 'video';
    if (mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';
    
    // Handle gallery type
    if (data.preview_images && data.preview_images.length > 1) {
      return 'gallery';
    }
    
    // Default to image for safety
    return 'image';
  };
  
  const removeScene = (sceneId: string) => {
    dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
  };
  
  const updateSceneText = (sceneId: string, text: string) => {
    dispatch({ type: 'UPDATE_SCENE_TEXT', payload: { sceneId, text } });
  };
  
  const reorderScenes = (sceneIds: string[]) => {
    dispatch({ type: 'REORDER_SCENES', payload: { sceneIds } });
  };
  
  const setProjectTitle = (title: string) => {
    dispatch({ type: 'SET_PROJECT_TITLE', payload: { title } });
  };
  
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };
  
  const value = {
    ...state,
    createProject,
    setCurrentProject,
    addScene,
    removeScene,
    updateSceneText,
    reorderScenes,
    setProjectTitle,
    clearError
  };
  
  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to use the Project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
} 