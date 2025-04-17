import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { ApiResponse } from '../lib/api-types';
import { 
  Project, Scene 
} from '@/components/project/ProjectTypes';
import {
  getProjectsList as getProjectsListFromStorage,
  getProject as getProjectFromStorage,
  saveProject as saveProjectToStorage,
  deleteProject as deleteProjectFromStorage,
  clearAllProjects as clearAllProjectsFromStorage,
  projectExists as projectExistsInStorage,
} from '@/lib/storage-utils';

// Define the shape of the hook's return value
interface UseProjectPersistenceReturn {
  projects: Project[];
  isLoadingProjects: boolean;
  isSavingProject: boolean;
  lastSavedTimestamp: number | null;
  persistenceError: string | null;
  loadProjectsList: () => Promise<void>;
  saveProject: (project: Project) => Promise<void>;
  loadProject: (projectId: string) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<void>;
  deleteAllProjects: () => Promise<void>;
  projectExists: (projectId: string) => Promise<boolean>;
  // Add more functions and state as we extract them
}

/**
 * Custom hook to manage project persistence in localStorage.
 * Handles loading, saving, and deleting project data.
 */
export function useProjectPersistence(): UseProjectPersistenceReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState<boolean>(true);
  const [isSavingProject, setIsSavingProject] = useState<boolean>(false);
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<number | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const loadProjectsList = useCallback(async () => {
    setIsLoadingProjects(true);
    setPersistenceError(null);
    try {
      const projectsMetadata = await getProjectsListFromStorage();
      const projectPromises = projectsMetadata.map(metadata => getProjectFromStorage(metadata.id));
      const loadedProjects = await Promise.all(projectPromises);
      
      // Filter out null projects (those that failed to load)
      const validProjects = loadedProjects.filter((p): p is Project => p !== null);
      setProjects(validProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setPersistenceError('Failed to load projects from storage.');
      setProjects([]); // Clear projects on error
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  // Function to save a given project to localStorage
  const saveProject = useCallback(async (projectToSave: Project) => {
    if (!projectToSave) {
      console.warn('No project provided to save');
      setPersistenceError('Attempted to save a null project.');
      return;
    }

    setIsSavingProject(true);
    setPersistenceError(null);
    try {
      // Log scenes count to help debug
      console.log(`Saving project via hook: ${projectToSave.id}, ${projectToSave.title}, scenes: ${projectToSave.scenes.length}`);
      
      // --- BEGIN BACKEND PATCH LOGIC (Corrected URL) ---
      // 1. Prepare data for PATCH (ProjectUpdate structure)
      const updatePayload = {
        title: projectToSave.title,
        // description field doesn't exist on Project type
        scenes: projectToSave.scenes, 
        // Add other updatable fields from Project type
        aspectRatio: projectToSave.aspectRatio,
        showLetterboxing: projectToSave.showLetterboxing,
        status: projectToSave.status, // Include status
      };

      // 2. Make the PATCH request using the ABSOLUTE backend URL
      const absoluteApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const patchUrl = `${absoluteApiUrl}/api/v1/projects/${projectToSave.id}`; 
      console.log(`[useProjectPersistence] Sending PATCH to ${patchUrl} with payload:`, updatePayload);

      const response = await axios.patch<ApiResponse<Project>>(patchUrl, updatePayload);

      // 3. Check backend response
      if (!response.data || !response.data.success) {
          const errorMsg = response.data?.message || 'Failed to save project to backend';
          console.error(`[useProjectPersistence] Backend PATCH failed for ${projectToSave.id}: ${errorMsg}`, response.data);
          // Still throw error, but maybe don't block local save if API fails?
          // Consider if local save should proceed even if backend fails.
          // For now, throwing error prevents local save on backend failure.
          throw new Error(errorMsg);
      }
      
      console.info(`[useProjectPersistence] Project ${projectToSave.id} successfully saved to backend.`);
      // --- END BACKEND PATCH LOGIC ---
      
      // 4. If backend save was successful, save to local storage
      await saveProjectToStorage(projectToSave);

      const timestamp = Date.now();
      setLastSavedTimestamp(timestamp);

      // Optionally update the main projects list if this project is new or changed
      setProjects(prevProjects => {
        const existingIndex = prevProjects.findIndex(p => p.id === projectToSave.id);
        if (existingIndex !== -1) {
          const updatedProjects = [...prevProjects];
          updatedProjects[existingIndex] = projectToSave;
          return updatedProjects;
        } else {
          return [...prevProjects, projectToSave];
        }
      });

      console.log(`Project "${projectToSave.title}" saved successfully via hook with ${projectToSave.scenes.length} scenes`);
    } catch (error) {
      console.error('Failed to save project via hook:', error);
      setPersistenceError('Failed to save project to storage.');
    } finally {
      setIsSavingProject(false);
    }
  }, []);

  // Load projects from localStorage on initial mount
  useEffect(() => {
    loadProjectsList();
  }, [loadProjectsList]);

  // --- Load Single Project ---
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    setPersistenceError(null);
    try {
      const project = await getProjectFromStorage(projectId);
      return project;
    } catch (error) {
      console.error(`Failed to load project ${projectId}:`, error);
      setPersistenceError(`Failed to load project ${projectId} from storage.`);
      return null;
    }
  }, []);

  // --- Delete Project ---
  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    setPersistenceError(null);
    try {
      // 1. Call the backend DELETE endpoint
      const response = await fetch(`/api/v1/projects/${projectId}`, {
        method: 'DELETE',
      });

      // Check if the backend deletion was successful
      if (!response.ok) {
        // Handle potential errors (e.g., 404 Not Found, 500 Server Error)
        let errorDetail = `Failed to delete project ${projectId} from backend`;
        try {
            const errorData = await response.json();
            errorDetail = errorData.detail || errorDetail;
        } catch (jsonError) {
             // Ignore if response is not JSON
             errorDetail = `${errorDetail}. Status: ${response.status}`;
        }
        console.error(errorDetail);
        throw new Error(errorDetail);
      }
      
      // 2. If backend deletion was successful (status 204), delete from local storage
      console.log(`Backend deletion successful for ${projectId}, removing from local storage.`);
      await deleteProjectFromStorage(projectId);

      // 3. Update the local state
      setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId));
      console.log(`Project ${projectId} fully deleted via hook.`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to delete project ${projectId}: ${errorMessage}`);
      setPersistenceError(`Failed to delete project ${projectId}: ${errorMessage}`);
      // Re-throw the error so the caller knows it failed
      throw error;
    }
  }, []);

  // --- Delete All Projects ---
  const deleteAllProjects = useCallback(async (): Promise<void> => {
    setPersistenceError(null);
    try {
      await clearAllProjectsFromStorage();
      setProjects([]); // Clear local state
      console.log('All projects deleted successfully via hook.');
    } catch (error) {
      console.error('Failed to delete all projects:', error);
      setPersistenceError('Failed to delete all projects from storage.');
    }
  }, []);
  
  // --- Project Exists Check ---
  const projectExists = useCallback(async (projectId: string): Promise<boolean> => {
    try {
      return await projectExistsInStorage(projectId);
    } catch (error) {
      console.error(`Failed to check existence for project ${projectId}:`, error);
      // Assume it doesn't exist on error to prevent issues
      return false;
    }
  }, []);

  // Return state and functions
  return {
    projects,
    isLoadingProjects,
    isSavingProject,
    lastSavedTimestamp,
    persistenceError,
    loadProjectsList,
    saveProject,
    loadProject,
    deleteProject,
    deleteAllProjects,
    projectExists,
  };
} 