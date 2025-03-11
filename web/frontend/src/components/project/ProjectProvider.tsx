'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { extractContent } from '../../lib/api-client';
import {
  saveProject,
  getProject,
  deleteProject,
  getProjectsList,
  projectExists,
} from '../../lib/storage-utils';

import { 
  Project, 
  ProjectState, 
  initialState, 
  Scene, 
  generateId,
  determineMediaType 
} from './ProjectTypes';
import { projectReducer } from './ProjectReducer';

// Re-export types for convenience
export type { Project, Scene, ProjectState };
export { generateId, determineMediaType };

// Create the context with a merged type that includes state and actions
const ProjectContext = createContext<(ProjectState & {
  createProject: (title: string) => void;
  setCurrentProject: (projectId: string) => void;
  addScene: (url: string) => Promise<void>;
  removeScene: (sceneId: string) => void;
  reorderScenes: (sceneIds: string[]) => void;
  updateSceneText: (sceneId: string, text: string) => void;
  setProjectTitle: (title: string) => void;
  saveCurrentProject: () => Promise<void>;
  deleteCurrentProject: () => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<void>;
  deleteAllProjects: () => Promise<void>;
  refreshProjects: () => Promise<void>;
}) | undefined>(undefined);

// Provider component
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);

  // Auto-save timer reference
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Function to load all projects from localStorage - with memoization
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
          if (project) loadedProjects.push(project);
        } catch (error) {
          console.error(`Failed to load project ${metadata.id}:`, error);
          // Continue with other projects even if one fails
        }
      }

      dispatch({
        type: 'LOAD_PROJECTS',
        payload: { projects: loadedProjects },
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'Failed to load saved projects' },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);

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
        payload: { error: 'Failed to save project' },
      });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
    }
  }, [state.currentProject]);

  // Set up auto-save whenever currentProject changes
  useEffect(() => {
    // If we have a current project, set up auto-save
    if (state.currentProject) {
      // Clear existing timer if any
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set up new timer for auto-save
      autoSaveTimerRef.current = setTimeout(() => {
        saveCurrentProject();
      }, 3000); // Auto-save 3 seconds after last change
    }

    // Cleanup function to clear the timer
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.currentProject, saveCurrentProject]);

  // Create a new project
  const createProject = useCallback((title: string) => {
    dispatch({ type: 'CREATE_PROJECT', payload: { title } });
  }, []);

  // Set current project by ID
  const setCurrentProject = useCallback((projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });
  }, []);

  // Add a scene
  const addScene = useCallback(async (url: string) => {
    // Generate a temporary ID for the scene
    const sceneId = generateId();

    // Add the scene to the project with loading state
    dispatch({
      type: 'ADD_SCENE_LOADING',
      payload: { sceneId, url },
    });

    try {
      // Extract content from the URL
      const contentResponse = await extractContent(url);
      
      if (!contentResponse.data || contentResponse.error) {
        throw new Error(contentResponse.error?.detail || 'Failed to extract content from URL');
      }
      
      const data = contentResponse.data;

      // Determine media type based on content
      const mediaType = determineMediaType(data);

      // Create scene data from extracted content
      const sceneData: Partial<Scene> = {
        text: data.text || data.title || '',
        source: {
          author: data.author || undefined,
          subreddit: data.subreddit || undefined,
          platform: data.platform || 'reddit',
        },
      };

      // Set media based on type
      if (data.media_url || data.thumbnail_url) {
        sceneData.media = {
          type: mediaType,
          url: data.media_url || data.thumbnail_url || '',
          thumbnailUrl: data.thumbnail_url,
          width: data.width,
          height: data.height,
          duration: data.duration,
        };
      }

      // Update scene with extracted data
      dispatch({
        type: 'ADD_SCENE_SUCCESS',
        payload: { sceneId, sceneData },
      });

      // Auto-save project with new scene
      await saveCurrentProject();
    } catch (error) {
      console.error('Error adding scene:', error);
      dispatch({
        type: 'ADD_SCENE_ERROR',
        payload: {
          sceneId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }, [saveCurrentProject]);

  // Remove a scene
  const removeScene = useCallback((sceneId: string) => {
    dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
  }, []);

  // Reorder scenes
  const reorderScenes = useCallback((sceneIds: string[]) => {
    dispatch({ type: 'REORDER_SCENES', payload: { sceneIds } });
  }, []);

  // Update scene text
  const updateSceneText = useCallback((sceneId: string, text: string) => {
    dispatch({ type: 'UPDATE_SCENE_TEXT', payload: { sceneId, text } });
  }, []);

  // Set project title
  const setProjectTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_PROJECT_TITLE', payload: { title } });
  }, []);

  // Delete current project
  const deleteCurrentProject = useCallback(async () => {
    if (!state.currentProject) {
      console.warn('No active project to delete');
      return;
    }

    try {
      await deleteProject(state.currentProject.id);
      loadProjects(); // Refresh projects list after deletion
    } catch (error) {
      console.error('Failed to delete project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to delete project: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
    }
  }, [state.currentProject, loadProjects]);

  // Load a project by ID
  const loadProject = useCallback(async (projectId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      // Check if project exists
      const exists = await projectExists(projectId);
      if (!exists) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Load the project
      const project = await getProject(projectId);
      if (!project) {
        throw new Error(`Failed to load project with ID ${projectId}`);
      }

      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project },
      });
    } catch (error) {
      console.error('Failed to load project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to load project: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);

  // Duplicate a project
  const duplicateProject = useCallback(async (projectId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      // Check if source project exists
      const exists = await projectExists(projectId);
      if (!exists) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Load the source project
      const sourceProject = await getProject(projectId);
      if (!sourceProject) {
        throw new Error(`Failed to load project with ID ${projectId}`);
      }

      // Create a new project with the same data but new ID
      const newProject: Project = {
        ...sourceProject,
        id: generateId(),
        title: `${sourceProject.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save the new project
      await saveProject(newProject);

      dispatch({
        type: 'DUPLICATE_PROJECT_SUCCESS',
        payload: { project: newProject },
      });
    } catch (error) {
      console.error('Failed to duplicate project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to duplicate project: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);

  // Delete all projects
  const deleteAllProjects = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      // Get projects list
      const projectsMetadata = await getProjectsList();

      // Delete each project
      for (const metadata of projectsMetadata) {
        try {
          await deleteProject(metadata.id);
        } catch (error) {
          console.error(`Failed to delete project ${metadata.id}:`, error);
          // Continue with other projects even if one fails
        }
      }

      dispatch({ type: 'DELETE_ALL_PROJECTS_SUCCESS' });
    } catch (error) {
      console.error('Failed to delete all projects:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to delete all projects: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);

  // Refresh projects list
  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  // Memoize the context value to prevent unnecessary re-renders
  // CHANGE: Now we spread state properties directly into the context value
  // to maintain compatibility with existing components
  const contextValue = useMemo(
    () => ({
      // Spread all state properties
      ...state,
      // Include all action methods
      createProject,
      setCurrentProject,
      addScene,
      removeScene,
      reorderScenes,
      updateSceneText,
      setProjectTitle,
      saveCurrentProject,
      deleteCurrentProject,
      loadProject,
      duplicateProject,
      deleteAllProjects,
      refreshProjects,
    }),
    [
      state,
      createProject,
      setCurrentProject,
      addScene,
      removeScene,
      reorderScenes,
      updateSceneText,
      setProjectTitle,
      saveCurrentProject,
      deleteCurrentProject,
      loadProject,
      duplicateProject,
      deleteAllProjects,
      refreshProjects,
    ]
  );

  return (
    <ProjectContext.Provider value={contextValue}>
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
