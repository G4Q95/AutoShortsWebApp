/**
 * @fileoverview Core type definitions for the project management system.
 * This file contains all the TypeScript interfaces and types used throughout
 * the project components and state management.
 */

import { generateId } from '../../lib/id-utils';

/**
 * Represents a single scene in a project.
 * A scene is a content unit that can contain media (image, video, or gallery)
 * and associated text content.
 */
export interface Scene {
  /** Unique identifier for the scene */
  id: string;
  /** Source URL where the content was extracted from */
  url: string;
  /** Media content associated with the scene */
  media?: {
    /** Type of media content */
    type: 'image' | 'video' | 'gallery';
    /** URL to the media content */
    url: string;
    /** Optional URL to a thumbnail version of the media */
    thumbnailUrl?: string;
    /** Width of the media in pixels */
    width?: number;
    /** Height of the media in pixels */
    height?: number;
    /** Duration of video content in seconds */
    duration?: number;
  };
  /** Text content associated with the scene */
  text: string;
  /** Source information for attribution */
  source: {
    /** Original content author */
    author?: string;
    /** Subreddit where content was found (if from Reddit) */
    subreddit?: string;
    /** Platform where content was sourced from */
    platform: string;
  };
  /** Timestamp when the scene was created */
  createdAt: number;
  /** Whether the scene is currently loading content */
  isLoading?: boolean;
  /** Error message if content loading failed */
  error?: string;
}

/**
 * Represents a project that contains multiple scenes.
 * Projects are the main organizational unit in the application.
 */
export interface Project {
  /** Unique identifier for the project */
  id: string;
  /** User-defined title of the project */
  title: string;
  /** Ordered array of scenes in the project */
  scenes: Scene[];
  /** Timestamp when the project was created */
  createdAt: number;
  /** Timestamp of the last update to the project */
  updatedAt: number;
  /** Current status of the project */
  status: 'draft' | 'processing' | 'completed' | 'error';
}

/**
 * Represents the state of the project management system.
 * This is used by the ProjectProvider context to manage all project-related state.
 */
export interface ProjectState {
  /** List of all projects */
  projects: Project[];
  /** Currently active project */
  currentProject: Project | null;
  /** Whether the system is loading data */
  isLoading: boolean;
  /** Current error message, if any */
  error: string | null;
  /** Timestamp of the last successful save */
  lastSaved: number | null;
  /** Whether a save operation is in progress */
  isSaving: boolean;
  /** Current UI mode for progressive enhancement */
  mode: 'organization' | 'voice-enabled' | 'preview';
}

/**
 * Union type of all possible actions that can be dispatched to modify project state.
 * Each action has a specific type and optional payload containing the data needed
 * to perform the state update.
 */
export type ProjectAction =
  /** Create a new project with the given title */
  | { type: 'CREATE_PROJECT'; payload: { title: string } }
  /** Set the current active project by ID */
  | { type: 'SET_CURRENT_PROJECT'; payload: { projectId: string } }
  /** Add a new scene from a URL */
  | { type: 'ADD_SCENE'; payload: { url: string } }
  /** Mark a scene as loading while content is being fetched */
  | { type: 'ADD_SCENE_LOADING'; payload: { sceneId: string; url: string } }
  /** Update a scene with successfully loaded content */
  | { type: 'ADD_SCENE_SUCCESS'; payload: { sceneId: string; sceneData: Partial<Scene> } }
  /** Mark a scene as failed due to an error */
  | { type: 'ADD_SCENE_ERROR'; payload: { sceneId: string; error: string } }
  /** Remove a scene from the project */
  | { type: 'REMOVE_SCENE'; payload: { sceneId: string } }
  /** Reorder scenes in the project */
  | { type: 'REORDER_SCENES'; payload: { sceneIds: string[] } }
  /** Update the text content of a scene */
  | { type: 'UPDATE_SCENE_TEXT'; payload: { sceneId: string; text: string } }
  /** Update the project title */
  | { type: 'SET_PROJECT_TITLE'; payload: { title: string } }
  /** Set an error message */
  | { type: 'SET_ERROR'; payload: { error: string } }
  /** Clear the current error message */
  | { type: 'CLEAR_ERROR' }
  /** Set the loading state */
  | { type: 'SET_LOADING'; payload: { isLoading: boolean } }
  /** Load all projects into state */
  | { type: 'LOAD_PROJECTS'; payload: { projects: Project[] } }
  /** Set the saving state */
  | { type: 'SET_SAVING'; payload: { isSaving: boolean } }
  /** Update the last saved timestamp */
  | { type: 'SET_LAST_SAVED'; payload: { timestamp: number } }
  /** Update state after successfully loading a project */
  | { type: 'LOAD_PROJECT_SUCCESS'; payload: { project: Project } }
  /** Update state after successfully duplicating a project */
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; payload: { project: Project } }
  /** Update state after successfully deleting all projects */
  | { type: 'DELETE_ALL_PROJECTS_SUCCESS' }
  /** Set the UI mode */
  | { type: 'SET_MODE'; payload: { mode: 'organization' | 'voice-enabled' | 'preview' } };

/**
 * Initial state for the project management system.
 * Used when initializing the ProjectProvider context.
 */
export const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,
  lastSaved: null,
  isSaving: false,
  mode: 'organization',
};

// Re-export utility functions
export { generateId }; 