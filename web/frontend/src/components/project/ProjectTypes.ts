// Types for the project management system

import { generateId } from '../../lib/id-utils';

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

// Define project interface
export interface Project {
  id: string;
  title: string;
  scenes: Scene[];
  createdAt: number;
  updatedAt: number;
  status: 'draft' | 'processing' | 'completed' | 'error';
}

// Project context state
export interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
  lastSaved: number | null; // Timestamp of last save
  isSaving: boolean;
}

// Action types
export type ProjectAction =
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
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'LOAD_PROJECTS'; payload: { projects: Project[] } }
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  | { type: 'SET_LAST_SAVED'; payload: { timestamp: number } }
  | { type: 'LOAD_PROJECT_SUCCESS'; payload: { project: Project } }
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; payload: { project: Project } }
  | { type: 'DELETE_ALL_PROJECTS_SUCCESS' };

// Initial state
export const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  lastSaved: null,
  isSaving: false,
};

// Re-export utility functions
export { generateId }; 