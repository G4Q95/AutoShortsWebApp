import { useCallback, useEffect, useState } from 'react';
import { Project, ProjectState, generateId, Scene } from '@/components/project/ProjectTypes';
import { useProjectPersistence } from './useProjectPersistence'; // Assuming persistence hook is in the same dir or adjust path
import axios from 'axios'; // Add axios import
import { ApiResponse } from '../lib/api-types'; // Import ApiResponse type

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
    console.log(`[useProjectCore] loadProject: Starting for projectId: ${projectId}`);
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
        
        console.log(`[useProjectCore] loadProject: Calling setCurrentProjectInternal with project ID: ${projectCopy?.id}`);
        setCurrentProjectInternal(projectCopy); // Update hook's internal state
        
        // Explicitly dispatch success with full project to ensure reducer state is updated
        // dispatch({ type: 'LOAD_PROJECT_SUCCESS', payload: { project: projectCopy } }); // Removed dispatch
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
  // const syncFromProviderState = useCallback((force = false) => {
  //   if (providerState.currentProject && 
  //       (force || !currentProject || 
  //        providerState.currentProject.id !== currentProject.id || 
  //        providerState.currentProject.scenes?.length !== currentProject.scenes?.length)) {
      
  //     console.log(`[useProjectCore] Syncing from provider state: Project ${providerState.currentProject.id} with ${providerState.currentProject.scenes?.length || 0} scenes`);
  //     // Create a deep copy to avoid direct reference sharing
  //     const projectCopy = JSON.parse(JSON.stringify(providerState.currentProject));
  //     setCurrentProjectInternal(projectCopy);
      
  //     // Return true if we updated state
  //     return true;
  //   }
  //   return false;
  // }, [providerState.currentProject, currentProject]);
  
  // // Check synchronization on every render
  // useEffect(() => {
  //   syncFromProviderState();
  // }, [syncFromProviderState]);
  
  // // Sync other specific state changes that might impact scenes
  // useEffect(() => {
  //   // If scenes count differs between hook state and reducer, sync from reducer
  //   if (providerState.currentProject && currentProject && 
  //       providerState.currentProject.id === currentProject.id &&
  //       providerState.currentProject.scenes?.length !== currentProject.scenes?.length) {
      
  //     console.log('[useProjectCore] Scene count mismatch detected - syncing from provider state', {
  //       hookScenes: currentProject.scenes?.length || 0,
  //       reducerScenes: providerState.currentProject.scenes?.length || 0
  //     });
      
  //     syncFromProviderState(true);
  //   }
  // }, [
  //   providerState.currentProject?.scenes?.length, 
  //   currentProject?.scenes?.length,
  //   syncFromProviderState
  // ]);

  // // Sync internal state with provider state when the provider's currentProject ID changes
  // useEffect(() => {
  //   // If the provider's current project ID is set, try to load that project
  //   if (providerState.currentProject?.id && providerState.currentProject.id !== currentProject?.id) {
  //     loadProject(providerState.currentProject.id);
  //   } 
  //   // If the provider clears the project ID, clear our internal state
  //   else if (!providerState.currentProject && currentProject) {
  //     setCurrentProjectInternal(null);
  //   }
  // }, [providerState.currentProject?.id, currentProject?.id, loadProject]); // Add loadProject dependency

  // // Sync internal state if the provider's loaded project object changes (e.g., after initial load)
  // useEffect(() => {
  //   // If the provider has a project object and it differs from ours, update ours
  //   if (providerState.currentProject && providerState.currentProject.id !== currentProject?.id) {
  //     setCurrentProjectInternal({...providerState.currentProject});
  //   } else if (!providerState.currentProject && currentProject) {
  //     // If the provider clears the project, clear ours
  //     setCurrentProjectInternal(null);
  //   }
  // }, [providerState.currentProject, currentProject]);

  // Create a new project
  const createProject = useCallback(async (title: string): Promise<Project | null> => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    // Let's assume backend assigns the ID and returns the full object.
    const projectDataForApi = {
      title: title,
      // Backend should initialize scenes, set timestamps, etc.
      status: 'draft',
      aspectRatio: '9:16', // Default aspect ratio
      showLetterboxing: true, // Default letterboxing
    };

    try {
      console.log('[useProjectCore] Attempting to create project via API:', projectDataForApi);
      // Make the API call to the backend - Use FULL ABSOLUTE PATH
      const absoluteUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/projects/projects`;
      console.log(`[useProjectCore] Using absolute URL for create: ${absoluteUrl}`)
      // Expect ApiResponse wrapper now, not { project: ... }
      const response = await axios.post<ApiResponse<Project>>(absoluteUrl, projectDataForApi);
      
      // Check the standard ApiResponse structure - Use response.data.success
      if (!response.data || !response.data.success || !response.data.data?.id) {
         // Log the actual received data for debugging if the structure is wrong
         console.error('[useProjectCore] Unexpected API response structure:', response.data);
         throw new Error('Invalid response structure from create project API');
      }

      // Extract project from the 'data' field of the ApiResponse
      const createdProject = response.data.data;
      console.log('[useProjectCore] Project created via API, response data:', createdProject);

      // Now save the complete project (with backend ID) to local persistence
      await saveProject(createdProject);
      console.log(`[useProjectCore] Project ${createdProject.id} saved to local persistence after API creation.`);

      // Update hook state FIRST after successful API creation and local save
      setCurrentProjectInternal(createdProject);

      // Explicitly set the current project ID in the context/provider
      setCurrentProject(createdProject.id);

      // dispatch({ type: 'LOAD_PROJECT_SUCCESS', payload: { project: createdProject } }); // Decide if needed later

      console.log(`[useProjectCore] Successfully created project via API: ${createdProject.id}`);
      return createdProject;

    } catch (error) {
      console.error("[useProjectCore] Failed to create project via API:", error);
      let errorMessage = 'Failed to create project';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.detail || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      dispatch({ type: 'SET_ERROR', payload: { error: errorMessage } });
      return null; // Return null on failure
    } finally {
       dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [saveProject, dispatch]);

  // Set current project ID - This tells the provider which project *should* be active
  // AND immediately triggers loading the project data into this hook's state.
  const setCurrentProject = useCallback((projectId: string | null) => {
    console.log(`[useProjectCore] setCurrentProject called with projectId: ${projectId}`);
    // 1. Dispatch to provider reducer to update provider state (e.g., project list selection)
    // dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } }); // Removed dispatch

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
     // dispatch({ type: 'UPDATE_PROJECT_METADATA', payload: { projectId: currentProject.id, changes: { title } } }); // Removed dispatch

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
        // dispatch({ type: 'UPDATE_PROJECT_METADATA', payload: { projectId: currentProject.id, changes: { aspectRatio } } }); // Removed dispatch
    } catch (error) {
      console.error('[useProjectCore] Error saving project after updating aspect ratio:', error);
      setCurrentProjectInternal(currentProject); // Revert optimistic update
      dispatch({ type: 'SET_ERROR', payload: { error: `Failed to save aspect ratio change: ${error instanceof Error ? error.message : 'Unknown error'}` } });
      // Re-throw? Or handle appropriately
    }
  }, [currentProject, saveProject, dispatch]);

  return {
    currentProject, // The project state managed by this hook
    projectId: currentProject?.id,
    createProject,
    setCurrentProject, // Sets the *ID* for the provider
    loadProject,       // Loads project data into this hook
    setProjectTitle,
    setProjectAspectRatio,
    updateCoreProjectState: setCurrentProjectInternal 
  };
}

// Helper function to get the current project state directly
// This is intended for internal use within the provider/hook ecosystem
// to avoid stale closures in callbacks.
export function useGetLatestProjectState(coreHookState: { currentProject: Project | null }) {
  return useCallback(() => {
    return coreHookState.currentProject;
  }, [coreHookState.currentProject]);
} 