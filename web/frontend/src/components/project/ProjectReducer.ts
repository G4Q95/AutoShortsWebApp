/**
 * @fileoverview Project state management reducer implementation.
 * This file contains the core reducer function that handles all project-related state updates
 * in a predictable and type-safe manner.
 */

import { 
  ProjectState, 
  ProjectAction, 
  Project, 
  Scene, 
  generateId 
} from './ProjectTypes';
import { getProject } from '../../lib/storage-utils';

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
        status: 'draft',
      };

      return {
        ...state,
        projects: [...state.projects, newProject],
        currentProject: newProject,
        error: null,
      };
    }

    /**
     * Sets the current active project by ID.
     * Attempts to find the project in state, falls back to localStorage if not found.
     * 
     * @action SET_CURRENT_PROJECT
     * @payload { projectId: string }
     */
    case 'SET_CURRENT_PROJECT': {
      const project = state.projects.find((p) => p && p.id === action.payload.projectId) || null;
      
      // If project not found, log it and attempt to load it from localStorage
      if (!project && action.payload.projectId) {
        console.log(`Project ${action.payload.projectId} not found in state projects array, will attempt to load from localStorage`);
        
        // Return current state for now - component should handle loading via the loadProject function
        // The next action will be LOAD_PROJECT_SUCCESS which will properly set the current project
        return {
          ...state,
          error: `Project with ID ${action.payload.projectId} not found in state, attempting to load...`,
        };
      }
      
      return {
        ...state,
        currentProject: project,
        error: project ? null : `Project with ID ${action.payload.projectId} not found`,
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
          error: 'No active project to update scene in',
        };
      }

      // Find the scene with the matching ID
      const existingSceneIndex = state.currentProject.scenes.findIndex(
        (scene) => scene.id === action.payload.sceneId
      );

      let updatedScenes;
      if (existingSceneIndex >= 0) {
        // Update existing scene
        updatedScenes = state.currentProject.scenes.map((scene) =>
          scene.id === action.payload.sceneId
            ? { 
                ...scene, 
                ...action.payload.sceneData, 
                isLoading: false, 
                error: undefined,
                url: scene.url // Preserve the original URL
              }
            : scene
        );
      } else {
        // Scene doesn't exist yet, add it as a new scene
        console.log(`Scene ${action.payload.sceneId} not found in current scenes, adding as new scene`);
        const newScene: Scene = {
          id: action.payload.sceneId,
          url: action.payload.sceneData.url || '', // Use URL from sceneData if available
          text: action.payload.sceneData.text || '', // Ensure text is provided and not undefined
          source: action.payload.sceneData.source || { platform: 'reddit' }, // Ensure source is provided
          ...action.payload.sceneData,
          isLoading: false,
          createdAt: Date.now(),
        };
        updatedScenes = [...state.currentProject.scenes, newScene];
      }

      const updatedProject: Project = {
        ...state.currentProject,
        scenes: updatedScenes,
        updatedAt: Date.now(),
      };

      console.log(`Updated project scenes count: ${updatedScenes.length}`);

      // Safely update projects array
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
     * Updates state after successfully duplicating a project.
     * Adds the duplicated project to the projects array.
     * 
     * @action DUPLICATE_PROJECT_SUCCESS
     * @payload { project: Project }
     */
    case 'DUPLICATE_PROJECT_SUCCESS':
      return {
        ...state,
        currentProject: action.payload.project,
        projects: [...state.projects, action.payload.project],
        error: null,
      };

    /**
     * Updates state after successfully deleting all projects.
     * Clears the projects array and current project.
     * 
     * @action DELETE_ALL_PROJECTS_SUCCESS
     */
    case 'DELETE_ALL_PROJECTS_SUCCESS':
      return {
        ...state,
        projects: [],
        currentProject: null,
        error: null,
      };

    /**
     * Sets the UI mode for the project workspace
     * Controls which features are visible and active in the UI
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

    default:
      // Just return the state for unhandled action types
      return state;
  }
} 