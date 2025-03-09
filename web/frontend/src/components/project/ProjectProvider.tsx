'use client';

import React, { createContext, useContext, useReducer, ReactNode } from 'react';

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
    
    case 'ADD_SCENE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to'
        };
      }
      
      const newScene: Scene = {
        id: generateId(),
        url: action.payload.url,
        text: '',
        source: {
          platform: 'reddit' // Default to reddit for now
        },
        createdAt: Date.now()
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
  addScene: (url: string) => void;
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
  
  const addScene = (url: string) => {
    dispatch({ type: 'ADD_SCENE', payload: { url } });
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