'use client';

import React, { createContext, useContext, useReducer, ReactNode, useEffect, useCallback } from 'react';
import { extractContent } from '../../lib/api-client';
import { 
  saveProject, 
  getProject, 
  deleteProject, 
  getProjectsList,
  projectExists
} from '../../lib/storage-utils';

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
  lastSaved: number | null; // Timestamp of last save
  isSaving: boolean;
}

// Initial state
const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  lastSaved: null,
  isSaving: false
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
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  | { type: 'LOAD_PROJECTS'; payload: { projects: Project[] } }
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  | { type: 'SET_LAST_SAVED'; payload: { timestamp: number } }
  | { type: 'LOAD_PROJECT_SUCCESS'; payload: { project: Project } }
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; payload: { project: Project } }
  | { type: 'DELETE_ALL_PROJECTS_SUCCESS' };

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
          error: 'No active project to reorder scenes in'
        };
      }
      
      // Create a map of id -> scene for efficient lookup
      const scenesMap = new Map(
        state.currentProject.scenes.map(scene => [scene.id, scene])
      );
      
      // Create new scenes array using the order specified in sceneIds
      const updatedScenes = action.payload.sceneIds
        .filter(id => scenesMap.has(id)) // Filter out any non-existent scene ids
        .map(id => scenesMap.get(id)!); // Get the scene for each id
      
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
    
    case 'UPDATE_SCENE_TEXT': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in'
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
          error: 'No active project to update title for'
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
    
    case 'LOAD_PROJECTS': {
      return {
        ...state,
        projects: action.payload.projects,
        error: null
      };
    }

    case 'LOAD_PROJECT_SUCCESS': {
      console.log(`[ProjectReducer] LOAD_PROJECT_SUCCESS action received`);
      console.log(`[ProjectReducer] Loaded project:`, action.payload.project ? 
        `id: ${action.payload.project.id}, title: "${action.payload.project.title}"` : 'null');
      
      // Check if project is already in the projects array
      const projectExists = state.projects.some(p => p.id === action.payload.project.id);
      console.log(`[ProjectReducer] Project already exists in state: ${projectExists}`);
      
      const newState = {
        ...state,
        currentProject: action.payload.project,
        projects: projectExists
          ? state.projects.map(p => p.id === action.payload.project.id ? action.payload.project : p)
          : [...state.projects, action.payload.project],
        isLoading: false,
        error: null
      };
      
      console.log(`[ProjectReducer] Updated state with loaded project, currentProject set to:`, 
        newState.currentProject ? `id: ${newState.currentProject.id}` : 'null');
      
      return newState;
    }

    case 'SET_SAVING': {
      return {
        ...state,
        isSaving: action.payload.isSaving
      };
    }

    case 'SET_LAST_SAVED': {
      return {
        ...state,
        lastSaved: action.payload.timestamp
      };
    }
    
    case 'DUPLICATE_PROJECT_SUCCESS': {
      return {
        ...state,
        projects: [...state.projects, action.payload.project],
        currentProject: action.payload.project,
        error: null
      };
    }
    
    case 'DELETE_ALL_PROJECTS_SUCCESS': {
      return {
        ...state,
        projects: [],
        currentProject: null,
        error: null
      };
    }
    
    default:
      return state;
  }
}

// Create the Project context
const ProjectContext = createContext<ProjectState & {
  createProject: (title: string) => void;
  setCurrentProject: (projectId: string) => Promise<void>;
  addScene: (url: string) => void;
  removeScene: (sceneId: string) => void;
  updateSceneText: (sceneId: string, text: string) => void;
  reorderScenes: (sceneIds: string[]) => void;
  setProjectTitle: (title: string) => void;
  clearError: () => void;
  saveCurrentProject: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<Project>;
  deleteAllProjects: () => Promise<void>;
}>({
  ...initialState,
  createProject: () => {},
  setCurrentProject: async () => {},
  addScene: () => {},
  removeScene: () => {},
  updateSceneText: () => {},
  reorderScenes: () => {},
  setProjectTitle: () => {},
  clearError: () => {},
  saveCurrentProject: async () => {},
  loadProjects: async () => {},
  loadProject: async () => {},
  deleteProject: async () => {},
  duplicateProject: async () => ({ id: '', title: '', scenes: [], createdAt: 0, updatedAt: 0, status: 'draft' }),
  deleteAllProjects: async () => {}
});

// Project Provider component
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  
  // Auto-save timer reference
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Function to load all projects from localStorage - moved to useCallback
  const loadProjects = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      // Get projects list from localStorage
      const projectsMetadata = await getProjectsList();
      
      // For each project metadata, load the full project
      const loadedProjects: Project[] = [];
      
      for (const metadata of projectsMetadata) {
        try {
          const project = await getProject(metadata.id);
          loadedProjects.push(project);
        } catch (error) {
          console.error(`Failed to load project ${metadata.id}:`, error);
          // Continue with other projects even if one fails
        }
      }
      
      dispatch({ 
        type: 'LOAD_PROJECTS', 
        payload: { projects: loadedProjects } 
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'Failed to load saved projects' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);
  
  // Load projects from localStorage on initial mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);
  
  // Function to save the current project to localStorage
  const saveCurrentProject = useCallback(async () => {
    if (!state.currentProject) {
      console.warn('No active project to save');
      return;
    }
    
    try {
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
      
      await saveProject(state.currentProject);
      
      const timestamp = Date.now();
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp } });
      
      console.log(`Project "${state.currentProject.title}" saved successfully`);
    } catch (error) {
      console.error('Failed to save project:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'Failed to save project' } 
      });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
    }
  }, [state.currentProject, dispatch]);
  
  // Set up auto-save whenever currentProject changes
  useEffect(() => {
    // If we have a current project, set up auto-save
    if (state.currentProject) {
      // Clear existing timer if any
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      
      // Set new timer for auto-save (3 seconds after last change)
      autoSaveTimerRef.current = setTimeout(() => {
        saveCurrentProject();
      }, 3000);
    }
    
    // Clean up timer on component unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.currentProject, saveCurrentProject]);
  
  // Function to load a specific project from localStorage
  const loadProject = useCallback(async (projectId: string) => {
    console.log(`[ProjectProvider] loadProject called with projectId: ${projectId}`);
    try {
      console.log(`[ProjectProvider] Setting loading state to true`);
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      console.log(`[ProjectProvider] Checking if project exists in localStorage`);
      if (!projectExists(projectId)) {
        console.log(`[ProjectProvider] Project with ID ${projectId} not found in localStorage`);
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      console.log(`[ProjectProvider] Project exists, retrieving project data`);
      const project = await getProject(projectId);
      console.log(`[ProjectProvider] Project retrieved:`, 
        project ? `title: "${project.title}", scenes: ${project.scenes.length}` : 'null');
      
      console.log(`[ProjectProvider] Dispatching LOAD_PROJECT_SUCCESS action`);
      dispatch({ 
        type: 'LOAD_PROJECT_SUCCESS', 
        payload: { project } 
      });
      console.log(`[ProjectProvider] LOAD_PROJECT_SUCCESS action dispatched`);
    } catch (error) {
      console.error('[ProjectProvider] Failed to load project:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'Failed to load project' } 
      });
    } finally {
      console.log(`[ProjectProvider] Setting loading state to false`);
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);
  
  // Function to delete a project
  const deleteCurrentProject = useCallback(async (projectId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      if (!projectExists(projectId)) {
        throw new Error(`Project with ID ${projectId} not found`);
      }
      
      await deleteProject(projectId);
      
      // If the deleted project is the current one, clear it
      if (state.currentProject && state.currentProject.id === projectId) {
        // Clear current project without dispatching to avoid triggering auto-save
        // Instead, reload all projects which will update the state
        await loadProjects();
      } else {
        // Just reload the projects list
        await loadProjects();
      }
      
      console.log(`Project with ID ${projectId} deleted successfully`);
    } catch (error) {
      console.error('Failed to delete project:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'Failed to delete project' } 
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, state.currentProject, loadProjects]);
  
  /**
   * Creates a new project
   * @param title The title of the project
   * @returns The created project
   */
  const createProject = useCallback((title: string) => {
    const action: ProjectAction = { type: 'CREATE_PROJECT', payload: { title } };
    dispatch(action);
    
    // Get the project from the state after dispatching
    const newProject = state.projects.find(p => p.title === title);
    
    // Save the project to storage
    if (newProject) {
      // Store the ID for easy retrieval
      localStorage.setItem('lastCreatedProjectId', newProject.id);
      
      saveProject(newProject).catch(error => {
        console.error('Failed to save new project:', error);
      });
    }
    
    return newProject;
  }, [dispatch, state.projects]);
  
  const setCurrentProject = useCallback(async (projectId: string) => {
    console.log(`[ProjectProvider] setCurrentProject called with projectId: ${projectId}`);
    
    // Set loading state immediately to true
    console.log(`[ProjectProvider] Setting loading state to true before any operations`);
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    
    try {
      // Check if the project exists in state
      console.log(`[ProjectProvider] Checking if project exists in state`);
      const projectExistsInState = state.projects.some(p => p.id === projectId);
      console.log(`[ProjectProvider] Project exists in state: ${projectExistsInState}`);
      
      if (projectExistsInState) {
        console.log(`[ProjectProvider] Setting current project directly from state`);
        dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });
        console.log(`[ProjectProvider] Current project set from state`);
        
        // Set loading state to false since we're done
        console.log(`[ProjectProvider] Setting loading state to false`);
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        return;
      }
      
      // If not in state, check if it exists in localStorage first
      console.log(`[ProjectProvider] Project not in state, checking localStorage`);
      if (!projectExists(projectId)) {
        console.log(`[ProjectProvider] Project does not exist in localStorage`);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: { error: `Project with ID ${projectId} not found` } 
        });
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        return;
      }
      
      // Now load it from storage
      console.log(`[ProjectProvider] Project exists in localStorage, loading it`);
      const project = await getProject(projectId);
      
      if (!project) {
        console.log(`[ProjectProvider] Failed to load project from localStorage`);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: { error: `Failed to load project from storage` } 
        });
        dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
        return;
      }
      
      console.log(`[ProjectProvider] Project loaded from localStorage: ${project.title}`);
      console.log(`[ProjectProvider] Dispatching LOAD_PROJECT_SUCCESS action`);
      
      // Dispatch the action to set the loaded project
      dispatch({ 
        type: 'LOAD_PROJECT_SUCCESS', 
        payload: { project } 
      });
      
      console.log(`[ProjectProvider] LOAD_PROJECT_SUCCESS action dispatched`);
      
      // Set loading state to false
      console.log(`[ProjectProvider] Setting loading state to false after successful load`);
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
      
    } catch (error) {
      console.error('[ProjectProvider] Error in setCurrentProject:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: { error: 'Failed to set current project' } 
      });
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, state.projects]);
  
  // Function to add a scene with a URL
  const addScene = useCallback(async (url: string) => {
    // Generate a unique scene ID
    const sceneId = generateId();
    
    // First add a placeholder scene
    dispatch({ 
      type: 'ADD_SCENE_LOADING', 
      payload: { 
        sceneId, 
        url 
      } 
    });
    
    // Then fetch content for the scene
    try {
      console.log('ProjectProvider: Extracting content from URL:', url);
      const response = await extractContent(url);
      
      if (response.error || !response.data) {
        console.error('ProjectProvider: API error:', response.error);
        dispatch({ 
          type: 'ADD_SCENE_ERROR', 
          payload: { 
            sceneId, 
            error: response.error?.detail || 'Failed to extract content from URL' 
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
  }, [dispatch]);
  
  const removeScene = useCallback((sceneId: string) => {
    dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
  }, [dispatch]);
  
  const updateSceneText = useCallback((sceneId: string, text: string) => {
    dispatch({ type: 'UPDATE_SCENE_TEXT', payload: { sceneId, text } });
  }, [dispatch]);
  
  const reorderScenes = useCallback((sceneIds: string[]) => {
    dispatch({ type: 'REORDER_SCENES', payload: { sceneIds } });
  }, [dispatch]);
  
  const setProjectTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_PROJECT_TITLE', payload: { title } });
  }, [dispatch]);
  
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, [dispatch]);
  
  /**
   * Duplicates a project
   * @param projectId The ID of the project to duplicate
   */
  const duplicateProject = useCallback(async (projectId: string) => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    
    try {
      // Find the project to duplicate
      const projectToDuplicate = state.projects.find(p => p.id === projectId);
      
      if (!projectToDuplicate) {
        throw new Error('Project not found');
      }
      
      // Create a new project with the same data but different ID
      const duplicatedProject: Project = {
        ...JSON.parse(JSON.stringify(projectToDuplicate)), // Deep clone
        id: generateId(),
        title: `${projectToDuplicate.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Save the duplicated project
      await saveProject(duplicatedProject);
      
      dispatch({
        type: 'DUPLICATE_PROJECT_SUCCESS',
        payload: { project: duplicatedProject }
      });
      
      return duplicatedProject;
    } catch (error) {
      console.error('Failed to duplicate project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to duplicate project' }
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, state.projects]);
  
  /**
   * Deletes all projects
   */
  const deleteAllProjects = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    
    try {
      // Get all project IDs
      const projectIds = state.projects.map(project => project.id);
      
      // Delete each project
      for (const id of projectIds) {
        await deleteProject(id);
      }
      
      dispatch({ type: 'DELETE_ALL_PROJECTS_SUCCESS' });
    } catch (error) {
      console.error('Failed to delete all projects:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to delete all projects' }
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, state.projects]);
  
  const value = {
    ...state,
    createProject,
    setCurrentProject,
    addScene,
    removeScene,
    updateSceneText,
    reorderScenes,
    setProjectTitle,
    clearError,
    saveCurrentProject,
    loadProjects,
    loadProject,
    deleteProject: deleteCurrentProject,
    duplicateProject,
    deleteAllProjects
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