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
  loadProject: (projectId: string) => Promise<Project | undefined>;
  duplicateProject: (projectId: string) => Promise<string | null>;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to save the current project to localStorage
  const saveCurrentProject = useCallback(async () => {
    if (!state.currentProject) {
      console.warn('No active project to save');
      return;
    }

    try {
      // Capture project reference to ensure it doesn't change during save operation
      const projectToSave = { ...state.currentProject };
      
      console.log(`Saving project: ${projectToSave.id}, ${projectToSave.title}, scenes: ${projectToSave.scenes.length}`);
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });

      await saveProject(projectToSave);

      const timestamp = Date.now();
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp } });

      console.log(`Project "${projectToSave.title}" saved successfully`);
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
        autoSaveTimerRef.current = null;
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

  // Add a scene - enhanced with better error handling
  const addScene = useCallback(async (url: string) => {
    // First check if a current project exists
    if (!state.currentProject) {
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to add scene to' },
      });
      return;
    }

    const sceneId = generateId();
    dispatch({
      type: 'ADD_SCENE_LOADING',
      payload: { sceneId, url },
    });

    try {
      const response = await extractContent(url);

      if (response.error) {
        dispatch({
          type: 'ADD_SCENE_ERROR',
          payload: {
            sceneId,
            error: response.error.detail || 'Failed to extract content',
          },
        });
        return;
      }

      const sceneData = response.data;
      if (!sceneData) {
        dispatch({
          type: 'ADD_SCENE_ERROR',
          payload: {
            sceneId,
            error: 'No content data returned from API',
          },
        });
        return;
      }

      // Process the response into a scene object
      let mediaType: 'image' | 'video' | 'gallery' | null = null;
      let mediaUrl: string | null = null;

      // Process media from the response - handle direct media properties
      if (sceneData.has_media && sceneData.media_url) {
        mediaType = sceneData.media_type || 'image'; // Default to image if not specified
        mediaUrl = sceneData.media_url;
      }

      // Ensure we have a valid scene object
      dispatch({
        type: 'ADD_SCENE_SUCCESS',
        payload: {
          sceneId,
          sceneData: {
            text: sceneData.text || '',
            media: mediaUrl && mediaType ? { 
              type: mediaType as 'image' | 'video' | 'gallery', 
              url: mediaUrl,
              thumbnailUrl: sceneData.thumbnail_url,
              width: sceneData.width,
              height: sceneData.height,
              duration: sceneData.duration
            } : undefined,
            source: {
              platform: 'reddit',
              author: sceneData.author,
              subreddit: sceneData.subreddit,
            },
          },
        },
      });

      // Auto-save after adding a scene
      await saveCurrentProject();
    } catch (error) {
      console.error('Error adding scene:', error);
      dispatch({
        type: 'ADD_SCENE_ERROR',
        payload: {
          sceneId,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        },
      });
    }
  }, [state.currentProject, saveCurrentProject]);

  // Remove a scene - completely overhauled for reliability
  const removeScene = useCallback((sceneId: string) => {
    // Get the current project from state
    const project = state.currentProject;
    
    // Robust logging for debugging
    console.log(`Attempting to remove scene ${sceneId}`, {
      hasProject: !!project,
      projectId: project?.id,
      scenesCount: project?.scenes?.length || 0,
      sceneIds: project?.scenes?.map(s => s.id)
    });
    
    // If no current project in context state, log error and return
    if (!project) {
      console.error('No active project in context state to remove scene from - cannot remove scene:', sceneId);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to remove scene from' },
      });
      return;
    }

    try {
      // Find the scene index to verify it exists, but continue regardless
      const sceneIndex = project.scenes.findIndex(scene => scene.id === sceneId);
      if (sceneIndex === -1) {
        console.warn(`Scene ${sceneId} not found in project ${project.id}, but will proceed with UI removal`);
        // Dispatch removal anyway to update UI and ensure consistency
        dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
        return; // Skip saving since there's nothing to update in storage
      }
      
      // First, create an updated project with the scene removed to use for saving
      const updatedScenes = project.scenes.filter(scene => scene.id !== sceneId);
      const updatedProject = {
        ...project,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      console.log(`Dispatching scene removal for scene: ${sceneId} in project: ${project.id}`);
      
      // Immediately dispatch action to update UI
      dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
      
      // Then save the updated project directly
      console.log(`Saving project after removing scene ${sceneId}`);
      
      // Use a try/catch for saving to ensure UI is updated even if save fails
      try {
        // Create a deep clone of the updated project to avoid race conditions
        const projectToSave = JSON.parse(JSON.stringify(updatedProject));
        
        // Display optimistic saving message to user
        dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
        
        // Immediately save the project to local storage
        saveProject(projectToSave)
          .then(() => {
            console.log(`Project saved successfully after scene removal`);
            dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
            dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
            
            // Update currentProject again to ensure it's fully synchronized
            dispatch({
              type: 'LOAD_PROJECT_SUCCESS',
              payload: { project: projectToSave },
            });
          })
          .catch(saveError => {
            console.error('Error saving project after scene removal:', saveError);
            dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
            // Still mark as removed in UI, but show error about save failing
            dispatch({
              type: 'SET_ERROR',
              payload: { error: 'Scene removed, but changes could not be saved permanently' },
            });
          });
      } catch (saveError) {
        console.error('Exception during save after scene removal:', saveError);
        dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
      }
    } catch (error) {
      console.error('Error during scene removal process:', error);
      // Still proceed with the UI update to maintain consistency
      dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Error removing scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
      });
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
    }
  }, [state.currentProject, dispatch]);

  // Reorder scenes
  const reorderScenes = useCallback((sceneIds: string[]) => {
    dispatch({ type: 'REORDER_SCENES', payload: { sceneIds } });
    
    // We need to manually trigger a save here to ensure reordering is persisted
    setTimeout(() => {
      saveCurrentProject().catch(error => {
        console.error('Error saving project after reordering scenes:', error);
      });
    }, 100);
  }, [saveCurrentProject]);

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
      const projectId = state.currentProject.id;
      await deleteProject(projectId);
      
      // Only refresh projects after successful deletion
      await loadProjects();
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

      console.log(`ProjectProvider: Successfully loaded project ${projectId}`, {
        id: project.id,
        title: project.title,
        scenesCount: project.scenes?.length || 0
      });

      // Store a reference for later use in case we need to retry
      const loadedProject = { ...project };

      // Dispatch the project to the reducer with some data validation
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project: loadedProject },
      });

      // Extra verification that the project was set successfully
      setTimeout(() => {
        if (!state.currentProject || state.currentProject.id !== projectId) {
          console.log(`ProjectProvider: Project ${projectId} not set as current after load, retrying...`);
          // Try explicitly setting it
          dispatch({
            type: 'SET_CURRENT_PROJECT',
            payload: { projectId: loadedProject.id },
          });
        }
      }, 100);

      return loadedProject; // Return the loaded project for potential use by caller
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
      throw error; // Re-throw to allow caller to handle
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [state.currentProject, dispatch]);

  // Create a duplicate of a project
  const duplicateProject = useCallback(async (projectId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      // Get the original project
      const originalProject = await getProject(projectId);
      if (!originalProject) {
        throw new Error(`Project with ID ${projectId} not found for duplication`);
      }

      // Create a new project ID
      const newProjectId = generateId();

      // Create a duplicate project with a new ID and updated timestamps
      const duplicatedProject: Project = {
        ...originalProject,
        id: newProjectId,
        title: `${originalProject.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // Save the duplicated project
      await saveProject(duplicatedProject);

      // Update the state with the new project
      dispatch({
        type: 'DUPLICATE_PROJECT_SUCCESS',
        payload: { project: duplicatedProject },
      });

      return duplicatedProject.id;
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
      return null;
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
  // Split context values into separate memoized objects
  const stateValues = useMemo(() => ({
    projects: state.projects,
    currentProject: state.currentProject,
    isLoading: state.isLoading,
    error: state.error,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving,
  }), [
    state.projects,
    state.currentProject,
    state.isLoading,
    state.error,
    state.lastSaved,
    state.isSaving
  ]);

  const actions = useMemo(() => ({
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
  }), [
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
  ]);

  // Combine state and actions only when either changes
  const contextValue = useMemo(() => ({
    ...stateValues,
    ...actions
  }), [stateValues, actions]);

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
