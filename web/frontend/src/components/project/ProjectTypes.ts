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

// Helper function to determine media type from API response
export const determineMediaType = (data: any): 'image' | 'video' | 'gallery' => {
  // If media_type is directly provided (from backend API response)
  if (data.media_type) {
    if (data.media_type === 'video') return 'video';
    if (data.media_type === 'image') return 'image';
    if (data.media_type === 'gallery') return 'gallery';
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

// Re-export generateId for backward compatibility
export { generateId }; 