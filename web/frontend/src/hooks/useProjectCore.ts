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

  // Define loadProject first before any other functions or hooks that use it
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    try {
      const project = await loadProjectFromHook(projectId);
      if (project) {
        // Log detailed scene info to diagnose synchronization issues
        console.log(`[useProjectCore] loadProject: Got project ${projectId} with ${project.scenes?.length || 0} scenes`);
        if (project.scenes?.length > 0) {
          console.log(`[useProjectCore] Scene IDs: ${project.scenes.map(s => s.id).join(', ')}`);
        }
        
        // Create a fresh deep copy to ensure we're not working with mutated references
        const projectCopy = JSON.parse(JSON.stringify(project));
        
        setCurrentProjectInternal(projectCopy); // Update hook's internal state
        
        // Explicitly dispatch success with full project to ensure reducer state is updated
        dispatch({ type: 'LOAD_PROJECT_SUCCESS', payload: { project: projectCopy } });
        return projectCopy;
      } else {
        console.warn(`[useProjectCore] loadProject: Project ${projectId} not found or failed to load`);
        dispatch({ type: 'SET_ERROR', payload: { error: `Project ${projectId} not found or failed to load` } });
        setCurrentProjectInternal(null);
        return null;
      }
    } catch (error) {
      console.error(`[useProjectCore] Error loading project ${projectId}:`, error);
      dispatch({ type: 'SET_ERROR', payload: { error: `Failed to load project ${projectId}` } });
      setCurrentProjectInternal(null);
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, loadProjectFromHook]);

  // Add a function to sync from the provider state
  const syncFromProviderState = useCallback((force = false) => {
    if (providerState.currentProject && 
        (force || !currentProject || 
         providerState.currentProject.id !== currentProject.id || 
         providerState.currentProject.scenes?.length !== currentProject.scenes?.length)) {
      
      console.log(`[useProjectCore] Syncing from provider state: Project ${providerState.currentProject.id} with ${providerState.currentProject.scenes?.length || 0} scenes`);
      // Create a deep copy to avoid direct reference sharing
      const projectCopy = JSON.parse(JSON.stringify(providerState.currentProject));
      setCurrentProjectInternal(projectCopy);
      
      // Return true if we updated state
      return true;
    }
    return false;
  }, [providerState.currentProject, currentProject]);
  
  // Check synchronization on every render
  useEffect(() => {
    syncFromProviderState();
  }, [syncFromProviderState]);
  
  // Sync other specific state changes that might impact scenes
  useEffect(() => {
    // If scenes count differs between hook state and reducer, sync from reducer
    if (providerState.currentProject && currentProject && 
        providerState.currentProject.id === currentProject.id &&
        providerState.currentProject.scenes?.length !== currentProject.scenes?.length) {
      
      console.log('[useProjectCore] Scene count mismatch detected - syncing from provider state', {
        hookScenes: currentProject.scenes?.length || 0,
        reducerScenes: providerState.currentProject.scenes?.length || 0
      });
      
      syncFromProviderState(true);
    }
  }, [
    providerState.currentProject?.scenes?.length, 
    currentProject?.scenes?.length,
    syncFromProviderState
  ]);

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
  }, [providerState.currentProject?.id, currentProject?.id, loadProject]); // Add loadProject dependency

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
  const createProject = useCallback(async (title: string): Promise<Project | null> => {
    const newProject: Project = {
      id: `proj_${generateId()}`,
      title: title,
      scenes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastModified: Date.now(),
      status: 'draft',
      aspectRatio: '9:16', // Default aspect ratio
      showLetterboxing: true, // Default letterboxing
    };

    try {
      // Await the save operation
      await saveProject(newProject);
      
      // Update hook state FIRST after successful save
      setCurrentProjectInternal(newProject);
      
      // Dispatch a success action with the full project object to the reducer
      // Ensure the reducer handles 'CREATE_PROJECT_SUCCESS' appropriately
      dispatch({ type: 'LOAD_PROJECT_SUCCESS', payload: { project: newProject } });
      
      // Optional: Log success
      console.log(`[useProjectCore] Successfully created and saved project: ${newProject.id}`);
      
      // Return the newly created project
      return newProject; 

    } catch (error) {
      console.error("[useProjectCore] Failed to save new project:", error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to create project' } });
      // Consider if we need to clear the internal state if creation fails
      // setCurrentProjectInternal(null); 
      return null; // Return null on failure
    }
  }, [saveProject, dispatch]);

  // Set current project ID - This tells the provider which project *should* be active
  // AND immediately triggers loading the project data into this hook's state.
  const setCurrentProject = useCallback((projectId: string | null) => {
    // 1. Dispatch to provider reducer to update provider state (e.g., project list selection)
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });

    // 2. Immediately attempt to load the project data into *this hook's* state
    if (projectId) {
      // Don't await here, let it run in the background. loadProject handles internal state updates.
      loadProject(projectId).catch(error => {
         console.error(`[useProjectCore] Error triggered by loadProject within setCurrentProject for ID ${projectId}:`, error);
         // Error handling is mostly done within loadProject, but log here too.
      });
    } else {
      // If projectId is null, clear the internal state directly
      setCurrentProjectInternal(null);
    }
  }, [dispatch, loadProject]); // Add loadProject dependency

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
    updateCoreProjectState: setCurrentProjectInternal 
  };
} 