/**
 * @fileoverview ProjectProvider implements the core state management for the Auto Shorts application.
 * It provides a React Context that manages project state, scene manipulation, and persistence.
 */

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
import { determineMediaType } from '../../lib/media-utils';

import { 
  Project, 
  ProjectState, 
  initialState, 
  Scene, 
  generateId,
} from './ProjectTypes';
import { projectReducer } from './ProjectReducer';

// Re-export types for convenience
export type { Project, Scene, ProjectState };
export { generateId };

/**
 * ProjectContext provides the application state and actions for managing video projects.
 * It combines both the state interface from ProjectState and action methods for state manipulation.
 * 
 * @example
 * ```tsx
 * // Using the context in a component
 * function MyComponent() {
 *   const project = useProject();
 *   
 *   const handleAddScene = async (url: string) => {
 *     await project.addScene(url);
 *   };
 *   
 *   return (
 *     <button onClick={() => handleAddScene('https://reddit.com/...')}>
 *       Add Scene
 *     </button>
 *   );
 * }
 * ```
 */
const ProjectContext = createContext<(ProjectState & {
  /** Creates a new project with the given title */
  createProject: (title: string) => void;
  /** Sets the current active project by ID */
  setCurrentProject: (projectId: string) => void;
  /** Adds a new scene from a Reddit URL */
  addScene: (url: string) => Promise<void>;
  /** Removes a scene by ID */
  removeScene: (sceneId: string) => void;
  /** Updates the order of scenes */
  reorderScenes: (sceneIds: string[]) => void;
  /** Updates the text content of a scene */
  updateSceneText: (sceneId: string, text: string) => void;
  /** Updates the project title */
  setProjectTitle: (title: string) => void;
  /** Manually triggers a save of the current project */
  saveCurrentProject: () => Promise<void>;
  /** Deletes the current project */
  deleteCurrentProject: () => Promise<void>;
  /** Loads a project by ID */
  loadProject: (projectId: string) => Promise<Project | undefined>;
  /** Creates a copy of an existing project */
  duplicateProject: (projectId: string) => Promise<string | null>;
  /** Deletes all projects */
  deleteAllProjects: () => Promise<void>;
  /** Refreshes the projects list */
  refreshProjects: () => Promise<void>;
}) | undefined>(undefined);

/**
 * ProjectProvider component provides project state management and persistence for the application.
 * It handles:
 * - Project CRUD operations
 * - Scene management
 * - Auto-saving
 * - State persistence
 * - Error handling
 * 
 * @component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components that will have access to the project context
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ProjectProvider>
 *       <ProjectWorkspace />
 *     </ProjectProvider>
 *   );
 * }
 * ```
 */
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
    let isMounted = true;
    
    // If we have a current project, set up auto-save
    if (state.currentProject) {
      // Clear existing timer if any
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Set up new timer for auto-save
      autoSaveTimerRef.current = setTimeout(async () => {
        if (!isMounted) return;
        
        try {
          await saveCurrentProject();
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 3000); // Auto-save 3 seconds after last change
    }

    // Cleanup function to clear the timer and prevent further saves
    return () => {
      isMounted = false;
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
      console.error('No active project to add scene to');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to add scene to' },
      });
      return;
    }

    // Create a local reference to the current project to ensure consistency
    const currentProject = { ...state.currentProject };
    console.log(`Adding scene to project: ${currentProject.id}, current scene count: ${currentProject.scenes.length}`);

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
            error: response.error.message || 'Failed to extract content',
          },
        });
        return;
      }

      const sceneData = response.data.data;
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
      if (sceneData.metadata?.has_media && sceneData.media_url) {
        mediaType = sceneData.media_type || 'image'; // Default to image if not specified
        mediaUrl = sceneData.media_url;
      }

      // Create the new scene object
      const newScene: Scene = {
        id: sceneId,
        url,
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
        createdAt: Date.now(),
      };

      // Create the updated project with the new scene
      const updatedProject: Project = {
        ...currentProject,
        scenes: [...currentProject.scenes, newScene],
        updatedAt: Date.now()
      };

      // 1. First save to localStorage for persistence
      console.log(`Saving project with new scene to localStorage: ${updatedProject.id}`);
      await saveProject(updatedProject);
      
      // 2. Update the UI state
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project: updatedProject },
      });
      
      // 3. Track last saved time
      dispatch({ 
        type: 'SET_LAST_SAVED', 
        payload: { timestamp: Date.now() } 
      });
      
      console.log(`Scene added successfully. Project now has ${updatedProject.scenes.length} scenes.`);
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
  }, [state.currentProject, dispatch]);

  // Remove a scene - simplified for reliability
  const removeScene = useCallback((sceneId: string) => {
    // Get the current project from state
    const project = state.currentProject;
    
    // If no current project in context state, log error and return
    if (!project) {
      console.error('No active project in context state to remove scene from');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to remove scene from' },
      });
      return;
    }

    try {
      // Check if the scene exists
      const sceneIndex = project.scenes.findIndex(scene => scene.id === sceneId);
      if (sceneIndex === -1) {
        console.warn(`Scene ${sceneId} not found in project ${project.id}, proceeding with UI update only`);
      }
      
      // Create an updated project with the scene removed
      const updatedScenes = project.scenes.filter(scene => scene.id !== sceneId);
      const updatedProject = {
        ...project,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      // Update UI first for responsiveness
      dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
      
      // Then save to storage
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
      
      saveProject(updatedProject)
        .then(() => {
          dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
          dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
          
          // Ensure currentProject is updated with the change
          dispatch({
            type: 'LOAD_PROJECT_SUCCESS',
            payload: { project: updatedProject },
          });
        })
        .catch(error => {
          console.error('Error saving project after scene removal:', error);
          dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
          dispatch({
            type: 'SET_ERROR',
            payload: { error: 'Scene removed, but changes could not be saved' },
          });
        });
    } catch (error) {
      console.error('Error during scene removal:', error);
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Error removing scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
      });
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

      console.log(`Loading project: ${projectId}`);

      // Update state with loaded project
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project },
      });

      // Ensure project is set as current
      dispatch({
        type: 'SET_CURRENT_PROJECT',
        payload: { projectId },
      });

      return project;
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
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);

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
