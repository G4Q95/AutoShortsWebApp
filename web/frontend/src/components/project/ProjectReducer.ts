/**
 * @fileoverview Project state management reducer implementation.
 * This file contains the core reducer function that handles all project-related state updates
 * in a predictable and type-safe manner.
 */

import { 
  ProjectState, 
  Project, 
  Scene,
  ProjectAction as ProjectActionType,
  generateId
} from './ProjectTypes';
// import { getProject } from '../../lib/storage-utils';

// Use the imported type directly
export type ProjectAction = ProjectActionType;

/**
 * Project state reducer that handles all project-related state updates.
 * Implements a Redux-style reducer pattern for managing project state.
 * 
 * Features:
 * - Type-safe action handling with TypeScript
 * - Immutable state updates
 * - Comprehensive error handling
 * - Logging for debugging
 * - Automatic timestamps for state changes
 * 
 * State Updates:
 * - Project creation and management
 * - Scene addition, updating, and removal
 * - Scene reordering
 * - Error handling
 * - Loading states
 * - Save status tracking
 * - UI mode management
 * 
 * @param state - Current project state
 * @param action - Action to process with type and optional payload
 * @returns Updated project state
 * 
 * @example
 * ```ts
 * // Create a new project
 * const newState = projectReducer(currentState, {
 *   type: 'CREATE_PROJECT',
 *   payload: { title: 'My New Project' }
 * });
 * 
 * // Add a scene to current project
 * const updatedState = projectReducer(currentState, {
 *   type: 'ADD_SCENE',
 *   payload: { url: 'https://reddit.com/...' }
 * });
 * ```
 */
export function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    /**
     * Creates a new project with the given title.
     * Generates a unique ID and initializes the project with default values.
     * 
     * @action CREATE_PROJECT
     * @payload { title: string }
     */
    case 'CREATE_PROJECT': {
      const newProject: Project = {
        id: generateId(),
        title: action.payload.title,
        scenes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastModified: Date.now(),
        status: 'draft',
        aspectRatio: '9:16',  // Set default aspect ratio
        showLetterboxing: true,  // Enable letterboxing by default
      };

      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
        error: null,
      };
    }

    /**
     * Handles successful project creation from the useProjectCore hook.
     * Adds the new project to the list and sets it as the current project.
     * 
     * @action CREATE_PROJECT_SUCCESS
     * @payload { project: Project }
     */
    case 'CREATE_PROJECT_SUCCESS': {
      const { project: newProject } = action.payload;
      
      // Check if project already exists to prevent duplicates (optional but good practice)
      const projectExists = state.projects.some(p => p.id === newProject.id);
      
      return {
        ...state,
        // Add project only if it doesn't already exist
        projects: projectExists ? state.projects : [...state.projects, newProject],
        currentProject: newProject, // Set the newly created project as current
        error: null, // Clear any previous error
      };
    }

    /**
     * Sets the current active project.
     * 
     * @action SET_CURRENT_PROJECT
     * @payload { project: Project | null }
     */
    case 'SET_CURRENT_PROJECT': {
      const { projectId } = action.payload; // Get projectId from payload
      
      if (projectId === null) {
        return {
          ...state,
          currentProject: null,
          error: null,
        };
      }

      const project = state.projects.find(p => p.id === projectId) || null;

      if (!project) {
        console.error(`REDUCER: Project with ID ${projectId} not found in state.projects`);
        return {
          ...state,
          currentProject: null, // Set to null if not found
          error: `Project ${projectId} not found`, // Set an error
        };
      }

      return {
        ...state,
        currentProject: project, // Set the found project
        error: null,
      };
    }

    /**
     * Adds a new scene to the current project.
     * 
     * @action ADD_SCENE
     * @payload { url: string }
     */
    case 'ADD_SCENE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to',
        };
      }

      const newScene: Scene = {
        id: generateId(),
        url: action.payload.url,
        text: '',
        source: {
          platform: 'reddit', // Default to reddit for now
        },
        createdAt: Date.now(),
        isLoading: true,
      };

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: [...state.currentProject.scenes, newScene],
        updatedAt: Date.now(),
      };

      // Create updated projects array, safely handling null projects
      const updatedProjects = state.projects.map(p => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    /**
     * Marks a scene as loading while content is being fetched.
     * Creates a new scene with loading state and adds it to the current project.
     * 
     * @action ADD_SCENE_LOADING
     * @payload { sceneId: string; url: string }
     */
    case 'ADD_SCENE_LOADING': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to',
        };
      }

      const newScene: Scene = {
        id: action.payload.sceneId,
        url: action.payload.url,
        text: '',
        source: {
          platform: 'reddit', // Default to reddit for now
        },
        createdAt: Date.now(),
        isLoading: true,
      };

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: [...state.currentProject.scenes, newScene],
        updatedAt: Date.now(),
      };

      // Create updated projects array, safely handling null projects
      const updatedProjects = state.projects.map(p => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    /**
     * Updates a scene with successfully loaded content.
     * If the scene exists, updates it; if not, creates a new scene.
     * 
     * @action ADD_SCENE_SUCCESS
     * @payload { sceneId: string; sceneData: Partial<Scene> }
     */
    case 'ADD_SCENE_SUCCESS': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to add scene to',
        };
      }

      // Find and update the scene by ID with the new data
      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          // Merge existing scene data with new partial data
          return {
            ...scene,
            ...action.payload.sceneData,
            isLoading: false, // Mark loading as complete
            error: undefined, // Clear any previous error
            updatedAt: Date.now(), // Update timestamp
          };
        }
        return scene;
      });

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Create updated projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    /**
     * Marks a scene as failed due to an error.
     * Updates the scene with error information while preserving other data.
     * 
     * @action ADD_SCENE_ERROR
     * @payload { sceneId: string; error: string }
     */
    case 'ADD_SCENE_ERROR': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? { ...scene, isLoading: false, error: action.payload.error }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Removes a scene from the current project.
     * Logs debug information and handles edge cases.
     * 
     * @action REMOVE_SCENE
     * @payload { sceneId: string }
     */
    case 'REMOVE_SCENE': {
      if (!state.currentProject) {
        console.error('REMOVE_SCENE action failed: No active project in state');
        return {
          ...state,
          error: 'No active project to remove scene from',
        };
      }

      const sceneId = action.payload.sceneId;
      console.log(`Reducer: Removing scene ${sceneId} from project ${state.currentProject.id}`);

      // Verify the scene exists and log scene IDs for debugging
      const projectScenes = state.currentProject.scenes || [];
      const currentSceneIds = projectScenes.map(s => s.id);
      const sceneExists = currentSceneIds.includes(sceneId);
      
      if (!sceneExists) {
        console.warn(`Scene with ID ${sceneId} not found in project ${state.currentProject.id}. Available scenes: ${JSON.stringify(currentSceneIds)}`);
      }

      // Remove the scene from the array even if it doesn't exist (idempotent operation)
      const updatedScenes = projectScenes.filter(
        (scene) => scene.id !== sceneId
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      console.log(`Reducer: Project updated after scene removal. Original count: ${projectScenes.length}, New count: ${updatedScenes.length}`);

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null, // Clear any previous errors
      };
    }

    /**
     * Reorders scenes in the current project.
     * Creates a new scene array based on the provided scene IDs order.
     * 
     * @action REORDER_SCENES
     * @payload { sceneIds: string[] }
     */
    case 'REORDER_SCENES': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to reorder scenes in',
        };
      }

      // Create a map of id -> scene for quick lookup
      const sceneMap = new Map(
        state.currentProject.scenes.map((scene) => [scene.id, scene])
      );

      // Create new scenes array based on sceneIds order
      const updatedScenes = action.payload.sceneIds
        .map((id) => sceneMap.get(id))
        .filter(Boolean) as Scene[];

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Updates the text content of a scene.
     * Preserves other scene data while updating the text.
     * 
     * @action UPDATE_SCENE_TEXT
     * @payload { sceneId: string; text: string }
     */
    case 'UPDATE_SCENE_TEXT': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? { ...scene, text: action.payload.text }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Updates the audio data of a scene.
     * 
     * @action UPDATE_SCENE_AUDIO
     * @payload { sceneId: string; audioData?: { audio_url?: string; audio_base64?: string; content_type?: string; persistentUrl?: string; storageKey?: string }; voiceSettings?: { voice_id: string; stability: number; similarity_boost: number } }
     */
    case 'UPDATE_SCENE_AUDIO': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene audio in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) =>
        scene.id === action.payload.sceneId
          ? {
              ...scene,
              audio: action.payload.audioData || {},
              voiceSettings: action.payload.voiceSettings,
            }
          : scene
      );

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Update projects array
      const updatedProjects = state.projects.map(p => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Updates the media data of a scene with storage information.
     * 
     * @action UPDATE_SCENE_MEDIA
     * @payload { sceneId: string; mediaData: Partial<Scene['media']> }
     */
    case 'UPDATE_SCENE_MEDIA': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene media in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          const currentMedia = scene.media || {
            type: 'image' as const,
            url: '',
          };
          
          const mediaData = action.payload.mediaData || {};
          
          return { 
            ...scene, 
            media: {
              ...currentMedia,
              ...mediaData,
              // Ensure required properties are present
              type: mediaData.type || currentMedia.type,
              url: mediaData.url || currentMedia.url,
            }
          };
        }
        return scene;
      });

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Updates the title of the current project.
     * 
     * @action SET_PROJECT_TITLE
     * @payload { title: string }
     */
    case 'SET_PROJECT_TITLE': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update title for',
        };
      }

      const updatedProject: Project = {
        ...state.currentProject,
        title: action.payload.title,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Sets an error message in the state.
     * 
     * @action SET_ERROR
     * @payload { error: string }
     */
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload.error,
      };

    /**
     * Clears the current error message.
     * 
     * @action CLEAR_ERROR
     */
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    /**
     * Sets the loading state.
     * 
     * @action SET_LOADING
     * @payload { isLoading: boolean }
     */
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload.isLoading,
      };

    /**
     * Loads all projects into state.
     * 
     * @action LOAD_PROJECTS
     * @payload { projects: Project[] }
     */
    case 'LOAD_PROJECTS':
      return {
        ...state,
        projects: action.payload.projects,
        error: null,
      };

    /**
     * Sets the saving state.
     * 
     * @action SET_SAVING
     * @payload { isSaving: boolean }
     */
    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.payload.isSaving,
      };

    /**
     * Updates the last saved timestamp.
     * 
     * @action SET_LAST_SAVED
     * @payload { timestamp: number }
     */
    case 'SET_LAST_SAVED':
      return {
        ...state,
        lastSaved: action.payload.timestamp,
      };

    /**
     * Updates state after successfully loading a project.
     * Adds or updates the project in the projects array.
     * 
     * @action LOAD_PROJECT_SUCCESS
     * @payload { project: Project }
     */
    case 'LOAD_PROJECT_SUCCESS':
      return {
        ...state,
        currentProject: action.payload.project,
        projects: [
          ...state.projects.filter((p) => p && p.id !== action.payload.project.id),
          action.payload.project,
        ],
        error: null,
      };

    /**
     * Update state after successfully duplicating a project.
     * 
     * @action DUPLICATE_PROJECT_SUCCESS
     * @payload { projectId: string }
     */
    case 'DUPLICATE_PROJECT_SUCCESS': {
      return {
        ...state,
        isLoading: false,
        error: null,
      };
    }

    /**
     * Update state after successfully deleting all projects.
     * 
     * @action CLEAR_ALL_PROJECTS
     */
    case 'CLEAR_ALL_PROJECTS': {
      return {
        ...state,
        projects: [],
        currentProject: null,
        isLoading: false,
        error: null,
      };
    }

    /**
     * Set the UI mode for progressive enhancement.
     * 
     * @action SET_MODE
     * @payload { mode: 'organization' | 'voice-enabled' | 'preview' }
     */
    case 'SET_MODE': {
      return {
        ...state,
        mode: action.payload.mode,
      };
    }

    /**
     * Updates whether a scene is currently storing media to R2.
     * 
     * @action SET_SCENE_STORING_MEDIA
     * @payload { sceneId: string; isStoringMedia: boolean }
     */
    case 'SET_SCENE_STORING_MEDIA': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update scene media storage state in',
        };
      }

      const updatedScenes = state.currentProject.scenes.map((scene) => {
        if (scene.id === action.payload.sceneId) {
          return { 
            ...scene, 
            isStoringMedia: action.payload.isStoringMedia
          };
        }
        return scene;
      });

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    /**
     * Updates the aspect ratio of the project.
     * 
     * @action SET_PROJECT_ASPECT_RATIO
     * @payload { aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' }
     */
    case 'SET_PROJECT_ASPECT_RATIO': {
      if (!state.currentProject) {
        console.warn('[ProjectReducer] No active project to update aspect ratio for');
        return {
          ...state,
          error: 'No active project to update aspect ratio for',
        };
      }

      console.log('[ProjectReducer] Updating aspect ratio:', {
        oldRatio: state.currentProject.aspectRatio,
        newRatio: action.payload.aspectRatio,
        projectId: state.currentProject.id
      });

      // Create new project object with updated aspect ratio
      const updatedProject: Project = {
        ...state.currentProject,
        aspectRatio: action.payload.aspectRatio,
        updatedAt: Date.now(),
      };

      // Create new projects array with updated project
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      // Immediately persist to localStorage
      try {
        const key = `auto-shorts-project-${updatedProject.id}`;
        localStorage.setItem(key, JSON.stringify(updatedProject));

        // Update the projects list metadata
        const projectsListKey = 'auto-shorts-projects-list';
        const projectsListJson = localStorage.getItem(projectsListKey) || '[]';
        const projectsList = JSON.parse(projectsListJson);
        
        // Update metadata in the projects list
        const updatedProjectsList = projectsList.map((p: any) => {
          if (p.id === updatedProject.id) {
            return {
              ...p,
              updatedAt: updatedProject.updatedAt,
              aspectRatio: updatedProject.aspectRatio
            };
          }
          return p;
        });

        localStorage.setItem(projectsListKey, JSON.stringify(updatedProjectsList));
        console.log('[ProjectReducer] Successfully persisted aspect ratio change to localStorage');
      } catch (error) {
        console.error('[ProjectReducer] Failed to persist aspect ratio change to localStorage:', error);
      }

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
        error: null,
      };
    }

    /**
     * Toggles letterboxing for the project.
     * 
     * @action TOGGLE_LETTERBOXING
     * @payload { showLetterboxing: boolean }
     */
    case 'TOGGLE_LETTERBOXING': {
      if (!state.currentProject) {
        return {
          ...state,
          error: 'No active project to update letterboxing for',
        };
      }

      console.log('[ProjectReducer] Toggling letterboxing:', action.payload.showLetterboxing);

      const updatedProject: Project = {
        ...state.currentProject,
        showLetterboxing: action.payload.showLetterboxing,
        updatedAt: Date.now(),
      };

      // Safely update projects array
      const updatedProjects = state.projects.map((p) => 
        p && p.id === updatedProject.id ? updatedProject : p
      );

      return {
        ...state,
        currentProject: updatedProject,
        projects: updatedProjects,
      };
    }

    case 'FORCE_UPDATE': {
      // This is a no-op action that just triggers a re-render
      console.log('[ProjectReducer] Forcing update');
      return { ...state };
    }

    // Default case: unrecognized action type
    default:
      return state;
  }
} 