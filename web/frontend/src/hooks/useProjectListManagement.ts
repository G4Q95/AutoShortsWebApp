import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectPersistence } from './useProjectPersistence';
import { Project, generateId } from '@/components/project/ProjectTypes'; 
import { deleteProject as deleteProjectFromAPI } from '@/lib/api/projects'; // Ensure correct path

// Assuming ProjectContext dispatch type is available or defined here
// If not, we might need to pass dispatch as an argument or rethink state management
// For now, let's assume a simplified approach where persistence handles most state
// and navigation/basic loading state is handled here.

interface ProjectListManagement {
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (projectId: string) => Promise<string | null>;
  // Add loading/error states if needed
  isLoading: boolean;
  error: string | null;
}

export function useProjectListManagement(/* May need dispatch here */): ProjectListManagement {
  const {
    loadProject: loadProjectFromHook,
    deleteProject: deleteProjectFromHook,
    saveProject,
    projects: persistedProjects,
    // Use correct state names from the persistence hook
    isLoadingProjects: persistenceIsLoadingProjects, 
    isSavingProject: persistenceIsSavingProject, // Add if needed for duplication visual feedback
    persistenceError,
  } = useProjectPersistence();
  
  const router = useRouter();

  // Use the states from the persistence hook
  const isLoading = persistenceIsLoadingProjects || persistenceIsSavingProject; // Combine loading states
  const error = persistenceError;

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    // Consider adding local loading state if persistence hook doesn't cover UI needs
    try {
      // Delete from API first (if applicable, persistence hook might handle this)
      // await deleteProjectFromAPI(projectId); // This might be redundant if useProjectPersistence handles API calls
      
      // Delete from local storage via persistence hook
      await deleteProjectFromHook(projectId);
      
      // Optionally navigate away if the deleted project was the current one
      // This logic might be better placed in the component calling the hook
      // router.push('/'); 
      console.log(`Project ${projectId} deleted successfully.`);
      
    } catch (err) {
      console.error(`Error deleting project ${projectId}:`, err);
      // Handle error state if needed
      throw err; // Re-throw for the component to handle
    } finally {
      // Handle loading state if needed
    }
  }, [deleteProjectFromHook, router]);

  const duplicateProject = useCallback(async (projectId: string): Promise<string | null> => {
    // Consider adding local loading state or using isSavingProject
    try {
      const originalProject = await loadProjectFromHook(projectId);
      if (!originalProject) {
        throw new Error('Original project not found for duplication');
      }
      
      const newId = generateId();
      const baseTitle = `${originalProject.title} (Copy)`;
      
      // Ensure unique title
      let finalTitle = baseTitle;
      let counter = 1;
      // Check against the projects list from the persistence hook
      while (persistedProjects.some(p => p.title === finalTitle)) {
        finalTitle = `${baseTitle} ${counter}`;
        counter++;
      }
      
      // Create the duplicated project object
      const duplicatedProject: Project = {
        ...originalProject,
        id: newId,
        title: finalTitle,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Reset any instance-specific fields if necessary
      };
      
      // Save the new duplicated project using the persistence hook
      await saveProject(duplicatedProject);
      console.log(`Project ${projectId} duplicated successfully as ${newId}.`);
      
      return newId; // Return the ID of the new project
      
    } catch (err) {
      console.error(`Error duplicating project ${projectId}:`, err);
      // Handle error state if needed
      return null; // Indicate failure
    } finally {
      // Handle loading state if needed
    }
  }, [loadProjectFromHook, saveProject, persistedProjects]);

  return {
    deleteProject,
    duplicateProject,
    isLoading, // Use combined loading state
    error,
  };
} 