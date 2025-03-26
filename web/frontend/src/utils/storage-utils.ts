import { Project } from '../components/project/ProjectTypes';

export const getProject = async (projectId: string): Promise<Project | null> => {
  try {
    const key = `auto-shorts-project-${projectId}`;
    const projectJson = localStorage.getItem(key);
    
    if (!projectJson) {
      console.warn('[storage-utils] Project not found in localStorage:', projectId);
      return null;
    }

    const project = JSON.parse(projectJson);

    // Validate project data
    if (!project || !project.id || !project.aspectRatio) {
      console.error('[storage-utils] Invalid project data:', project);
      return null;
    }

    console.log('[storage-utils] Successfully retrieved project:', {
      id: project.id,
      aspectRatio: project.aspectRatio,
      updatedAt: project.updatedAt
    });

    return project;
  } catch (error) {
    console.error('[storage-utils] Error retrieving project:', error);
    return null;
  }
}; 