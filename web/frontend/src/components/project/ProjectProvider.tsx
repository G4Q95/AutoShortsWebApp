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
import debounce from 'lodash.debounce';
import { extractContent } from '../../lib/api-client';
import { determineMediaType, generateVideoThumbnail } from '../../lib/media-utils';
import { useProjectPersistence } from '@/hooks/useProjectPersistence';
import { useProjectNavigation, UIMode } from '@/hooks/useProjectNavigation';
import { useProjectListManagement } from '@/hooks/useProjectListManagement';
import { useProjectCore, useGetLatestProjectState } from '@/hooks/useProjectCore';
import { useMediaStorage } from '@/hooks/useMediaStorage';

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
  /** Current project ID, if available */
  projectId?: string | null;
  /** Creates a new project with the given title */
  createProject: (title: string) => Promise<Project | null>;
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
    updateCoreProjectState, // Added from useProjectCore
    projectId: coreCurrentProjectId, // <<< GET PROJECT ID FROM HOOK
  } = useProjectCore(dispatch, state, persistedProjects);

  // Get the function to fetch the latest state
  const getLatestProjectState = useGetLatestProjectState({ currentProject: coreCurrentProject });

  // State monitoring function to detect inconsistencies
  // const logStateConsistency = useCallback(() => {
  //   console.log('[STATE-MONITOR] Checking consistency (state.currentProject removed from checks)');
  // }, [coreCurrentProject]);

  // Effect to monitor state consistency
  // useEffect(() => {
  //  logStateConsistency();
  // }, [logStateConsistency, coreCurrentProject]);

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
  
  // Initialize the media storage hook
  const { 
    storeMedia: storeMediaFromHook, // Rename to avoid potential conflicts 
    isLoading: isStoringMediaHook, // Get loading state from hook
    error: mediaStorageErrorHook, // Get error state from hook
  } = useMediaStorage(); 

  // Keep track of storage operations (maybe leverage isStoringMediaHook later)
  const [storageInProgress, setStorageInProgress] = useState(false);

  // Auto-save timer reference
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Refresh the projects list - Update to use the hook's function
  const refreshProjects = useCallback(async (): Promise<void> => {
    return loadProjectsList(); // Use hook's function
  }, [loadProjectsList]);

  // Define a wrapper function to call the hook's saveProject
  const saveCurrentProjectWrapper = useCallback(async () => {
    // Get the latest project state right before saving
    const projectToSave = getLatestProjectState();

    if (!projectToSave) {
      console.warn('[ProjectProvider] Attempted to save but no current project found.');
      return;
    }

    if (isSavingProject) {
      console.warn('[ProjectProvider] Save already in progress, skipping.');
      return;
    }

    // Log the trim data for each scene before saving
    console.log(`[DEBUG][ProjectProvider] Saving project ${projectToSave.id}. Trim data:`, 
      projectToSave.scenes.map(s => ({ id: s.id, trim: s.media?.trim })) // Correctly access nested optional property
    );

    dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
    try {
      await saveProject(projectToSave); // Use the save function from the persistence hook
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
    } catch (error) {
      console.error('[ProjectProvider] Error saving project:', error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save project' } });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
    }
  }, [getLatestProjectState, saveProject, isSavingProject, dispatch]);

  // Create a memoized debounced version of the save function
  const debouncedSaveProject = useMemo(() => {
    return debounce((project) => {
      console.log('[ProjectProvider] Debounced auto-save executing...');
      if (project) {
        // Create a deep copy to ensure we don't have reference issues
        const projectToSave = JSON.parse(JSON.stringify(project));
        dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });
        saveProject(projectToSave)
          .then(() => {
            dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
          })
          .catch((error: unknown) => {
            console.error('[ProjectProvider] Error saving project:', error);
            dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save project' } });
          })
          .finally(() => {
            dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
          });
      }
    }, 10000); // 10-second debounce delay
  }, [dispatch, saveProject]);

  // Set up auto-save whenever relevant project properties change
  useEffect(() => {
    // Bail out early if no project
    if (!coreCurrentProject) return;

    // Call the debounced save with the current project
    debouncedSaveProject(coreCurrentProject);

    // Cleanup function
    return () => {
      debouncedSaveProject.cancel(); // Cancel any pending debounced saves
    };
  }, [
    coreCurrentProject?.id, 
    coreCurrentProject?.updatedAt, 
    // Specific high-level properties that should trigger saves when changed
    coreCurrentProject?.title,
    coreCurrentProject?.aspectRatio,
    // Use length checks rather than full object comparisons for arrays
    coreCurrentProject?.scenes?.length,
    debouncedSaveProject
  ]);

  // Add Effect to listen for pathname changes and save immediately
  useEffect(() => {
    // If pathname changed and we have a current project (from the hook), save immediately
    if (prevPathRef.current !== pathname && coreCurrentProject) {
      // console.log(`Navigation detected from ${prevPathRef.current} to ${pathname} - saving project ${coreCurrentProject.id} immediately`);
      
      try {
        // Create a fresh deep copy of the project (from the hook) to avoid reference issues
        const projectToSave = JSON.parse(JSON.stringify(coreCurrentProject));
        
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
        
        // console.log(`Immediate save on navigation: Project ${projectToSave.id} with ${projectToSave.scenes.length} scenes saved`);
      } catch (error) {
        // console.error('Error during immediate navigation save:', error);
      }
    }
    
    // Update reference for next comparison
    prevPathRef.current = pathname;
  }, [pathname, coreCurrentProject]);

  // Add a separate beforeunload effect to handle browser/tab closure
  useEffect(() => {
    // Only add beforeunload listener if we have an active project (from the hook)
    if (!coreCurrentProject || !coreCurrentProject.id) return; // Use coreCurrentProject
    
    // Create a sync handler for beforeunload
    const handleBeforeUnload = () => {
      // console.log('Page unload detected - performing immediate save');
      
      // We need to perform a synchronous save here since beforeunload doesn't wait for async
      try {
        // Create a fresh deep copy of the project (from the hook) to avoid reference issues
        const projectToSave = JSON.parse(JSON.stringify(coreCurrentProject)); // Use coreCurrentProject
        
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
        
        // console.log(`Immediate save on page unload: Project ${projectToSave.id} with ${projectToSave.scenes.length} scenes`);
      } catch (error) {
        // console.error('Error during immediate page unload save:', error);
      }
    };

    // Add the beforeunload event listener
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Remove the event listener when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [coreCurrentProject]); // Depend on coreCurrentProject

  // Create a new project
  const createProject = useCallback(async (title: string): Promise<Project | null> => {
    return createProjectFromHook(title);
  }, [createProjectFromHook]);

  // Set the current active project by ID
  const setCurrentProject = useCallback((projectId: string | null) => {
    setCurrentProjectFromHook(projectId);
  }, [setCurrentProjectFromHook]);

  // Load a project by ID
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    return loadProjectFromCoreHook(projectId);
  }, [loadProjectFromCoreHook]);

  // Update scene media data - Refactored to use core hook state
  const updateSceneMedia = useCallback(async (
    sceneId: string, 
    mediaData: Partial<Scene['media']>
    // removed projectToUpdate: Project parameter
  ) => {
    // Log state at the time of media update for debugging
    console.log(`[updateSceneMedia] Called for scene ${sceneId}. Using core project: ${coreCurrentProject?.id}`);
    
    // Use coreCurrentProject as the source of truth
    if (!coreCurrentProject) { 
      console.error("[updateSceneMedia] No active project (from core hook) found.");
      dispatch({ type: 'SET_ERROR', payload: { error: 'No active project to update media for' } });
      return;
    }
    
    const sourceProject = coreCurrentProject; // Use the hook's state directly

    if (!sourceProject.scenes?.length) {
      console.warn(`[updateSceneMedia] Project ${sourceProject.id} has 0 scenes, attempting to update scene ${sceneId}`);
    }
    
    // Find the target scene in the core project state
    const targetSceneIndex = sourceProject.scenes.findIndex(scene => scene.id === sceneId);
    if (targetSceneIndex === -1) {
      console.error(`[updateSceneMedia] Scene ${sceneId} not found in core project ${sourceProject.id}`);
      dispatch({ type: 'SET_ERROR', payload: { error: `Scene ${sceneId} not found` } });
      return;
    }
    
    // Create updated scene and project based on core state
    const updatedScenes = [...sourceProject.scenes]; // Create a copy
    const sceneToUpdate = updatedScenes[targetSceneIndex];
    const updatedMedia = { ...(sceneToUpdate.media || {}), ...mediaData };
    updatedScenes[targetSceneIndex] = { 
      ...sceneToUpdate, 
      media: updatedMedia as Scene['media'], // Ensure type correctness
      updatedAt: Date.now() 
    };
    
    const updatedProject: Project = { 
      ...sourceProject, 
      scenes: updatedScenes, 
      updatedAt: Date.now() 
    };

    // Log the trim data specifically before saving
    const trimBeingSaved = updatedScenes[targetSceneIndex].media?.trim;
    console.log(`[updateSceneMedia] Saving project ${updatedProject.id}. Trim data for scene ${sceneId}:`, trimBeingSaved);

    try {
      // Update the core hook's state OPTIMISTICALLY first
      updateCoreProjectState(updatedProject);
      
      // Then attempt to save to persistence
      // *** ADDED DETAILED LOGGING BEFORE SAVE ***
      console.log(`[updateSceneMedia] Attempting to save project ${updatedProject.id}. 
Target Scene (${sceneId}) Media Object:`, 
        JSON.stringify(updatedScenes[targetSceneIndex]?.media, null, 2)
      );
      // *** END ADDED LOGGING ***
      await saveProject(updatedProject);
      
      // Optional: Log success or handle post-save actions
      console.log(`[updateSceneMedia] Successfully saved updates for scene ${sceneId}`);
      
    } catch (error) {
      console.error("[updateSceneMedia] Failed to save scene media:", error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save media change' } });
      // Attempt to revert optimistic update on failure
      updateCoreProjectState(sourceProject); // Revert to the state before this attempt
    }
  // Removed projectToUpdate dependency, added coreCurrentProject
  }, [dispatch, saveProject, updateCoreProjectState, coreCurrentProject]); 

  // Store all unstored media for the current project in R2
  const storeAllMedia = useCallback(async (): Promise<{
    total: number;
    success: number;
    failed: number;
  } | null> => {
    // Use coreCurrentProject as the source of truth
    if (!coreCurrentProject) { // Check the hook's state
      // console.error('No active project (from core hook) to store media for');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to store media for' },
      });
      return null;
    }

    // Create a local reference from the hook's state
    const currentProject = { ...coreCurrentProject }; // Use coreCurrentProject
    // console.log(`Initiating storage of all media for project: ${currentProject.id}`);

    try {
      // Import the utility function
      const { storeAllProjectMedia } = await import('../../lib/media-utils');
      
      // *** FIX: Create a wrapper for updateSceneMedia for storeAllProjectMedia ***
      const updateSceneMediaForStoreAll = async (sceneId: string, mediaData: Partial<Scene['media']>) => {
        // Call the refactored updateSceneMedia without the project argument
        await updateSceneMedia(sceneId, mediaData); 
        // No need to load latest project here as updateSceneMedia now uses core state
      };
      
      // Store all media for the project, passing the wrapper
      const result = await storeAllProjectMedia(
        currentProject,
        updateSceneMediaForStoreAll // <-- Pass the correct wrapper function
      );
      
      // console.log('Media storage process completed:', result);
      return result;
    } catch (error) {
      // console.error('Error storing project media:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { 
          error: error instanceof Error ? error.message : 'Unknown error storing media' 
        },
      });
      return null;
    }
  }, [coreCurrentProject, updateSceneMedia]); // <-- Added updateSceneMedia

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
  // REMOVED as provider should only rely on the hook's load function now.
  // const getProjectWithScenes = useCallback(async (projectId: string): Promise<Project | null> => {
  //   // If not in state, try to get from the hook
  //   return loadProjectFromHook(projectId).then(project => {
  //     if (!project) {
  //       console.warn(`Project ${projectId} not found via hook`);
  //       return null;
  //     }
  //     return project;
  //   });
  // }, [loadProjectFromHook]); 

  // Add a scene - Refactored to use useProjectCore state
  const addScene = useCallback(async (url: string) => {
    // *** ADDED DEBUG LOG AT START OF addScene ***
    console.log(`[ADD-SCENE-ENTRY] addScene function called with URL: ${url}`);
    // *** END ADDED DEBUG LOG ***

    // Monitor state sources (keep for debugging)
    // console.log('[STATE-MONITOR] addScene called with current state:',
    //   'Core hook project:', coreCurrentProject?.id,
    //   'Core hook scenes:', coreCurrentProject?.scenes?.length
    // );
    
    // Use coreCurrentProject as the source of truth
    if (!coreCurrentProject) {
      // console.error('No active project (from core hook) to add scene to');
      dispatch({ type: 'SET_ERROR', payload: { error: 'No active project to add scene to' } });
      return;
    }

    // Use a copy of the hook's current project
    const projectForUpdate = { ...coreCurrentProject }; 
    const projectId = projectForUpdate.id;
    const sceneId = generateId();
    
    // Dispatch loading state to reducer for optimistic UI update ONLY
    // dispatch({ type: 'ADD_SCENE_LOADING', payload: { sceneId, url } }); // Removed dispatch

    try {
      // 1. Extract content
      const response = await extractContent(url);
      if (response.error) {
        throw new Error(response.error.message || 'Failed to extract content');
      }
      const sceneData = response.data.data;
      if (!sceneData) {
        throw new Error('No content data returned from API');
      }

      // 2. Create the new scene object with content
      let mediaType: 'image' | 'video' | 'gallery' | null = null;
      let mediaUrl: string | null = null;
      if (sceneData.metadata?.has_media && sceneData.media_url) {
        mediaType = sceneData.media_type || 'image';
        mediaUrl = sceneData.media_url;
      }
      const newScene: Scene = {
        id: sceneId,
        url,
        text: sceneData.text || '',
        media: mediaUrl && mediaType ? { 
          type: mediaType as 'image' | 'video' | 'gallery', 
          url: mediaUrl,
          thumbnailUrl: sceneData.thumbnail_url, // Assuming this is correct from prior debug
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
        isLoading: false, // Set isLoading to false now content is fetched
      };

      // 3. Create the updated project state based on the *hook's* current state
      // Ensure scene doesn't already exist (e.g., rapid clicks)
      const sceneExists = projectForUpdate.scenes.some(s => s.id === sceneId);
      const updatedScenes = sceneExists 
        ? projectForUpdate.scenes.map(s => s.id === sceneId ? newScene : s) // Update if exists (shouldn't happen often)
        : [...projectForUpdate.scenes, newScene]; // Add if new

      const updatedProject: Project = {
        ...projectForUpdate, // Base on the hook's state copy
        scenes: updatedScenes,
        updatedAt: Date.now()
      };

      // 4. Save the updated project state (using persistence hook)
      // *** ADDED DEBUG LOG BEFORE SAVE IN addScene ***
      console.log(`[ADD-SCENE-DEBUG] Inspecting updatedProject before save:`, JSON.stringify(updatedProject, null, 2));
      // Ensure the new scene looks correct within the project object
      const sceneJustAdded = updatedProject.scenes.find(s => s.id === newScene.id);
      console.log(`[ADD-SCENE-DEBUG] Inspecting the newly added scene within project object:`, JSON.stringify(sceneJustAdded, null, 2));
      // *** END ADDED DEBUG LOG ***
      // console.log(`Saving project with new/updated scene: ${updatedProject.id}, scenes: ${updatedScenes.length}`);
      await saveProject(updatedProject);

      // 5. Update the core hook's state *after* successful save
      updateCoreProjectState(updatedProject);
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });

      // 6. Initiate background media storage if media exists
      // REMOVED BACKGROUND STORAGE BLOCK
      // if (newScene.media?.url) {
      //    // Set storing media flag (optimistic UI)
      //    // dispatch({ type: 'SET_SCENE_STORING_MEDIA', payload: { sceneId: newScene.id, isStoringMedia: true } }); // Removed dispatch
      //    
      //    // *** START REFACTOR ***
      //    try {
      //      // Perform the background media storage
      //      (async () => { 
      //        console.log(`[STORAGE-TASK] Background task started for scene ${newScene.id}`);
      //        try {
      //          // Get necessary IDs from the NEW scene
      //          const projectId = updatedProject.id; // Get project ID from the updated project
      //          const sceneId = newScene.id;
      //
      //          if (!projectId || !sceneId) {
      //            // console.warn('[STORAGE-DEBUG] Missing project or scene ID for background storage');
      //            console.error(`[STORAGE-TASK] Error: Missing projectId (${projectId}) or sceneId (${sceneId})`);
      //            return;
      //          }
      // 
      //          // Add checks for newScene.media and newScene.media.url
      //          if (!newScene.media || !newScene.media.url) {
      //            // console.warn(`[STORAGE-DEBUG] Skipping background storage for scene ${sceneId}: No media URL found.`);
      //            console.warn(`[STORAGE-TASK] Skipping storage for scene ${sceneId}: No media or media.url found.`);
      //            return; // Don't proceed if there's no media URL
      //          }
      // 
      //          console.log(`[STORAGE-TASK] Preparing to call storeMediaFromHook for scene ${sceneId}`);
      //
      //          // Prepare parameters for the hook (matching MediaStorageParams)
      //          const mediaParams = {
      //            projectId: projectId, // Use projectId
      //            sceneId: sceneId,     // Use sceneId
      //            url: newScene.media.url, // Safe to access now
      //            media_type: newScene.media.type, // Safe to access now
      //            create_thumbnail: true // Or determine based on logic
      //          };
      // 
      //          console.log(`[STORAGE-TASK] Calling storeMediaFromHook with params:`, mediaParams);
      //          // Call the hook's function
      //          const storeResult = await storeMediaFromHook(mediaParams);
      //
      //          console.log(`[STORAGE-TASK] storeMediaFromHook completed for scene ${sceneId}. Result:`, JSON.stringify(storeResult, null, 2));
      //
      //          // Handle response from the hook
      //          if (storeResult.error) {
      //            console.error(`[STORAGE-TASK] storeMediaFromHook reported an error for scene ${sceneId}:`, storeResult.error);
      //            // Optionally dispatch an error to the main state
      //            dispatch({ type: 'SET_ERROR', payload: { error: `Failed to store media for scene ${sceneId}: ${storeResult.error.message}` } });
      //          } else if (storeResult.success && storeResult.data) {
      //            // console.log('[STORAGE-DEBUG] Successfully stored media for scene:', sceneId);
      //            // *** ADDED: Explicit call to updateSceneMedia after successful storage ***
      //            // We have the result, now update the main project state via updateSceneMedia
      //            console.log(`[STORAGE-TASK] Preparing to call updateSceneMedia for scene ${sceneId} with data:`, storeResult.data);
      //            await updateSceneMedia( 
      //              sceneId,
      //              {
      //                storageKey: storeResult.data.storage_key,
      //                url: storeResult.data.url, // Update URL to the stored one
      //                thumbnailUrl: storeResult.data.thumbnail_url, // Use the thumbnail URL from response
      //                originalUrl: storeResult.data.original_url || newScene.media.url, // Keep original if needed
      //                contentType: storeResult.data.content_type,
      //                fileSize: storeResult.data.file_size,
      //                isStorageBacked: true, // Mark as stored
      //                storedAt: Date.now() // Add timestamp
      //              }
      //            );
      //            // *** END ADDED SECTION ***
      //          } else {
      //            console.warn(`[STORAGE-TASK] storeMediaFromHook completed but success was not true or data was missing for scene ${sceneId}`);
      //          }
      //
      //        } catch (storageError) {
      //          console.error(`[STORAGE-TASK] Caught error during background task for scene ${newScene.id}:`, storageError);
      //          // Clear storing media flag on error too
      //          // dispatch({ type: 'SET_SCENE_STORING_MEDIA', payload: { sceneId: newScene.id, isStoringMedia: false } }); // Removed dispatch
      //          // Optionally dispatch a global error
      //          dispatch({ type: 'SET_ERROR', payload: { error: `Background media storage failed for scene ${newScene.id}` } });
      //        }
      //      })();
      //
      //    } catch (error) {
      //      // console.error('Error during background media storage via hook:', error);
      //      // Clear storing media flag on error too
      //      // dispatch({ type: 'SET_SCENE_STORING_MEDIA', payload: { sceneId: newScene.id, isStoringMedia: false } }); // Removed dispatch
      //      // Optionally dispatch a global error
      //      dispatch({ type: 'SET_ERROR', payload: { error: `Failed to add scene: ${error instanceof Error ? error.message : String(error)}` } });
      //    } finally {
      //      // Ensure loading state is reset
      //      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
      //    }
      //    // *** END REFACTOR ***
      // }

    } catch (error) {
      // console.error('Error adding scene:', error);
      // Dispatch error state for UI feedback
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Failed to add scene: ${error instanceof Error ? error.message : String(error)}` }
      });
      // Ensure loading state is cleared in reducer if fetch failed early
      // dispatch({ type: 'ADD_SCENE_ERROR', payload: { sceneId, error: 'Failed during addScene' } }); // Removed dispatch
    }
  }, [
    coreCurrentProject, // Depend on the hook's project state
    dispatch,
    saveProject,
    storeMediaFromHook, // Add the hook function as dependency
    updateSceneMedia, // Ensure updateSceneMedia is stable or included
    getLatestProjectState
  ]);

  // Remove a scene - simplified for reliability
  const removeScene = useCallback(async (sceneId: string) => {
    // Monitor state sources
    // console.log('[STATE-MONITOR] removeScene called for scene:', sceneId,
    //   'Core hook project:', coreCurrentProject?.id,
    //   'Core hook scenes:', coreCurrentProject?.scenes?.length
    // );
    
    // *** FIX: Use coreCurrentProject from the hook ***
    // Get the current project from state <<< REMOVED
    // const project = state.currentProject;
    
    // If no current project in the hook state, log error and return
    if (!coreCurrentProject) { // <<< UPDATED CHECK
      // console.error('No active project (from core hook) to remove scene from');
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'No active project to remove scene from' },
      });
      return;
    }

    // *** FIX: Use coreCurrentProject consistently ***
    const project = coreCurrentProject; // Use the hook's project

    try {
      // Check if the scene exists
      const sceneIndex = project.scenes.findIndex(scene => scene.id === sceneId);
      if (sceneIndex === -1) {
        // console.warn(`Scene ${sceneId} not found in project ${project.id}, proceeding with UI update only`);
      }
      
      // Create an updated project with the scene removed
      const updatedScenes = project.scenes.filter(scene => scene.id !== sceneId);
      const updatedProject = {
        ...project, // Base the update on coreCurrentProject
        scenes: updatedScenes,
        updatedAt: Date.now()
      };
      
      // Update UI first for responsiveness
      // dispatch({ type: 'REMOVE_SCENE', payload: { sceneId } }); // Removed dispatch
      
      // Then save to storage
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } }); // Keep saving state dispatch
      
      await saveProject(updatedProject);
      
      // Update core hook state *after* successful save
      updateCoreProjectState(updatedProject);
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });

    } catch (error) {
      // console.error('Error saving project after scene removal:', error);
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Error removing scene: ${error instanceof Error ? error.message : 'Unknown error'}` },
      });
    }
  }, [coreCurrentProject, dispatch, saveProject, updateCoreProjectState]);

  // Reorder scenes in the current project
  const reorderScenes = useCallback(async (sceneIds: string[]) => { 
    // Monitor state sources (keep for debugging)
    // console.log('[STATE-MONITOR] reorderScenes called ...'); // Abbreviated log
    
    // Use coreCurrentProject as the source of truth
    if (!coreCurrentProject) { // <<< ADDED NULL CHECK
      // console.error('No active project (from core hook) to reorder scenes in');
      dispatch({ type: 'SET_ERROR', payload: { error: 'No active project' } });
      return;
    }
    
    const scenesMap = new Map(coreCurrentProject.scenes.map(scene => [scene.id, scene]));
    const reorderedScenes = sceneIds
      .map(id => scenesMap.get(id))
      .filter((scene): scene is Scene => scene !== undefined);
    
    // Ensure the created object conforms to Project type
    const updatedProject: Project = { // <<< Explicit Project type assertion
      ...coreCurrentProject,
      scenes: reorderedScenes,
      updatedAt: Date.now()
    };

    // *** Dispatch for optimistic UI update FIRST ***
    // dispatch({ type: 'REORDER_SCENES', payload: { sceneIds } }); // Removed dispatch

    // Save after reordering
    try {
      await saveProject(updatedProject);
      // Update core hook state *after* successful save
      updateCoreProjectState(updatedProject); // Pass the correctly typed object
    } catch (error) { 
       // console.error('Error saving project after reordering scenes:', error);
       dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save scene order' } });
    }
  }, [coreCurrentProject, dispatch, saveProject, updateCoreProjectState]);

  // Update scene text
  const updateSceneText = useCallback(async (sceneId: string, text: string) => {
    if (!coreCurrentProject) return;

    const updatedScenes = coreCurrentProject.scenes.map((scene) => {
      if (scene.id === sceneId) {
        return { ...scene, text };
      }
      return scene;
    });
    const updatedProject: Project = { 
      ...coreCurrentProject, 
      scenes: updatedScenes, 
      updatedAt: Date.now() 
    };

    // Dispatch for optimistic UI update
    // dispatch({ type: 'UPDATE_SCENE_TEXT', payload: { sceneId, text } }); // Removed dispatch

    try {
      await saveProject(updatedProject);
      updateCoreProjectState(updatedProject); // Update state after save
    } catch (error) {
      // console.error("Failed to save scene text:", error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save text change' } });
    }
  }, [coreCurrentProject, dispatch, saveProject, updateCoreProjectState]);

  // Update scene audio data
  const updateSceneAudio = useCallback(async (
    sceneId: string, 
    audioData: Scene['audio'], 
    voiceSettings: Scene['voice_settings']
  ) => {
    if (!coreCurrentProject) return;

    const updatedScenes = coreCurrentProject.scenes.map((scene) => {
      if (scene.id === sceneId) {
        return {
          ...scene,
          audio: audioData,
          voice_settings: voiceSettings,
        };
      }
      return scene;
    });
    const updatedProject: Project = { 
      ...coreCurrentProject, 
      scenes: updatedScenes, 
      updatedAt: Date.now() 
    };

    try {
      await saveProject(updatedProject);
      updateCoreProjectState(updatedProject); // Update state after save
    } catch (error) {
      // console.error("Failed to save scene audio:", error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to save audio change' } });
    }
  }, [coreCurrentProject, dispatch, saveProject, updateCoreProjectState]);

  // Delete all projects
  const deleteAllProjects = useCallback(async (): Promise<void> => {
    dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
    try {
      // Clear from local storage via hook
      await deleteAllProjectsFromHook();
      // Clear state
      dispatch({ type: 'CLEAR_ALL_PROJECTS' });
      // Clear current project - Use correct payload
      // dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId: null } }); // Removed dispatch (hook handles this)
      router.push('/');
    } catch (error) {
      // console.error('Error deleting all projects:', error);
      dispatch({ type: 'SET_ERROR', payload: { error: 'Failed to delete all projects' } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [deleteAllProjectsFromHook, router]);

  // Toggle letterboxing display
  const toggleLetterboxing = useCallback(async (show: boolean) => {
    // console.log('[ProjectProvider] Toggling letterboxing:', show);
    
    if (!coreCurrentProject) return;
    
    // Update the current project with the new letterboxing setting
    const updatedProject = {
      ...coreCurrentProject,
      showLetterboxing: show,
      updatedAt: Date.now()
    };
    
    // Update the core project state
    updateCoreProjectState(updatedProject);
    
    // Use our debounced save - this will save after the debounce period
    debouncedSaveProject(updatedProject);
    
  }, [coreCurrentProject, updateCoreProjectState, debouncedSaveProject]);

  // Memoize the context value to prevent unnecessary re-renders
  // Split context values into separate memoized objects
  const stateValues = useMemo(() => ({
    projects: state.projects,
    currentProject: coreCurrentProject, // Use the hook's version of the current project
    projectId: coreCurrentProject?.id, // <<< PASS PROJECT ID
    isLoading: state.isLoading,
    error: state.error,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving, // Continue using reducer's isSaving synchronized from hook
  }), [
    state.projects,
    coreCurrentProject, // Depend on the hook's currentProject
    coreCurrentProject?.id, // <<< DEPEND ON PROJECT ID
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
