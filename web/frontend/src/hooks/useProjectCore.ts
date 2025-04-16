import { useCallback, useEffect, useState } from 'react';
import { Project, ProjectState, generateId, Scene } from '@/components/project/ProjectTypes';
import { useProjectPersistence } from './useProjectPersistence'; // Assuming persistence hook is in the same dir or adjust path

type DispatchType = React.Dispatch<any>; // Replace 'any' with the actual action type if available

/**
 * Custom hook for managing core project data logic.
 * Handles creating, loading, setting current project, title, and aspect ratio.
 * 
 * @param dispatch - The dispatch function from the ProjectProvider's reducer.
 * @param providerState - The full state from the ProjectProvider's reducer.
 * @param persistedProjects - The list of projects from the persistence layer.
 * @returns Core project management functions and the current project state derived by this hook.
 */
export function useProjectCore(
  dispatch: DispatchType,
  providerState: ProjectState,
  persistedProjects: Project[] // Or ProjectMetadata[] if that's what persistence returns
) {
  // Internal state for the current project derived/managed by this hook
  const [currentProject, setCurrentProjectInternal] = useState<Project | null>(providerState.currentProject);

  // Access persistence functions needed for core logic
  const { loadProject: loadProjectFromHook, saveProject } = useProjectPersistence();

  // Sync internal state with provider state when the provider's currentProject ID changes
  useEffect(() => {
    // If the provider's current project ID is set, try to load that project
    if (providerState.currentProject?.id && providerState.currentProject.id !== currentProject?.id) {
      loadProject(providerState.currentProject.id);
    } 
    // If the provider clears the project ID, clear our internal state
    else if (!providerState.currentProject && currentProject) {
      setCurrentProjectInternal(null);
    }
  }, [providerState.currentProject?.id, currentProject?.id]); // Depend on the ID from the provider's project object

  // Sync internal state if the provider's loaded project object changes (e.g., after initial load)
  useEffect(() => {
    // If the provider has a project object and it differs from ours, update ours
    if (providerState.currentProject && providerState.currentProject.id !== currentProject?.id) {
      setCurrentProjectInternal({...providerState.currentProject});
    } else if (!providerState.currentProject && currentProject) {
      // If the provider clears the project, clear ours
      setCurrentProjectInternal(null);
    }
  }, [providerState.currentProject, currentProject]);


  // Create a new project
  const createProject = useCallback((title: string) => {
    const newProject: Project = {
      id: generateId('proj'),
      title: title,
      scenes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastModified: Date.now(),
      status: 'draft',
      aspectRatio: '9:16', // Default aspect ratio
      showLetterboxing: true, // Default letterboxing
    };
    // Save the new project using the persistence hook
    // @ts-ignore - Linter incorrectly flags saveProject args here
    saveProject(newProject).then(() => {
        // Dispatch existing CREATE_PROJECT action. Reducer will handle adding to list.
        // Note: Reducer also sets currentProject, which might be redundant with the hook's internal state update.
        dispatch({ type: 'CREATE_PROJECT', payload: { title: newProject.title } }); // Use title for payload consistency
        // Update internal state
        setCurrentProjectInternal(newProject);
        // Also dispatch to set the provider's currentProjectId (handled by CREATE_PROJECT reducer)
    }).catch(error => {
        console.error("Failed to save new project:", error);
        dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to create project' } });

        // Dispatch to reducer if other parts of the provider state need updating
        dispatch({ type: 'UPDATE_PROJECT_METADATA', payload: { projectId: currentProject?.id, changes: { title } } });
    });
  }, [currentProject, saveProject, dispatch]);

  // Set current project ID - This tells the provider which project *should* be active.
  // The useEffect above will handle loading the actual project data.
  const setCurrentProject = useCallback((projectId: string | null) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });
  }, [dispatch]);


  // Load a project by ID using the persistence hook
  const loadProject = useCallback(async (projectId: string): Promise<Project | undefined> => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    try {
      const project = await loadProjectFromHook(projectId);
      if (project) {
        setCurrentProjectInternal(project); // Update hook's internal state
        // Optional: Dispatch success to provider if it needs the full project object immediately
        // dispatch({ type: 'LOAD_PROJECT_SUCCESS', payload: { project } }); 
        return project;
      } else {
        dispatch({ type: 'SET_ERROR', payload: { error: `Project ${projectId} not found or failed to load` } });
        setCurrentProjectInternal(null);
        return undefined;
      }
    } catch (error) {
      console.error(`Error loading project ${projectId}:`, error);
      dispatch({ type: 'SET_ERROR', payload: { error: `Failed to load project ${projectId}` } });
      setCurrentProjectInternal(null);
      return undefined;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, loadProjectFromHook]);

  // Set project title
  const setProjectTitle = useCallback((title: string) => {
    if (!currentProject) return;

    const updatedProject = { ...currentProject, title, updatedAt: Date.now() };
    setCurrentProjectInternal(updatedProject); // Optimistic update

    // Save the change
    saveProject(updatedProject).catch(error => {
        console.error("Failed to save project title:", error);
        // Revert optimistic update on error?
        setCurrentProjectInternal(currentProject); 
        dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save title' } });
    });
     // Dispatch to reducer if other parts of the provider state need updating
     dispatch({ type: 'UPDATE_PROJECT_METADATA', payload: { projectId: currentProject.id, changes: { title } } });

  }, [currentProject, saveProject, dispatch]);

  // Set project aspect ratio  
  const setProjectAspectRatio = useCallback(async (aspectRatio: Project['aspectRatio']) => {
    if (!currentProject) {
      console.warn('[useProjectCore] No active project to update aspect ratio for');
      return;
    }

    const updatedProject = { ...currentProject, aspectRatio, updatedAt: Date.now() };
    setCurrentProjectInternal(updatedProject); // Optimistic update

    // Save the change
    try {
        await saveProject(updatedProject);
        // Optional: verify save if needed, like in the original provider
        // Dispatch to reducer if other parts of the provider state need updating
        dispatch({ type: 'UPDATE_PROJECT_METADATA', payload: { projectId: currentProject.id, changes: { aspectRatio } } });
    } catch (error) {
      console.error('[useProjectCore] Error saving project after updating aspect ratio:', error);
      setCurrentProjectInternal(currentProject); // Revert optimistic update
      dispatch({ type: 'SET_ERROR', payload: { error: `Failed to save aspect ratio change: ${error instanceof Error ? error.message : 'Unknown error'}` } });
      // Re-throw? Or handle appropriately
    }
  }, [currentProject, saveProject, dispatch]);

  return {
    currentProject, // The project state managed by this hook
    createProject,
    setCurrentProject, // Sets the *ID* for the provider
    loadProject,       // Loads project data into this hook
    setProjectTitle,
    setProjectAspectRatio,
  };
} 