/**
 * @fileoverview Storage utilities for managing project data in localStorage
 * 
 * This module provides a comprehensive set of utilities for managing project data
 * in the browser's localStorage. It handles:
 * - Project CRUD operations (Create, Read, Update, Delete)
 * - Storage space management and quota monitoring
 * - Project metadata management
 * - Error handling for storage operations
 * - Data validation and type safety
 * 
 * Key features:
 * - Automatic storage quota management
 * - Project metadata caching for quick listing
 * - Error handling with specific error types
 * - Logging for debugging and monitoring
 * - Data validation on read/write operations
 * 
 * @module storage-utils
 */

import { Project } from '../components/project/ProjectProvider';

// Constants
/**
 * Prefix for all project-related localStorage keys
 * Used to identify and filter project data in storage
 */
const STORAGE_KEY_PREFIX = 'auto-shorts-project-';

/**
 * Key for storing the list of all projects' metadata
 * This list is maintained separately for quick access to project summaries
 */
const PROJECTS_LIST_KEY = 'auto-shorts-projects-list';

/**
 * Maximum allowed storage size in bytes (5MB)
 * Most browsers limit localStorage to 5-10MB, so we use a conservative limit
 */
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB limit

// Types
/**
 * Custom error type for storage-related errors
 * @interface StorageError
 * @extends Error
 * 
 * @property {string} code - Specific error code indicating the type of storage error
 *   - STORAGE_FULL: No more space available in localStorage
 *   - QUOTA_EXCEEDED: Browser storage quota exceeded
 *   - INVALID_DATA: Data validation failed
 *   - NOT_FOUND: Requested item not found in storage
 *   - UNKNOWN: Unspecified error
 */
export interface StorageError extends Error {
  code: 'STORAGE_FULL' | 'QUOTA_EXCEEDED' | 'INVALID_DATA' | 'NOT_FOUND' | 'UNKNOWN';
}

/**
 * Metadata for quick project listing without loading full project data
 * @interface ProjectMetadata
 * 
 * @property {string} id - Unique identifier for the project
 * @property {string} title - Project title
 * @property {number} createdAt - Timestamp of project creation
 * @property {number} updatedAt - Timestamp of last project update
 * @property {string} [thumbnailUrl] - Optional URL for project thumbnail
 */
export interface ProjectMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  thumbnailUrl?: string;
}

/**
 * Creates a custom storage error with a specific error code
 * 
 * @param {string} message - Human-readable error message
 * @param {StorageError['code']} code - Specific error code
 * @returns {StorageError} Custom error object with code
 * 
 * @example
 * throw createStorageError('Storage quota exceeded', 'QUOTA_EXCEEDED');
 */
function createStorageError(message: string, code: StorageError['code']): StorageError {
  const error = new Error(message) as StorageError;
  error.code = code;
  return error;
}

/**
 * Checks if localStorage is available and functioning
 * Tests by attempting to write and read a test value
 * 
 * @returns {boolean} True if localStorage is available and working
 * 
 * @example
 * if (!isStorageAvailable()) {
 *   console.error('localStorage is not available');
 *   return;
 * }
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
 * Estimates the size of a string in bytes using UTF-16 encoding
 * This is a conservative estimate as each character is assumed to be 2 bytes
 * 
 * @param {string} str - String to measure
 * @returns {number} Estimated size in bytes
 * 
 * @example
 * const size = getStringSize(JSON.stringify(project));
 * if (size > MAX_STORAGE_SIZE) {
 *   throw createStorageError('Project too large', 'STORAGE_FULL');
 * }
 */
function getStringSize(str: string): number {
  return str.length * 2;
}

/**
 * Gets the current storage usage in bytes
 * Calculates total size by summing the size of all keys and values in localStorage
 * 
 * @returns {number} Total storage usage in bytes
 * 
 * @example
 * const usage = getStorageUsage();
 * console.log(`Storage usage: ${usage / 1024 / 1024}MB`);
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
 * Gets the percentage of storage used relative to MAX_STORAGE_SIZE
 * 
 * @returns {number} Percentage of storage used (0-100)
 * 
 * @example
 * const usagePercent = getStorageUsagePercentage();
 * if (usagePercent > 90) {
 *   console.warn('Storage usage is high: ${usagePercent}%');
 * }
 */
export function getStorageUsagePercentage(): number {
  return (getStorageUsage() / MAX_STORAGE_SIZE) * 100;
}

/**
 * Constructs a storage key for a project using the STORAGE_KEY_PREFIX
 * 
 * @param {string} projectId - Unique identifier of the project
 * @returns {string} Storage key for the project
 * 
 * @example
 * const key = getProjectKey('123');
 * // Returns: 'auto-shorts-project-123'
 */
export function getProjectKey(projectId: string): string {
  console.log(`[storage-utils] Creating project key for ID: "${projectId}"`);
  const key = `${STORAGE_KEY_PREFIX}${projectId}`;
  console.log(`[storage-utils] Generated project key: "${key}"`);
  return key;
}

/**
 * Retrieves all projects from localStorage
 * Filters for project keys, parses the data, and sorts by creation date
 * 
 * @returns {Promise<Project[]>} Array of projects sorted by creation date (newest first)
 * @throws {Error} If there's an error parsing project data
 * 
 * @example
 * const projects = await getProjects();
 * console.log(`Found ${projects.length} projects`);
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
 * Ensures project data includes all required fields by adding sensible defaults for any missing fields
 * Used to migrate older project data to newer schema requirements
 * 
 * @param {Project} project - Project data to migrate
 * @returns {Project} Project data with all required fields
 */
export function migrateProjectData(project: Project): Project {
  if (!project) return project;
  
  console.log(`[storage-utils] Migrating project data for: ${project.id}`);
  
  // Make a copy to avoid mutating the original object
  const migratedProject = { ...project };
  
  // Ensure aspectRatio exists (required in saveProject validation)
  if (!migratedProject.aspectRatio) {
    console.log(`[storage-utils] Adding missing aspectRatio field to project ${project.id}`);
    migratedProject.aspectRatio = '9:16'; // Default to vertical video
  }
  
  // Ensure showLetterboxing exists
  if (migratedProject.showLetterboxing === undefined) {
    console.log(`[storage-utils] Adding missing showLetterboxing field to project ${project.id}`);
    migratedProject.showLetterboxing = true;
  }
  
  // Ensure status exists
  if (!migratedProject.status) {
    console.log(`[storage-utils] Adding missing status field to project ${project.id}`);
    migratedProject.status = 'draft';
  }
  
  // Ensure each scene has all required fields
  if (Array.isArray(migratedProject.scenes)) {
    migratedProject.scenes = migratedProject.scenes.map(scene => {
      const migratedScene = { ...scene };
      
      // Ensure basic required scene fields
      if (!migratedScene.createdAt) {
        migratedScene.createdAt = Date.now();
      }
      
      // Ensure media object exists
      if (!migratedScene.media) {
        migratedScene.media = { type: 'video', url: '' };
      }
      
      // Ensure media has required fields
      if (migratedScene.media) {
        // Ensure trim object exists within media
        if (!migratedScene.media.trim) {
          migratedScene.media.trim = { start: 0, end: 0 };
          console.log(`[storage-utils] Added missing media.trim object for scene ${migratedScene.id}`);
        } else {
          // Ensure start and end exist within trim
          if (migratedScene.media.trim.start === undefined || migratedScene.media.trim.start === null) {
            migratedScene.media.trim.start = 0;
            console.log(`[storage-utils] Added missing media.trim.start for scene ${migratedScene.id}`);
          }
          if (migratedScene.media.trim.end === undefined || migratedScene.media.trim.end === null) {
            // Default end to duration if available, otherwise 0 (or maybe Infinity? Let's stick to 0 for now)
            migratedScene.media.trim.end = migratedScene.media.duration || 0;
            console.log(`[storage-utils] Added missing media.trim.end for scene ${migratedScene.id}, defaulting to ${migratedScene.media.trim.end}`);
          }
        }
        
        // Set mediaAspectRatio if it doesn't exist but we have width and height
        if (!migratedScene.media.mediaAspectRatio && 
            migratedScene.media.width && 
            migratedScene.media.height && 
            migratedScene.media.height > 0) {
          migratedScene.media.mediaAspectRatio = migratedScene.media.width / migratedScene.media.height;
          console.log(`[storage-utils] Calculated missing mediaAspectRatio for scene ${migratedScene.id}: ${migratedScene.media.mediaAspectRatio}`);
        }
      }
      
      return migratedScene;
    });
  }
  
  console.log(`[storage-utils] Project migration complete for: ${project.id}`);
  return migratedProject;
}

/**
 * Saves a project to localStorage
 * Includes validation checks to ensure project data meets requirements
 * 
 * @param {Project} project - Project data to save
 * @returns {Promise<void>}
 * @throws {Error} If project data is invalid or saving fails
 * 
 * @example
 * try {
 *   await saveProject(project);
 *   console.log('Project saved successfully');
 * } catch (error) {
 *   console.error('Failed to save project:', error);
 * }
 */
export const saveProject = async (project: Project): Promise<void> => {
  try {
    // First run the project through migration to ensure all required fields are present
    const projectToSave = migrateProjectData(project);
    
    console.log('[storage-utils] Saving project:', projectToSave.id, ', title:', projectToSave.title);
    console.log('[storage-utils] Project contains', projectToSave.scenes.length, 'scenes, scene IDs:', projectToSave.scenes.map(s => s.id));
    
    // Ensure required fields are present
    if (!projectToSave.id || !projectToSave.aspectRatio) {
      console.error('[storage-utils] Invalid project data:', projectToSave);
      throw new Error('Invalid project data: missing required fields');
    }

    // Create project key
    console.log('[storage-utils] Creating project key for ID:', JSON.stringify(projectToSave.id));
    const key = `auto-shorts-project-${projectToSave.id}`;
    console.log('[storage-utils] Generated project key:', JSON.stringify(key));

    // Save project data
    const projectJson = JSON.stringify(projectToSave);
    console.log('[storage-utils] Project data size:', projectJson.length, 'characters');
    localStorage.setItem(key, projectJson);

    // Update projects list metadata
    const projectsListKey = 'auto-shorts-projects-list';
    const projectsListJson = localStorage.getItem(projectsListKey) || '[]';
    const projectsList = JSON.parse(projectsListJson);

    // Create metadata for this project
    const metadata = {
      id: projectToSave.id,
      title: projectToSave.title,
      createdAt: projectToSave.createdAt,
      updatedAt: projectToSave.updatedAt,
      aspectRatio: projectToSave.aspectRatio,
      thumbnailUrl: projectToSave.scenes.find(s => s.media?.thumbnailUrl)?.media?.thumbnailUrl,
      scenesCount: projectToSave.scenes.length,
    };

    // Update or add to the list
    const existingIndex = projectsList.findIndex((p: { id: string }) => p.id === projectToSave.id);
    if (existingIndex >= 0) {
      projectsList[existingIndex] = metadata;
    } else {
      projectsList.push(metadata);
    }

    // Save updated list
    localStorage.setItem(projectsListKey, JSON.stringify(projectsList));
    console.log('[storage-utils] Project saved successfully and set as last created:', projectToSave.id);

    // Verify the save
    const savedProjectJson = localStorage.getItem(key);
    if (!savedProjectJson) {
      throw new Error('Project save verification failed - data not found');
    }

    const savedProject = JSON.parse(savedProjectJson);
    console.log('[storage-utils] Project save verified - found', savedProject.scenes.length, 'scenes in saved project', savedProject.id);
    console.log('[storage-utils] Project save verified - found data for key:', key);
    
    // Verify aspect ratio was saved
    if (savedProject.aspectRatio !== projectToSave.aspectRatio) {
      console.error('[storage-utils] Aspect ratio mismatch in saved project:', {
        expected: projectToSave.aspectRatio,
        saved: savedProject.aspectRatio
      });
      throw new Error('Project save verification failed - aspect ratio mismatch');
    }
  } catch (error) {
    console.error('[storage-utils] Error saving project:', error);
    throw error;
  }
};

/**
 * Retrieves a specific project from localStorage
 * Includes validation of the project data structure
 * 
 * @param {string} projectId - ID of the project to retrieve
 * @returns {Promise<Project | null>} Project if found and valid, null otherwise
 * 
 * @example
 * const project = await getProject('123');
 * if (project) {
 *   console.log('Found project:', project.title);
 * } else {
 *   console.log('Project not found');
 * }
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

      // Apply data migration to ensure all required fields are present
      const migratedProject = migrateProjectData(project);
      
      // Log scene information for debugging
      console.log(
        `[storage-utils] Successfully loaded project ${projectId} with ${migratedProject.scenes.length} scenes: [${migratedProject.scenes.map(s => s.id).join(', ')}]`
      );
      
      console.log(`[storage-utils] Successfully parsed project ${projectId}:`, {
        id: migratedProject.id,
        title: migratedProject.title,
        scenesCount: migratedProject.scenes.length,
        createdAt: migratedProject.createdAt,
        aspectRatio: migratedProject.aspectRatio
      });

      return migratedProject;
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
 * Retrieves the list of all project metadata
 * This is a lightweight operation as it only loads the metadata list
 * 
 * @returns {Promise<ProjectMetadata[]>} Array of project metadata
 * 
 * @example
 * const projectsList = await getProjectsList();
 * console.log(`Found ${projectsList.length} projects`);
 * projectsList.forEach(p => console.log(`${p.title} (${p.id})`));
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
 * Deletes a project and its metadata from localStorage
 * 
 * @param {string} projectId - ID of the project to delete
 * @returns {Promise<void>}
 * @throws {Error} If project deletion fails
 * 
 * @example
 * try {
 *   await deleteProject('123');
 *   console.log('Project deleted successfully');
 * } catch (error) {
 *   console.error('Failed to delete project:', error);
 * }
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    console.log(`[storage-utils] Deleting project: ${projectId}`);
    
    // 1. Remove the project data
    const key = getProjectKey(projectId);
    localStorage.removeItem(key);
    console.log(`[storage-utils] Project data deleted: ${projectId}`);

    // 2. Also update the projects list metadata to remove this project
    try {
      const projectsListJson = localStorage.getItem(PROJECTS_LIST_KEY) || '[]';
      const projectsList: ProjectMetadata[] = JSON.parse(projectsListJson);
      
      // Filter out the deleted project
      const updatedList = projectsList.filter(p => p.id !== projectId);
      
      // Save the updated list back to localStorage
      localStorage.setItem(PROJECTS_LIST_KEY, JSON.stringify(updatedList));
      console.log(`[storage-utils] Project removed from projects list: ${projectId}`);
    } catch (listError) {
      console.error(`[storage-utils] Error updating projects list after deletion:`, listError);
      // Continue with the function even if updating the list fails
    }

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
 * Removes all projects and related data from localStorage
 * This is a destructive operation that cannot be undone
 * 
 * @returns {Promise<void>}
 * @throws {Error} If clearing projects fails
 * 
 * @example
 * try {
 *   await clearAllProjects();
 *   console.log('All projects cleared successfully');
 * } catch (error) {
 *   console.error('Failed to clear projects:', error);
 * }
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
 * Checks if a project exists in localStorage
 * 
 * @param {string} projectId - ID of the project to check
 * @returns {boolean} True if the project exists
 * 
 * @example
 * if (projectExists('123')) {
 *   console.log('Project exists');
 * } else {
 *   console.log('Project not found');
 * }
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
 * Useful for project backup or sharing
 * 
 * @param {string} projectId - ID of the project to export
 * @returns {Promise<string>} JSON string representation of the project
 * @throws {Error} If project not found or export fails
 * 
 * @example
 * try {
 *   const json = await exportProject('123');
 *   console.log('Project exported successfully');
 *   // Save json to file or share with user
 * } catch (error) {
 *   console.error('Failed to export project:', error);
 * }
 */
export function exportProject(projectId: string): Promise<string> {
  return getProject(projectId).then((project) => JSON.stringify(project));
}

/**
 * Imports a project from a JSON string
 * Validates the project data before importing
 * 
 * @param {string} projectJson - JSON string representation of the project
 * @returns {Promise<Project>} The imported project
 * @throws {Error} If import fails or validation fails
 * 
 * @example
 * try {
 *   const project = await importProject(jsonString);
 *   console.log('Project imported successfully:', project.title);
 * } catch (error) {
 *   console.error('Failed to import project:', error);
 * }
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
