import { Project } from '../components/project/ProjectProvider';

// Constants
const STORAGE_KEY_PREFIX = 'auto-shorts-project-';
const PROJECTS_LIST_KEY = 'auto-shorts-projects-list';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit (typical localStorage limit is 5-10MB)

// Types
export interface StorageError extends Error {
  code: 'STORAGE_FULL' | 'QUOTA_EXCEEDED' | 'INVALID_DATA' | 'NOT_FOUND' | 'UNKNOWN';
}

export interface ProjectMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string; // Optional thumbnail for project preview
}

/**
 * Creates a custom storage error
 */
function createStorageError(message: string, code: StorageError['code']): StorageError {
  const error = new Error(message) as StorageError;
  error.code = code;
  return error;
}

/**
 * Checks if localStorage is available
 */
function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Estimates the size of a string in bytes
 */
function getStringSize(str: string): number {
  // A rough estimate - each character is approximately 2 bytes in UTF-16
  return str.length * 2;
}

/**
 * Gets the current storage usage in bytes
 */
export function getStorageUsage(): number {
  if (!isStorageAvailable()) return 0;

  let totalSize = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      totalSize += getStringSize(key) + getStringSize(value);
    }
  }

  return totalSize;
}

/**
 * Gets the percentage of storage used
 */
export function getStorageUsagePercentage(): number {
  return (getStorageUsage() / MAX_STORAGE_SIZE) * 100;
}

/**
 * Constructs a storage key for a project
 */
export function getProjectKey(projectId: string): string {
  console.log(`[storage-utils] Creating project key for ID: "${projectId}"`);
  const key = `${STORAGE_KEY_PREFIX}${projectId}`;
  console.log(`[storage-utils] Generated project key: "${key}"`);
  return key;
}

/**
 * Gets a list of all projects from local storage
 */
export async function getProjects(): Promise<Project[]> {
  try {
    console.log('[storage-utils] Getting all projects from localStorage');
    // List all keys in localStorage
    const allKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      allKeys.push(key);
    }
    console.log('[storage-utils] All localStorage keys:', allKeys);

    // Filter only project keys
    const projectKeys = allKeys.filter((key) => key?.startsWith(STORAGE_KEY_PREFIX));
    console.log('[storage-utils] Found project keys:', projectKeys);

    // Get all projects
    const projects: Project[] = [];

    for (const key of projectKeys) {
      try {
        if (!key) continue;
        const projectData = localStorage.getItem(key);
        if (!projectData) {
          console.log(`[storage-utils] Empty data for project key: ${key}`);
          continue;
        }

        const project = JSON.parse(projectData) as Project;
        console.log(
          `[storage-utils] Successfully parsed project: ${key.replace(STORAGE_KEY_PREFIX, '')}, title: ${project.title}`
        );
        projects.push(project);
      } catch (error) {
        console.error(`[storage-utils] Error parsing project from key ${key}:`, error);
      }
    }

    console.log(`[storage-utils] Retrieved ${projects.length} projects`);
    // Sort projects by creation date (newest first)
    return projects.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('[storage-utils] Error getting projects:', error);
    return [];
  }
}

/**
 * Saves a project to local storage
 */
export async function saveProject(project: Project): Promise<void> {
  try {
    console.log(`[storage-utils] Saving project: ${project.id}, title: ${project.title}`);
    const key = getProjectKey(project.id);
    const projectData = JSON.stringify(project);
    console.log(`[storage-utils] Project data size: ${projectData.length} characters`);

    // Store the project data
    localStorage.setItem(key, projectData);

    // Store the project ID for quick access (used in create flow)
    localStorage.setItem('last_created_project_id', project.id);
    console.log(
      `[storage-utils] Project saved successfully and set as last created: ${project.id}`
    );

    // Update the projects list with this project's metadata
    updateProjectsList(project);
    console.log(`[storage-utils] Updated projects list with metadata for: ${project.id}`);

    // Verify the save was successful
    const savedData = localStorage.getItem(key);
    if (!savedData) {
      console.error(
        `[storage-utils] Project save verification failed - data not found for key: ${key}`
      );
    } else {
      console.log(`[storage-utils] Project save verified - found data for key: ${key}`);
    }
  } catch (error) {
    console.error(`[storage-utils] Error saving project ${project.id}:`, error);
    throw new Error(
      `Failed to save project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Updates the projects list with metadata from a project
 */
function updateProjectsList(project: Project): void {
  try {
    // Get current projects list
    const projectsListJson = localStorage.getItem(PROJECTS_LIST_KEY) || '[]';
    const projectsList: ProjectMetadata[] = JSON.parse(projectsListJson);

    // Create metadata for this project
    const metadata: ProjectMetadata = {
      id: project.id,
      title: project.title,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      // Get thumbnail from first scene with media if available
      thumbnailUrl: project.scenes.find((s) => s.media?.thumbnailUrl)?.media?.thumbnailUrl,
    };

    // Update or add to the list
    const existingIndex = projectsList.findIndex((p) => p.id === project.id);
    if (existingIndex >= 0) {
      projectsList[existingIndex] = metadata;
    } else {
      projectsList.push(metadata);
    }

    // Save updated list
    localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(projectsList));
  } catch (error) {
    console.error('Failed to update projects list:', error);
    // We don't throw here to avoid blocking the main project save
  }
}

/**
 * Gets a project from local storage
 */
export async function getProject(projectId: string): Promise<Project | null> {
  try {
    console.log(`[storage-utils] Getting project: ${projectId}`);
    const key = getProjectKey(projectId);
    const projectData = localStorage.getItem(key);

    if (!projectData) {
      console.log(`[storage-utils] No data found for project: ${projectId}, key: ${key}`);
      return null;
    }

    console.log(
      `[storage-utils] Found raw data for project ${projectId}, data length: ${projectData.length}`
    );

    try {
      const project = JSON.parse(projectData) as Project;

      // Data validation
      if (!project.id || !project.title || !Array.isArray(project.scenes)) {
        console.error(`[storage-utils] Invalid project data structure for ${projectId}:`, project);
        return null;
      }

      console.log(`[storage-utils] Successfully parsed project ${projectId}:`, {
        id: project.id,
        title: project.title,
        scenesCount: project.scenes.length,
        createdAt: new Date(project.createdAt).toISOString(),
      });

      return project;
    } catch (parseError) {
      console.error(`[storage-utils] Error parsing project ${projectId} data:`, parseError);
      console.error(`[storage-utils] Raw project data: ${projectData.substring(0, 100)}...`);
      return null;
    }
  } catch (error) {
    console.error(`[storage-utils] Error getting project ${projectId}:`, error);
    return null;
  }
}

/**
 * Gets all project metadata from localStorage
 */
export function getProjectsList(): Promise<ProjectMetadata[]> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(createStorageError('Local storage is not available', 'UNKNOWN'));
      return;
    }

    try {
      const projectsListJson = localStorage.getItem(PROJECTS_LIST_KEY) || '[]';
      const projectsList = JSON.parse(projectsListJson) as ProjectMetadata[];

      // Sort by updatedAt (most recent first)
      projectsList.sort((a, b) => b.updatedAt - a.updatedAt);

      resolve(projectsList);
    } catch (error) {
      reject(
        createStorageError(
          `Error retrieving projects list: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INVALID_DATA'
        )
      );
    }
  });
}

/**
 * Deletes a project from local storage
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    console.log(`[storage-utils] Deleting project: ${projectId}`);
    const key = getProjectKey(projectId);
    localStorage.removeItem(key);
    console.log(`[storage-utils] Project deleted: ${projectId}`);

    // Verify the delete was successful
    const deletedData = localStorage.getItem(key);
    if (deletedData) {
      console.error(
        `[storage-utils] Project delete verification failed - data still exists for key: ${key}`
      );
    } else {
      console.log(`[storage-utils] Project delete verified - no data found for key: ${key}`);
    }
  } catch (error) {
    console.error(`[storage-utils] Error deleting project ${projectId}:`, error);
    throw new Error(
      `Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clears all projects from localStorage
 */
export function clearAllProjects(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isStorageAvailable()) {
      reject(createStorageError('Local storage is not available', 'UNKNOWN'));
      return;
    }

    try {
      // Get the projects list
      const projectsListJson = localStorage.getItem(PROJECTS_LIST_KEY) || '[]';
      const projectsList = JSON.parse(projectsListJson) as ProjectMetadata[];

      // Remove each project
      projectsList.forEach((project) => {
        const projectKey = getProjectKey(project.id);
        localStorage.removeItem(projectKey);
      });

      // Clear the projects list
      localStorage.removeItem(PROJECTS_LIST_KEY);

      resolve();
    } catch (error) {
      reject(
        createStorageError(
          `Error clearing projects: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'UNKNOWN'
        )
      );
    }
  });
}

/**
 * Checks if a project exists in local storage
 */
export function projectExists(projectId: string): boolean {
  try {
    console.log(`[storage-utils] Checking if project exists: ${projectId}`);
    const key = getProjectKey(projectId);
    const exists = localStorage.getItem(key) !== null;
    console.log(`[storage-utils] Project ${projectId} exists: ${exists}, key used: ${key}`);
    return exists;
  } catch (error) {
    console.error(`[storage-utils] Error checking project existence ${projectId}:`, error);
    return false;
  }
}

/**
 * Exports a project as a JSON string
 */
export function exportProject(projectId: string): Promise<string> {
  return getProject(projectId).then((project) => JSON.stringify(project));
}

/**
 * Imports a project from a JSON string
 */
export function importProject(projectJson: string): Promise<Project> {
  return new Promise((resolve, reject) => {
    try {
      const project = JSON.parse(projectJson) as Project;

      // Validate the project structure
      if (!project.id || !project.title || !Array.isArray(project.scenes)) {
        reject(createStorageError('Invalid project data format', 'INVALID_DATA'));
        return;
      }

      // Save the imported project
      saveProject(project)
        .then(() => resolve(project))
        .catch(reject);
    } catch (error) {
      reject(
        createStorageError(
          `Error importing project: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'INVALID_DATA'
        )
      );
    }
  });
}
