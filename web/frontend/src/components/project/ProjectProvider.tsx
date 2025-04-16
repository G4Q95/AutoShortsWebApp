/**
 * @fileoverview ProjectProvider implements the core state management for the Auto Shorts application.
 * It provides a React Context that manages project state, scene manipulation, and persistence.
 */

'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { extractContent } from '../../lib/api-client';
import { determineMediaType, generateVideoThumbnail } from '../../lib/media-utils';
import { useProjectPersistence } from '@/hooks/useProjectPersistence';
import { useProjectNavigation, UIMode } from '@/hooks/useProjectNavigation';
import { useProjectListManagement } from '@/hooks/useProjectListManagement';
import { useProjectCore } from '@/hooks/useProjectCore';

import { 
  Project, 
  ProjectState, 
  initialState, 
  Scene, 
  generateId,
} from './ProjectTypes';
import { projectReducer } from './ProjectReducer';

// Re-export types for convenience
export type { Project, Scene, ProjectState };
export { generateId };

/**
 * ProjectContext provides the application state and actions for managing video projects.
 * It combines both the state interface from ProjectState and action methods for state manipulation.
 * 
 * @example
 * ```tsx
 * // Using the context in a component
 * function MyComponent() {
 *   const project = useProject();
 *   
 *   const handleAddScene = async (url: string) => {
 *     await project.addScene(url);
 *   };
 *   
 *   return (
 *     <button onClick={() => handleAddScene('https://reddit.com/...')}>
 *       Add Scene
 *     </button>
 *   );
 * }
 * ```
 */
const ProjectContext = createContext<(Omit<ProjectState, 'mode'> & {
  /** Creates a new project with the given title */
  createProject: (title: string) => void;
  /** Sets the current active project by ID */
  setCurrentProject: (projectId: string | null) => void;
  /** Adds a new scene from a Reddit URL */
  addScene: (url: string) => Promise<void>;
  /** Removes a scene by ID */
  removeScene: (sceneId: string) => void;
  /** Updates the order of scenes */
  reorderScenes: (sceneIds: string[]) => void;
  /** Updates the text content of a scene */
  updateSceneText: (sceneId: string, text: string) => void;
  /** Updates the audio data and voice settings of a scene */
  updateSceneAudio: (sceneId: string, audioData: Scene['audio'], voiceSettings: Scene['voice_settings']) => void;
  /** Updates the media data of a scene with R2 storage details */
  updateSceneMedia: (sceneId: string, mediaData: Partial<Scene['media']>) => void;
  /** Updates the project title */
  setProjectTitle: (title: string) => void;
  /** Manually triggers a save of the current project */
  saveCurrentProject: () => Promise<void>;
  /** Loads a project by ID */
  loadProject: (projectId: string) => Promise<Project | null>;
  /** Deletes all projects */
  deleteAllProjects: () => Promise<void>;
  /** Refreshes the projects list */
  refreshProjects: () => Promise<void>;
  /** Current UI mode for progressive enhancement */
  uiMode: UIMode;
  /** Sets the UI mode for progressive enhancement */
  setMode: (mode: UIMode) => void;
  /** Progress to the next UI mode */
  nextMode: () => void;
  /** Return to the previous UI mode */
  previousMode: () => void;
  /** Stores all unstored media for the current project in R2 */
  storeAllMedia: () => Promise<{
    total: number;
    success: number;
    failed: number;
  } | null>;
  /** Toggles letterboxing/pillarboxing display */
  toggleLetterboxing: (show: boolean) => void;
  /** Indicates if media storage is in progress */
  isStoringMedia: boolean;
  /** Updates the project aspect ratio */
  setProjectAspectRatio: (aspectRatio: Project['aspectRatio']) => void;
}) | undefined>(undefined);

/**
 * ProjectProvider component provides project state management and persistence for the application.
 * It handles:
 * - Project CRUD operations
 * - Scene management
 * - Auto-saving
 * - State persistence
 * - Error handling
 * 
 * @component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components that will have access to the project context
 * 
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <ProjectProvider>
 *       <ProjectWorkspace />
 *     </ProjectProvider>
 *   );
 * }
 * ```
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const router = useRouter();
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);
  
  // Use the navigation hook for UI mode and pass the dispatch function to keep state.mode in sync
  const { uiMode, setMode, nextMode, previousMode } = useProjectNavigation(dispatch, state.mode as 'organization' | 'voice-enabled' | 'preview');

  // Use the persistence hook
  const {
    projects: persistedProjects,
    isLoadingProjects,
    persistenceError,
    loadProjectsList, // Keep loadProjectsList if needed for refresh
    // Destructure new items from the hook
    saveProject,
    isSavingProject,
    lastSavedTimestamp,
    // Destructure remaining persistence functions with correct renaming syntax
    loadProject: loadProjectFromHook,      
    deleteAllProjects: deleteAllProjectsFromHook, 
    projectExists: projectExistsFromHook,    // Use colon for renaming
  } = useProjectPersistence();

  // Use the core project hook
  const {
    currentProject: coreCurrentProject, // Get the hook's version of currentProject
    createProject: createProjectFromHook, // Rename to avoid initial conflict
    setCurrentProject: setCurrentProjectFromHook, // Rename
    loadProject: loadProjectFromCoreHook, // Rename
    setProjectTitle: setProjectTitleFromHook, // Rename
    setProjectAspectRatio: setProjectAspectRatioFromHook, // Get the hook function
  } = useProjectCore(dispatch, state, persistedProjects);

  // State monitoring function to detect inconsistencies
  const logStateConsistency = useCallback(() => {
    if (coreCurrentProject?.id && state.currentProject?.id) {
      if (coreCurrentProject?.id !== state.currentProject?.id) {
        console.warn('[STATE-MONITOR] Project ID mismatch:', {
          reducerProjectId: state.currentProject?.id,
          hookProjectId: coreCurrentProject?.id
        });
      }
      
      if (coreCurrentProject?.scenes?.length !== state.currentProject?.scenes?.length) {
        console.warn('[STATE-MONITOR] Scene count mismatch:', {
          reducerSceneCount: state.currentProject?.scenes?.length,
          hookSceneCount: coreCurrentProject?.scenes?.length,
          projectId: state.currentProject?.id
        });
      }
    }
  }, [coreCurrentProject, state.currentProject]);

  // Effect to monitor state consistency
  useEffect(() => {
    logStateConsistency();
  }, [logStateConsistency, coreCurrentProject, state.currentProject]);

  // Sync hook state with provider state
  useEffect(() => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: isLoadingProjects } });
  }, [isLoadingProjects]);

  useEffect(() => {
    // Only load if projects haven't been loaded yet by the hook initially
    if (persistedProjects.length > 0 || isLoadingProjects) {
      dispatch({ type: 'LOAD_PROJECTS', payload: { projects: persistedProjects } });
    }
  }, [persistedProjects, isLoadingProjects]);

  useEffect(() => {
    if (persistenceError) {
      dispatch({ type: 'SET_ERROR', payload: { error: persistenceError } });
    } else {
       // Clear error if persistence succeeds - Use CLEAR_ERROR action
      dispatch({ type: 'CLEAR_ERROR' }); 
    }
  }, [persistenceError]);

  // Sync saving state
  useEffect(() => {
    dispatch({ type: 'SET_SAVING', payload: { isSaving: isSavingProject } });
  }, [isSavingProject]);

  // Sync last saved timestamp
  useEffect(() => {
    if (lastSavedTimestamp) {
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: lastSavedTimestamp } });
    }
  }, [lastSavedTimestamp]);

  // Add a ref to track media storage operations in progress
  const mediaStorageOperationsRef = useRef<Record<string, boolean>>({});
  
  // Keep track of storage operations
  const [storageInProgress, setStorageInProgress] = useState(false);

  // Auto-save timer reference
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Refresh the projects list - Update to use the hook's function
  const refreshProjects = useCallback(async (): Promise<void> => {
    return loadProjectsList(); // Use hook's function
  }, [loadProjectsList]);

  // Define a wrapper function to call the hook's saveProject
  const saveCurrentProjectWrapper = useCallback(async () => {
    // LOGGING REMAINS THE SAME FOR DIAGNOSTICS
    console.log('[STATE-MONITOR] saveCurrentProjectWrapper called. Intending to save based on HOOK state:',
      'Hook project ID:', coreCurrentProject?.id,
      'Hook scene count:', coreCurrentProject?.scenes?.length,
      '(Reducer scene count for comparison:', state.currentProject?.scenes?.length, ')'
    );

    // *** THE FIX: Use coreCurrentProject ***
    if (coreCurrentProject) {
      // Create a deep copy to ensure we don't mutate the hook's state directly
      const projectToSave = JSON.parse(JSON.stringify(coreCurrentProject));
      await saveProject(projectToSave); // Pass the copy to the hook's save function
    } else {
      console.warn('[STATE-MONITOR] Attempted to save via wrapper, but coreCurrentProject is not set.');
    }
  // Keep dependencies - crucial for useCallback correctness
  }, [coreCurrentProject, saveProject, state.currentProject]); // Still need state.currentProject for logging comparison

  // Set up auto-save whenever currentProject changes
  useEffect(() => {
    let isMounted = true;

    // Monitor when auto-save effect triggers
    console.log('[STATE-MONITOR] Auto-save effect triggered:',
      'Current project in reducer:', state.currentProject?.id,
      'Current project in hook:', coreCurrentProject?.id,
      'Scenes in reducer:', state.currentProject?.scenes?.length,
      'Scenes in hook:', coreCurrentProject?.scenes?.length
    );

    // Clear any existing timer first
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null; // Clear ref
    }

    // *** NEW CHECK: Only set timer if states are consistent ***
    // Check for existence and matching IDs/scene counts
    const statesConsistent =
      coreCurrentProject?.id && state.currentProject?.id && // Both must exist
      coreCurrentProject.id === state.currentProject.id &&
      coreCurrentProject.scenes?.length === state.currentProject.scenes?.length;

    // If we have a current project AND states appear consistent, set up auto-save
    if (state.currentProject && statesConsistent) {
       console.log('[STATE-MONITOR] States consistent, setting auto-save timer.');
      autoSaveTimerRef.current = setTimeout(() => {
        if (isMounted) {
          console.log('[STATE-MONITOR] Auto-save timer fired (states were consistent when set):',
            'Current project in reducer:', state.currentProject?.id,
            'Current project in hook:', coreCurrentProject?.id,
            'Scenes in reducer:', state.currentProject?.scenes?.length,
            'Scenes in hook:', coreCurrentProject?.scenes?.length
          );
          saveCurrentProjectWrapper(); // Wrapper already uses coreCurrentProject
        }
      }, 3000); // Auto-save after 3 seconds
    } else if (state.currentProject) {
       // Log if we skip setting the timer due to inconsistency
       console.log('[STATE-MONITOR] States inconsistent, skipping auto-save timer setting.', {
           reducerId: state.currentProject?.id,
           hookId: coreCurrentProject?.id,
           reducerScenes: state.currentProject?.scenes?.length,
           hookScenes: coreCurrentProject?.scenes?.length
       });
    }

    // Cleanup function
    return () => {
      isMounted = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  // Keep dependencies - need both to check consistency and the wrapper
  }, [state.currentProject, coreCurrentProject, saveCurrentProjectWrapper]);

  // Add Effect to listen for pathname changes and save immediately
  useEffect(() => {
    // If pathname changed and we have a current project, save immediately
    if (prevPathRef.current !== pathname && state.currentProject) {
      console.log(`Navigation detected from ${prevPathRef.current} to ${pathname} - saving project ${state.currentProject.id} immediately`);
      
      try {
        // Create a fresh deep copy of the project to avoid reference issues
        const projectToSave = JSON.parse(JSON.stringify(state.currentProject));
        
        // Use the synchronous version of localStorage directly for immediate save
        const key = `auto-shorts-project-${projectToSave.id}`;
        localStorage.setItem(key, JSON.stringify(projectToSave));
        
        // Also update the projects list with this project's metadata
        const projectsListKey = 'auto-shorts-projects-list';
        const projectsListJson = localStorage.getItem(projectsListKey) || '[]';
        const projectsList = JSON.parse(projectsListJson);
        
        // Create metadata for this project
        const metadata = {
          id: projectToSave.id,
          title: projectToSave.title,
          createdAt: projectToSave.createdAt,
          updatedAt: projectToSave.updatedAt,
          thumbnailUrl: projectToSave.scenes.find((s: Scene) => s.media?.thumbnailUrl)?.media?.thumbnailUrl,
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
        
        console.log(`Immediate save on navigation: Project ${projectToSave.id} with ${projectToSave.scenes.length} scenes saved`);
      } catch (error) {
        console.error('Error during immediate navigation save:', error);
      }
    }
    
    // Update reference for next comparison
    prevPathRef.current = pathname;
  }, [pathname, state.currentProject]);

  // Add a separate beforeunload effect to handle browser/tab closure
  useEffect(() => {
    // Only add beforeunload listener if we have an active project
    // Also check if currentProject has an ID to be safe
    if (!state.currentProject || !state.currentProject.id) return; 
    
    // Create a sync handler for beforeunload
    const handleBeforeUnload = () => {
      console.log('Page unload detected - performing immediate save');
      
      // We need to perform a synchronous save here since beforeunload doesn't wait for async
      try {
        // Create a fresh deep copy of the project to avoid reference issues
        const projectToSave = JSON.parse(JSON.stringify(state.currentProject));
        
        // Use the synchronous version of localStorage directly
        const key = `auto-shorts-project-${projectToSave.id}`;
        localStorage.setItem(key, JSON.stringify(projectToSave));
        
        // Also update the projects list with this project's metadata
        const projectsListKey = 'auto-shorts-projects-list';
        const projectsListJson = localStorage.getItem(projectsListKey) || '[]';
        const projectsList = JSON.parse(projectsListJson);
        
        // Create metadata for this project
        const metadata = {
          id: projectToSave.id,
          title: projectToSave.title,
          createdAt: projectToSave.createdAt,
          updatedAt: projectToSave.updatedAt,
          thumbnailUrl: projectToSave.scenes.find((s: Scene) => s.media?.thumbnailUrl)?.media?.thumbnailUrl,
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
        
        console.log(`Immediate save on page unload: Project ${projectToSave.id} with ${projectToSave.scenes.length} scenes`);
      } catch (error) {
        console.error('Error during immediate page unload save:', error);
      }
    };

    // Add the beforeunload event listener
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Remove the event listener when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.currentProject]);

  // Create a new project
  const createProject = useCallback((title: string) => {
    createProjectFromHook(title);
  }, [createProjectFromHook]);

  // Set the current active project by ID
  const setCurrentProject = useCallback((projectId: string | null) => {
    setCurrentProjectFromHook(projectId);
  }, [setCurrentProjectFromHook]);

  // Load a project by ID
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    return loadProjectFromCoreHook(projectId);
  }, [loadProjectFromCoreHook]);

  // Update scene media data
  const updateSceneMedia = useCallback((sceneId: string, mediaData: Partial<Scene['media']>) => {
    dispatch({ type: 'UPDATE_SCENE_MEDIA', payload: { sceneId, mediaData } });
    saveCurrentProjectWrapper();
  }, [saveCurrentProjectWrapper]);

  // Store all unstored media for the current project in R2
  const storeAllMedia = useCallback(async (): Promise<{
    total: number;
    success: number;
    failed: number;
  } | null> => {
    // First check if a current project exists
    if (!state.currentProject) {
      console.error('No active project to store media for');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to store media for' },
      });
      return null;
    }

    // Create a local reference to ensure consistency
    const currentProject = { ...state.currentProject };
    console.log(`Initiating storage of all media for project: ${currentProject.id}`);

    try {
      // Import the utility function
      const { storeAllProjectMedia } = await import('../../lib/media-utils');
      
      // Store all media for the project
      const result = await storeAllProjectMedia(
        currentProject,
        updateSceneMedia
      );
      
      console.log('Media storage process completed:', result);
      return result;
    } catch (error) {
      console.error('Error storing project media:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { 
          error: error instanceof Error ? error.message : 'Unknown error storing media' 
        },
      });
      return null;
    }
  }, [state.currentProject, updateSceneMedia]);

  // Add a function to check if media storage is in progress
  const isMediaStorageInProgress = useCallback(() => {
    return Object.values(mediaStorageOperationsRef.current).some(inProgress => inProgress);
  }, []);

  // Add a useEffect to show a visual indicator when storage is in progress
  useEffect(() => {
    // Update the document title to indicate storage is in progress
    if (storageInProgress) {
      const originalTitle = document.title;
      document.title = '⏳ Saving... - ' + originalTitle;
      
      return () => {
        document.title = originalTitle;
      };
    }
  }, [storageInProgress]);

  // Helper function to ensure a consistent reference to the current project and its scenes
  const getProjectWithScenes = useCallback(async (projectId: string): Promise<Project | null> => {
    // First try to get from state
    if (state.currentProject && state.currentProject.id === projectId) {
      return Promise.resolve({...state.currentProject});
    }
    
    // If not in state, try to get from the hook
    return loadProjectFromHook(projectId).then(project => {
      if (!project) {
        console.warn(`Project ${projectId} not found via hook`);
        return null;
      }
      return project;
    });
  }, [state.currentProject, loadProjectFromHook]); // Depend on hook function

  // Add a scene - enhanced with better error handling and immediate saving
  const addScene = useCallback(async (url: string) => {
    // Monitor state sources
    console.log('[STATE-MONITOR] addScene called with current state:',
      'Reducer state project:', state.currentProject?.id,
      'Core hook project:', coreCurrentProject?.id,
      'Reducer scenes:', state.currentProject?.scenes?.length,
      'Core hook scenes:', coreCurrentProject?.scenes?.length
    );
    
    // First check if a current project exists
    if (!state.currentProject) {
      console.error('No active project to add scene to');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to add scene to' },
      });
      return;
    }

    // Create a local reference to the current project to ensure consistency
    const currentProject = { ...state.currentProject };
    const projectId = currentProject.id;
    
    console.log(`Adding scene to project: ${projectId}, current scene count: ${currentProject.scenes.length}`);

    const sceneId = generateId();
    
    // Generate the new scene object
    const newScene: Scene = {
      id: sceneId,
      url: url,
      text: '',
      source: {
        platform: 'reddit', // Default to reddit for now
      },
      createdAt: Date.now(),
      isLoading: true,
    };
    
    // Make a defensive copy of the existing scenes array
    const currentScenes = [...currentProject.scenes];
    
    // Update the UI state first to show the loading scene
    dispatch({
      type: 'ADD_SCENE_LOADING',
      payload: { sceneId, url },
    });

    // IMPORTANT: Perform immediate synchronous save right after dispatching
    try {
      // Get a fresh copy of the project that includes the new scene
      const freshProject = await getProjectWithScenes(projectId);
      
      if (!freshProject) {
        throw new Error(`Failed to get project ${projectId} for saving`);
      }
      
      console.log(`IMMEDIATE SAVE: Starting with project ${freshProject.id}, scenes count: ${freshProject.scenes.length}`);
      
      // Get all existing scene IDs to prevent duplication
      const existingSceneIds = new Set(freshProject.scenes.map(s => s.id));
      
      // Only add the new scene if it doesn't already exist
      if (!existingSceneIds.has(sceneId)) {
        // Create updated project with all scenes plus the new one
        const projectToSave = {
          ...freshProject,
          scenes: [...freshProject.scenes, newScene],
          updatedAt: Date.now(),
        };
        
        // Save to localStorage 
        const key = `auto-shorts-project-${projectToSave.id}`;
        localStorage.setItem(key, JSON.stringify(projectToSave));
        
        console.log(`IMMEDIATE SAVE: Saved ${projectToSave.scenes.length} scenes to project ${projectToSave.id}`);
        
        // Update the projects list metadata
        const projectsListKey = 'auto-shorts-projects-list';
        const projectsListJson = localStorage.getItem(projectsListKey) || '[]';
        const projectsList = JSON.parse(projectsListJson);
        
        // Create or update metadata
        const metadata = {
          id: projectToSave.id,
          title: projectToSave.title,
          createdAt: projectToSave.createdAt,
          updatedAt: projectToSave.updatedAt,
          thumbnailUrl: projectToSave.scenes.find((s: Scene) => s.media?.thumbnailUrl)?.media?.thumbnailUrl,
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
        
        // Update local reference for later use in this function
        currentProject.scenes = [...projectToSave.scenes];
      } else {
        console.log(`Scene ${sceneId} already exists in project, not adding duplicate`);
      }
    } catch (syncError) {
      console.error('Error during immediate scene save:', syncError);
    }

    try {
      // Extract content from URL
      const response = await extractContent(url);

      if (response.error) {
        dispatch({
          type: 'ADD_SCENE_ERROR',
          payload: {
            sceneId,
            error: response.error.message || 'Failed to extract content',
          },
        });
        return;
      }

      const sceneData = response.data.data;
      if (!sceneData) {
        dispatch({
          type: 'ADD_SCENE_ERROR',
          payload: {
            sceneId,
            error: 'No content data returned from API',
          },
        });
        return;
      }

      // Process the response into a scene object
      let mediaType: 'image' | 'video' | 'gallery' | null = null;
      let mediaUrl: string | null = null;

      // Process media from the response - handle direct media properties
      if (sceneData.metadata?.has_media && sceneData.media_url) {
        mediaType = sceneData.media_type || 'image'; // Default to image if not specified
        mediaUrl = sceneData.media_url;
      }

      // Original thumbnailUrl extraction - SIMPLIFIED back to the original version
      // This is the key change that restores the working logic
      console.log('API Response thumbnail check:');
      console.log('- Direct thumbnail_url:', sceneData.thumbnail_url);
      console.log('- Metadata thumbnails:', sceneData.metadata?.thumbnail_url);

      // Create the new scene object with content data
      const updatedScene: Scene = {
        id: sceneId,
        url,
        text: sceneData.text || '',
        media: mediaUrl && mediaType ? { 
          type: mediaType as 'image' | 'video' | 'gallery', 
          url: mediaUrl,
          thumbnailUrl: sceneData.thumbnail_url, // Simple direct assignment like the original
          width: sceneData.width || sceneData.metadata?.width,
          height: sceneData.height || sceneData.metadata?.height,
          duration: sceneData.duration || sceneData.metadata?.duration
        } : undefined,
        source: {
          platform: 'reddit',
          author: sceneData.author,
          subreddit: sceneData.subreddit,
        },
        createdAt: Date.now(),
      };

      // Log the final scene media data for debugging
      console.log(`Final scene with thumbnail:`, updatedScene.media?.thumbnailUrl);

      // CRITICAL STEP: Get a fresh copy of the project from localStorage to ensure we have all scenes
      console.log(`Getting fresh project ${projectId} before updating scene ${sceneId}`);
      const freshProject = await getProjectWithScenes(projectId);
      
      if (!freshProject) {
        throw new Error(`Failed to get fresh project ${projectId}`);
      }
      
      console.log(`Retrieved fresh project with ${freshProject.scenes.length} scenes`);

      // Update the scene in the fresh project's scenes array
      const updatedScenes = freshProject.scenes.map(scene => 
        scene.id === sceneId ? updatedScene : scene
      );
      
      // If scene wasn't found (somehow got lost), add it again
      if (!updatedScenes.some(scene => scene.id === sceneId)) {
        console.warn(`Scene ${sceneId} not found in project, re-adding it`);
        updatedScenes.push(updatedScene);
      }
      
      // Create the updated project with all scenes
      const updatedProject: Project = {
        ...freshProject,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };

      // 1. First save to localStorage for persistence
      console.log(`Saving project with updated scene to localStorage: ${updatedProject.id}, scenes: ${updatedScenes.length}`);
      await saveProject(updatedProject);
      
      // 2. Update the UI state
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project: updatedProject },
      });
      
      // 3. Track last saved time
      dispatch({ 
        type: 'SET_LAST_SAVED', 
        payload: { timestamp: Date.now() } 
      });
      
      // 4. Force another immediate save to ensure scene persistence
      try {
        // Create a fresh copy with content
        const finalProject = JSON.parse(JSON.stringify(updatedProject));
        
        // Immediate synchronous localStorage save
        const key = `auto-shorts-project-${finalProject.id}`;
        localStorage.setItem(key, JSON.stringify(finalProject));
        console.log(`Second IMMEDIATE SAVE: Updated scene ${sceneId} with content in project ${finalProject.id}, scenes: ${finalProject.scenes.length}`);
      } catch (syncError) {
        console.error('Error during second immediate scene save:', syncError);
      }
      
      // 5. Initiate background media storage if media exists
      if (updatedScene.media?.url) {
        try {
          // Import the storeSceneMedia utility
          const { storeSceneMedia } = await import('../../lib/media-utils');
          
          console.log(`[STORAGE-DEBUG] Starting media storage for scene: ${updatedScene.id}`);
          console.log(`[STORAGE-DEBUG] Media URL to store: ${updatedScene.media.url}`);
          console.log(`[STORAGE-DEBUG] Current media state:`, {
            type: updatedScene.media.type,
            hasUrl: !!updatedScene.media.url,
            isStorageBacked: updatedScene.media.isStorageBacked,
            hasStorageKey: !!updatedScene.media.storageKey
          });
          
          // Set the scene's storing media flag to true
          dispatch({
            type: 'SET_SCENE_STORING_MEDIA',
            payload: { sceneId: updatedScene.id, isStoringMedia: true }
          });
          
          // Store media in R2 storage
          console.log(`[STORAGE-DEBUG] Calling storeSceneMedia function`);
          const success = await storeSceneMedia(
            updatedScene,
            projectId,
            updateSceneMedia
          );
          
          // Set the scene's storing media flag to false since storage is complete
          dispatch({
            type: 'SET_SCENE_STORING_MEDIA',
            payload: { sceneId: updatedScene.id, isStoringMedia: false }
          });
          
          if (success) {
            console.log(`[STORAGE-DEBUG] Successfully stored media for scene: ${updatedScene.id}`);
            
            // Get the latest scene to verify storage worked
            const latestProject = await getProjectWithScenes(projectId);
            if (latestProject) {
              const latestScene = latestProject.scenes.find(s => s.id === updatedScene.id);
              if (latestScene && latestScene.media) {
                console.log(`[STORAGE-DEBUG] Verification - Latest scene media state:`, {
                  url: latestScene.media.url,
                  storedUrl: latestScene.media.storedUrl,
                  isStorageBacked: latestScene.media.isStorageBacked,
                  storageKey: latestScene.media.storageKey
                });
              }
            }
          } else {
            console.warn(`[STORAGE-DEBUG] Failed to store media for scene: ${updatedScene.id}`);
          }
          
          // Final save to ensure scene is fully stored with current state
          const currentState = state.currentProject;
          if (currentState) {
            console.log(`Final save for scene: ${updatedScene.id} from current state with ${currentState.scenes.length} scenes`);
            
            // Verify we're not losing scenes
            if (currentState.scenes.length < updatedScenes.length) {
              console.warn(`WARNING: Current state has fewer scenes (${currentState.scenes.length}) than expected (${updatedScenes.length})`);
              
              // Use the previously saved updatedProject to ensure we don't lose scenes
              await saveProject(updatedProject);
              
              // Force a UI update with the correct scenes
              dispatch({
                type: 'LOAD_PROJECT_SUCCESS',
                payload: { project: updatedProject },
              });
            } else {
              // Save current state as normal
              await saveProject(currentState);
            }
            
            console.log(`Final save completed for scene: ${updatedScene.id}`);
            
            // Verify the save worked by loading the project again using the hook
            const verifyProject = await loadProjectFromHook(projectId);
            if (verifyProject) {
              console.log(`Scene added, now fetching updated project ${projectId} from hook`);
              console.log(`Verification: Project has ${verifyProject.scenes.length} scenes in storage`);
            }
          }
        } catch (storageError) {
          console.error('Error during media storage:', storageError);
          
          // Set the scene's storing media flag to false in case of error
          dispatch({
            type: 'SET_SCENE_STORING_MEDIA',
            payload: { sceneId: updatedScene.id, isStoringMedia: false }
          });
        }
      }
    } catch (error) {
      console.error('Error extracting content:', error);
      dispatch({
        type: 'ADD_SCENE_ERROR',
        payload: {
          sceneId,
          error: error instanceof Error ? error.message : 'Failed to extract content',
        },
      });
      
      // Ensure we reset tracking if there's an error
      delete mediaStorageOperationsRef.current[sceneId];
      setStorageInProgress(!isMediaStorageInProgress());
    }
  }, [state.currentProject, dispatch, updateSceneMedia, saveCurrentProjectWrapper, isMediaStorageInProgress, saveProject, getProjectWithScenes, loadProjectFromHook, coreCurrentProject]);

  // Remove a scene - simplified for reliability
  const removeScene = useCallback((sceneId: string) => {
    // Monitor state sources
    console.log('[STATE-MONITOR] removeScene called for scene:', sceneId,
      'Reducer state project:', state.currentProject?.id,
      'Core hook project:', coreCurrentProject?.id,
      'Reducer scenes:', state.currentProject?.scenes?.length,
      'Core hook scenes:', coreCurrentProject?.scenes?.length
    );
    
    // Get the current project from state
    const project = state.currentProject;
    
    // If no current project in context state, log error and return
    if (!project) {
      console.error('No active project in context state to remove scene from');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to remove scene from' },
      });
      return;
    }

    try {
      // Check if the scene exists
      const sceneIndex = project.scenes.findIndex(scene => scene.id === sceneId);
      if (sceneIndex === -1) {
        console.warn(`Scene ${sceneId} not found in project ${project.id}, proceeding with UI update only`);
      }
      
      // Create an updated project with the scene removed
      const updatedScenes = project.scenes.filter(scene => scene.id !== sceneId);
      const updatedProject = {
        ...project,
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      // Update UI first for responsiveness
      dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } });
      
      // Then save to storage
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
      
      saveProject(updatedProject)
        .then(() => {
          dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
          dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
          
          // Ensure currentProject is updated with the change
          dispatch({
            type: 'LOAD_PROJECT_SUCCESS',
            payload: { project: updatedProject },
          });
          
          // Perform a secondary save to ensure persistence after all state updates
          setTimeout(async () => {
            try {
              console.log(`Performing follow-up save after scene removal: ${sceneId}`);
              // Use a fresh copy of the project to ensure all state updates are captured
              const freshProject = {...updatedProject, updatedAt: Date.now()};
              await saveProject(freshProject);
              console.log(`Follow-up save completed for project: ${freshProject.id}`);
            } catch (saveError) {
              console.error('Failed to perform follow-up save after scene removal:', saveError);
            }
          }, 500);
        })
        .catch(error => {
          console.error('Error saving project after scene removal:', error);
          dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
          dispatch({
            type: 'SET_ERROR',
            payload: { error: 'Scene removed, but changes could not be saved' },
          });
        });
    } catch (error) {
      console.error('Error during scene removal:', error);
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Error removing scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
      });
    }
  }, [state.currentProject, dispatch, saveProject, coreCurrentProject]);

  // Reorder scenes in the current project
  const reorderScenes = useCallback((sceneIds: string[]) => {
    // Monitor state sources
    console.log('[STATE-MONITOR] reorderScenes called with:',
      'Reducer state project:', state.currentProject?.id,
      'Core hook project:', coreCurrentProject?.id,
      'Reducer scenes:', state.currentProject?.scenes?.length,
      'Core hook scenes:', coreCurrentProject?.scenes?.length,
      'Scene IDs to reorder:', sceneIds.length
    );
    
    if (!state.currentProject) return;

    dispatch({
      type: 'REORDER_SCENES',
      payload: { sceneIds },
    });

    // Save after reordering with a slight delay to avoid too many saves
    setTimeout(() => {
      try {
        saveCurrentProjectWrapper();
      } catch (error) {
        console.error('Error during follow-up save after reordering:', error);
      }
    }, 1000);
  }, [state.currentProject, dispatch, saveCurrentProjectWrapper, coreCurrentProject]);

  // Update scene text
  const updateSceneText = useCallback((sceneId: string, text: string) => {
    dispatch({ type: 'UPDATE_SCENE_TEXT', payload: { sceneId, text } });
  }, []);

  // Update scene audio data
  const updateSceneAudio = useCallback((
    sceneId: string, 
    audioData: Scene['audio'], 
    voiceSettings: Scene['voice_settings']
  ) => {
    dispatch({ 
      type: 'UPDATE_SCENE_AUDIO', 
      payload: { 
        sceneId, 
        audioData, 
        voiceSettings 
      } 
    });
    
    // Save the project after updating audio to ensure persistence
    saveCurrentProjectWrapper().catch(error => {
      console.error('Error saving project after updating scene audio:', error);
    });
  }, [saveCurrentProjectWrapper]);

  // Delete all projects
  const deleteAllProjects = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    try {
      // Clear from local storage via hook
      await deleteAllProjectsFromHook();
      // Clear state
      dispatch({ type: 'CLEAR_ALL_PROJECTS' });
      // Clear current project - Use correct payload
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId: null } });
      router.push('/');
    } catch (error) {
      console.error('Error deleting all projects:', error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to delete all projects' } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [deleteAllProjectsFromHook, router]);

  // Toggle letterboxing display
  const toggleLetterboxing = useCallback(async (show: boolean) => {
    console.log('[ProjectProvider] Toggling letterboxing:', show);
    
    dispatch({ 
      type: 'TOGGLE_LETTERBOXING', 
      payload: { showLetterboxing: show } 
    });
    
    // Force a re-render of affected components
    dispatch({ type: 'FORCE_UPDATE' });
    
    // Save the project after toggling letterboxing
    saveCurrentProjectWrapper().catch(error => {
      console.error('Error saving project after toggling letterboxing:', error);
    });
  }, [saveCurrentProjectWrapper]);

  // Memoize the context value to prevent unnecessary re-renders
  // Split context values into separate memoized objects
  const stateValues = useMemo(() => ({
    projects: state.projects,
    currentProject: state.currentProject,
    isLoading: state.isLoading,
    error: state.error,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving,
  }), [
    state.projects,
    state.currentProject,
    state.isLoading,
    state.error,
    state.lastSaved,
    state.isSaving,
  ]);

  const actions = useMemo(() => ({
    createProject,
    setCurrentProject,
    addScene,
    removeScene,
    reorderScenes,
    updateSceneText,
    updateSceneAudio,
    updateSceneMedia,
    setProjectTitle: setProjectTitleFromHook,
    saveCurrentProject: saveCurrentProjectWrapper,
    loadProject,
    deleteAllProjects,
    refreshProjects,
    uiMode,
    setMode,
    nextMode,
    previousMode,
    storeAllMedia,
    toggleLetterboxing,
    isStoringMedia: storageInProgress,
    setProjectAspectRatio: setProjectAspectRatioFromHook,
  }), [
    createProject,
    setCurrentProject,
    addScene,
    removeScene,
    reorderScenes,
    updateSceneText,
    updateSceneAudio,
    updateSceneMedia,
    setProjectTitleFromHook,
    saveCurrentProjectWrapper,
    loadProject,
    deleteAllProjects,
    refreshProjects,
    uiMode,
    setMode,
    nextMode,
    previousMode,
    storeAllMedia,
    toggleLetterboxing,
    storageInProgress,
    setProjectAspectRatioFromHook,
  ]);

  // Combine state and actions only when either changes
  const contextValue = useMemo(() => ({
    ...stateValues,
    ...actions
  }), [stateValues, actions]);

  return (
    <ProjectContext.Provider value={contextValue}>
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to use the Project context
export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
