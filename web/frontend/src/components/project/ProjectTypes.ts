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
    /** Optional storage key for media stored in R2 */
    storageKey?: string;
    /** Optional URL to the stored media in R2 */
    storedUrl?: string;
    /** Original source URL (used when media is stored in R2) */
    originalUrl?: string;
    /** Content type (MIME type) of the media */
    contentType?: string;
    /** File size in bytes */
    fileSize?: number;
    /** Indicates if media is being loaded from storage */
    isStorageBacked?: boolean;
    /** Timestamp when media was stored */
    storedAt?: number;
    /** Trim settings for media playback */
    trim?: {
      /** Start time in seconds */
      start: number;
      /** End time in seconds */
      end: number;
    };
    /** Aspect ratio of the media */
    mediaAspectRatio?: number;
    /** Original width of the media in pixels */
    mediaOriginalWidth?: number;
    /** Original height of the media in pixels */
    mediaOriginalHeight?: number;
  };
  /** Text content associated with the scene */
  text: string;
  /** Indicates if the scene is currently storing media */
  isStoringMedia?: boolean;
  /** Audio data associated with the scene */
  audio?: {
    /** URL to the audio file */
    audio_url?: string;
    /** Base64 encoded audio data */
    audio_base64?: string;
    /** Content type of the audio */
    content_type?: string;
    /** URL to persistent storage location */
    persistentUrl?: string;
    /** Storage key in R2 */
    storageKey?: string;
  };
  /** Voice settings for text-to-speech */
  voice_settings?: {
    /** ElevenLabs voice ID */
    voice_id: string;
    /** Voice stability setting (0-1) */
    stability: number;
    /** Voice similarity boost setting (0-1) */
    similarity_boost: number;
    /** Voice style setting (0-1) */
    style: number;
    /** Speaker boost setting */
    speaker_boost: boolean;
    /** Voice speed multiplier */
    speed: number;
  };
  /** Source platform and metadata */
  source: {
    /** Platform the content came from (e.g., 'reddit') */
    platform: string;
    /** Original author of the content */
    author?: string;
    /** Subreddit if from Reddit */
    subreddit?: string;
  };
  /** Loading state for new scenes */
  isLoading?: boolean;
  /** Error message if content extraction failed */
  error?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last modification timestamp */
  updatedAt?: number;
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
  /** Timestamp of the last modification */
  lastModified: number;
  /** Current status of the project */
  status: 'draft' | 'processing' | 'ready' | 'error';
  /** Project aspect ratio setting */
  aspectRatio: string;
  /** Whether to show letterboxing/pillarboxing in previews */
  showLetterboxing: boolean;
}

/**
 * Represents lightweight project metadata.
 * Used for project listings and summaries.
 */
export interface ProjectMetadata {
  /** Unique identifier for the project */
  id: string;
  /** User-defined title of the project */
  title: string;
  /** Timestamp when the project was created */
  createdAt: number;
  /** Timestamp of the last update to the project */
  updatedAt: number;
  /** Optional URL to a thumbnail for the project */
  thumbnailUrl?: string;
}

/**
 * Represents the state of the project system.
 * Contains all projects, the currently active project, and UI state.
 */
export interface ProjectState {
  /** All projects available to the user */
  projects: Project[];
  /** Currently active project being edited */
  currentProject: Project | null;
  /** Error message if an operation fails */
  error: string | null;
  /** Global loading state for async operations */
  isLoading: boolean;
  /** Whether the current project is being saved */
  isSaving: boolean;
  /** Timestamp of the last successful save */
  lastSaved: number | null;
  /** Current UI mode for progressive enhancement */
  mode: 'organization' | 'voice-enabled' | 'preview';
}

/**
 * Initial state for the project system.
 * Used when initializing the reducer.
 */
export const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  error: null,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  mode: 'organization',
};

/**
 * Union type of all possible actions that can be dispatched to modify project state.
 * Each action has a specific type and optional payload containing the data needed
 * to perform the state update.
 */
export type ProjectAction =
  /** Create a new project with the given title */
  | { type: 'CREATE_PROJECT'; payload: { title: string } }
  /** Handle successful project creation */
  | { type: 'CREATE_PROJECT_SUCCESS'; payload: { project: Project } }
  /** Set the current active project */
  | { type: 'SET_CURRENT_PROJECT'; payload: { projectId: string | null } }
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
  /** Update the audio data of a scene */
  | { type: 'UPDATE_SCENE_AUDIO'; payload: { sceneId: string; audioData: Scene['audio']; voiceSettings: Scene['voice_settings'] } }
  /** Update the media data of a scene with storage information */
  | { type: 'UPDATE_SCENE_MEDIA'; payload: { sceneId: string; mediaData: Partial<Scene['media']> } }
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
  | { type: 'DUPLICATE_PROJECT_SUCCESS'; payload: { projectId: string } }
  /** Clear all projects from state */
  | { type: 'CLEAR_ALL_PROJECTS' }
  /** Set the UI mode */
  | { type: 'SET_MODE'; payload: { mode: 'organization' | 'voice-enabled' | 'preview' } }
  /** Set the project aspect ratio */
  | { type: 'SET_PROJECT_ASPECT_RATIO'; payload: { aspectRatio: string; showLetterboxing?: boolean } }
  /** Toggle letterboxing/pillarboxing display */
  | { type: 'TOGGLE_LETTERBOXING'; payload: { showLetterboxing: boolean } }
  /** Force a re-render of components */
  | { type: 'FORCE_UPDATE' }
  /** Mark a scene as storing media */
  | { type: 'SET_SCENE_STORING_MEDIA'; payload: { sceneId: string; isStoringMedia: boolean } }
  /** Delete a project */
  | { type: 'DELETE_PROJECT'; payload: { projectId: string } }
  /** Add a project */
  | { type: 'ADD_PROJECT'; payload: { project: Project } };

/**
 * Utility function to generate a unique identifier.
 * Used for creating new projects and scenes.
 * 
 * @returns {string} A unique identifier string
 */
export { generateId }; 