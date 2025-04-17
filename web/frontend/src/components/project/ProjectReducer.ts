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
     * NOTE: This case now ONLY adds the project to the projects list.
     * The useProjectCore hook handles setting the active project state internally.
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
     * NOTE: Removed as the hook manages its own state and LOAD_PROJECT_SUCCESS handles adding to list.
     *
     * @action CREATE_PROJECT_SUCCESS
     * @payload { project: Project }
     */
    // case 'CREATE_PROJECT_SUCCESS': { // Removed case
    // }

    /**
     * Sets the current active project.
     * NOTE: Removed as hook handles current project state internally.
     *
     * @action SET_CURRENT_PROJECT
     * @payload { project: Project | null }
     */
    // case 'SET_CURRENT_PROJECT': { // Removed case
    // }

    /**
     * Adds a new scene to the current project.
     * NOTE: Removed as hook handles scene management.
     *
     * @action ADD_SCENE
     * @payload { url: string }
     */
    // case 'ADD_SCENE': { // Removed case
    // }

    /**
     * Marks a scene as loading while content is being fetched.
     * NOTE: Removed as hook handles scene management.
     *
     * @action ADD_SCENE_LOADING
     * @payload { sceneId: string; url: string }
     */
    // case 'ADD_SCENE_LOADING': { // Removed case
    // }

    /**
     * Updates a scene with successfully loaded content.
     * NOTE: Removed as hook handles scene management.
     *
     * @action ADD_SCENE_SUCCESS
     * @payload { sceneId: string; sceneData: Partial<Scene> }
     */
    // case 'ADD_SCENE_SUCCESS': { // Removed case
    // }

    /**
     * Marks a scene as failed due to an error.
     * NOTE: Removed as hook handles scene management. SET_ERROR is used for general errors.
     *
     * @action ADD_SCENE_ERROR
     * @payload { sceneId: string; error: string }
     */
    // case 'ADD_SCENE_ERROR': { // Removed case
    // }

    /**
     * Removes a scene from the current project.
     * NOTE: Removed as hook handles scene management.
     *
     * @action REMOVE_SCENE
     * @payload { sceneId: string }
     */
    // case 'REMOVE_SCENE': { // Removed case
    // }

    /**
     * Reorders scenes in the current project.
     * NOTE: Removed as hook handles scene management.
     *
     * @action REORDER_SCENES
     * @payload { sceneIds: string[] }
     */
    // case 'REORDER_SCENES': { // Removed case
    // }

    /**
     * Updates the text content of a scene.
     * NOTE: Removed as hook handles scene management.
     *
     * @action UPDATE_SCENE_TEXT
     * @payload { sceneId: string; text: string }
     */
    // case 'UPDATE_SCENE_TEXT': { // Removed case
    // }

    /**
     * Updates the audio data of a scene.
     * NOTE: Removed as hook handles scene management.
     *
     * @action UPDATE_SCENE_AUDIO
     * @payload { sceneId: string; audioData?: { audio_url?: string; audio_base64?: string; content_type?: string; persistentUrl?: string; storageKey?: string }; voiceSettings?: { voice_id: string; stability: number; similarity_boost: number } }
     */
    // case 'UPDATE_SCENE_AUDIO': { // Removed case
    // }
    
    /**
     * Updates the media data of a scene with storage information.
     * NOTE: Removed as hook handles scene management.
     *
     * @action UPDATE_SCENE_MEDIA
     * @payload { sceneId: string; mediaData: Partial<Scene['media']> }
     */
    // case 'UPDATE_SCENE_MEDIA': { // Removed case
    // }

    /**
     * Updates the title of the current project.
     * NOTE: Removed as hook handles current project state.
     *
     * @action SET_PROJECT_TITLE
     * @payload { title: string }
     */
    // case 'SET_PROJECT_TITLE': { // Removed case
    // }

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
     * NOTE: Only updates the projects list now.
     *
     * @action LOAD_PROJECT_SUCCESS
     * @payload { project: Project }
     */
    case 'LOAD_PROJECT_SUCCESS':
      return {
        ...state,
        isLoading: false,
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
     * NOTE: Removed as hook handles scene management.
     *
     * @action SET_SCENE_STORING_MEDIA
     * @payload { sceneId: string; isStoringMedia: boolean }
     */
    // case 'SET_SCENE_STORING_MEDIA': { // Removed case
    // }

    /**
     * Updates the aspect ratio of the project.
     * NOTE: Removed as hook handles current project state.
     *
     * @action SET_PROJECT_ASPECT_RATIO
     * @payload { aspectRatio: '9:16' | '16:9' | '1:1' | '4:5' }
     */
    // case 'SET_PROJECT_ASPECT_RATIO': { // Removed case
    // }

    /**
     * Toggles letterboxing for the project.
     * NOTE: Removed as hook handles current project state.
     *
     * @action TOGGLE_LETTERBOXING
     * @payload { showLetterboxing: boolean }
     */
    // case 'TOGGLE_LETTERBOXING': { // Removed case
    // }

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