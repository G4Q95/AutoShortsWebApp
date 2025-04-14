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
import {
  saveProject,
  getProject,
  deleteProject,
  getProjectsList,
  projectExists,
  clearAllProjects,
} from '../../lib/storage-utils';
import { deleteProject as deleteProjectFromAPI } from '../../lib/api/projects';
import { determineMediaType, generateVideoThumbnail, storeAllProjectMedia } from '../../lib/media-utils';
import { storeSceneMedia } from '../../utils/media-utils';
import { SceneMedia } from '@/utils/media-utils';

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
const ProjectContext = createContext<(ProjectState & {
  /** Creates a new project with the given title */
  createProject: (title: string) => void;
  /** Sets the current active project by ID */
  setCurrentProject: (projectId: string) => void;
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
  /** Deletes the current project */
  deleteCurrentProject: () => Promise<void>;
  /** Loads a project by ID */
  loadProject: (projectId: string) => Promise<Project | undefined>;
  /** Creates a copy of an existing project */
  duplicateProject: (projectId: string) => Promise<string | null>;
  /** Deletes all projects */
  deleteAllProjects: () => Promise<void>;
  /** Refreshes the projects list */
  refreshProjects: () => Promise<void>;
  /** Sets the UI mode for progressive enhancement */
  setMode: (mode: 'organization' | 'voice-enabled' | 'preview') => void;
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
  /** Sets the aspect ratio for the current project */
  setProjectAspectRatio: (aspectRatio: Project['aspectRatio']) => void;
  /** Toggles letterboxing/pillarboxing display */
  toggleLetterboxing: (show: boolean) => void;
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
  
  // Add a ref to track media storage operations in progress
  const mediaStorageOperationsRef = useRef<Record<string, boolean>>({});
  
  // Keep track of storage operations
  const [storageInProgress, setStorageInProgress] = useState(false);

  // Auto-save timer reference
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Fetch all projects
  const loadProjects = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      const projects = await getProjectsList().then(async (projectsMetadata) => {
        const projectsPromises = projectsMetadata.map(async (metadata) => {
          return getProject(metadata.id);
        });
        return Promise.all(projectsPromises);
      });
      
      // Filter out null projects (failed to load)
      const validProjects = projects.filter((p): p is Project => p !== null);
      
      dispatch({ type: 'LOAD_PROJECTS', payload: { projects: validProjects } });
    } catch (error) {
      console.error('Failed to load projects:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'Failed to load projects' },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, []);

  // Refresh the projects list
  const refreshProjects = useCallback(async (): Promise<void> => {
    return loadProjects();
  }, [loadProjects]);

  // Load projects from localStorage on initial mount
  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Function to save the current project to localStorage
  const saveCurrentProject = useCallback(async () => {
    if (!state.currentProject) {
      console.warn('No active project to save');
      return;
    }

    try {
      // Capture project reference to ensure it doesn't change during save operation
      const projectToSave = { ...state.currentProject };
      
      // Log scenes count to help debug
      console.log(`Saving project: ${projectToSave.id}, ${projectToSave.title}, scenes: ${projectToSave.scenes.length}`);
      
      // If project has no scenes but should have them, try to recover
      if (projectToSave.scenes.length === 0) {
        try {
          // Check if we can recover scenes from localStorage
          const key = `auto-shorts-project-${projectToSave.id}`;
          const storedProjectJson = localStorage.getItem(key);
          if (storedProjectJson) {
            const storedProject = JSON.parse(storedProjectJson);
            if (storedProject.scenes && storedProject.scenes.length > 0) {
              console.log(`Recovered ${storedProject.scenes.length} scenes from localStorage during save`);
              // Use the recovered scenes
              projectToSave.scenes = storedProject.scenes;
            }
          }
        } catch (recoveryError) {
          console.error('Failed to recover scenes during save:', recoveryError);
        }
      }
      
      dispatch({ type: 'SET_SAVING', payload: { isSaving: true } });

      await saveProject(projectToSave);

      const timestamp = Date.now();
      dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp } });

      console.log(`Project "${projectToSave.title}" saved successfully with ${projectToSave.scenes.length} scenes`);
    } catch (error) {
      console.error('Failed to save project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { error: 'Failed to save project' },
      });
    } finally {
      dispatch({ type: 'SET_SAVING', payload: { isSaving: false } });
    }
  }, [state.currentProject]);

  // Set up auto-save whenever currentProject changes
  useEffect(() => {
    let isMounted = true;
    
    // If we have a current project, set up auto-save
    if (state.currentProject) {
      // Clear existing timer if any
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      // Set up new timer for auto-save
      autoSaveTimerRef.current = setTimeout(async () => {
        if (!isMounted) return;
        
        try {
          // Cache the current project to avoid null issues
          const currentProject = state.currentProject;
          
          // Verify project still exists before saving
          if (!currentProject) {
            console.warn('Auto-save canceled: Project no longer exists in state');
            return;
          }
          
          console.log(`Auto-save triggered for project: ${currentProject.id}, scenes: ${currentProject.scenes.length}`);
          
          // Create a fresh copy of the project to avoid reference issues
          const projectToSave = JSON.parse(JSON.stringify(currentProject));
          
          // Save directly using saveProject to ensure a complete save
          await saveProject(projectToSave);
          
          // Then update the last saved timestamp in the UI
          if (isMounted) {
            dispatch({ type: 'SET_LAST_SAVED', payload: { timestamp: Date.now() } });
            console.log(`Auto-save completed successfully for project: ${projectToSave.id}`);
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 1000); // Reduced from 3000ms to 1000ms for faster saving
    }

    // Cleanup function to clear the timer and prevent further saves
    return () => {
      isMounted = false;
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [state.currentProject, dispatch]);

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
    if (!state.currentProject) return;
    
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
    dispatch({ type: 'CREATE_PROJECT', payload: { title } });
  }, []);

  // Set current project by ID
  const setCurrentProject = useCallback((projectId: string) => {
    dispatch({ type: 'SET_CURRENT_PROJECT', payload: { projectId } });
  }, []);

  // Update scene media data
  const updateSceneMedia = useCallback((
    sceneId: string, 
    mediaData: Partial<Scene['media']>
  ) => {
    dispatch({ 
      type: 'UPDATE_SCENE_MEDIA', 
      payload: { 
        sceneId, 
        mediaData 
      } 
    });
    
    // Save the project after updating media to ensure persistence
    saveCurrentProject().catch(error => {
      console.error('Error saving project after updating scene media:', error);
    });
  }, [saveCurrentProject]);

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
      // Use the statically imported storeAllProjectMedia
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
  const getProjectWithScenes = useCallback((projectId: string): Promise<Project | null> => {
    // First try to get from state
    if (state.currentProject && state.currentProject.id === projectId) {
      return Promise.resolve({...state.currentProject});
    }
    
    // If not in state, try to get from localStorage
    return getProject(projectId).then(project => {
      if (!project) {
        console.warn(`Project ${projectId} not found in localStorage`);
        return null;
      }
      return project;
    });
  }, [state.currentProject]);

  // Add a scene - enhanced with better error handling and immediate saving
  const addScene = useCallback(async (url: string) => {
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

      // 5. New useEffect to handle background media storage after state updates
      useEffect(() => {
        if (!state.currentProject) return;

        const projectId = state.currentProject.id;
        const scenesToStore = state.currentProject.scenes.filter(
          scene => scene.media?.url && !scene.media.storageKey
        );

        if (scenesToStore.length > 0) {
          console.log(`[EFFECT STORAGE] Found ${scenesToStore.length} scenes needing media storage.`);
          scenesToStore.forEach(async (scene) => {
            if (!scene.media) return; // Type guard

            console.log(`[EFFECT STORAGE] Initiating storage for scene: ${scene.id}, URL: ${scene.media.url}`);
            dispatch({
              type: 'SET_SCENE_STORING_MEDIA',
              payload: { sceneId: scene.id, isStoringMedia: true }
            });

            try {
              const storageResult = await storeSceneMedia(
                scene,
                projectId,
                updateSceneMedia
              );
              console.log(`[EFFECT STORAGE] Storage result for scene ${scene.id}:`, storageResult);

              // Final save to persist any storageKey/URL updates from the callback
              // Get the absolute latest state before saving
              const latestStateProject = state.currentProject; 
              if(latestStateProject && latestStateProject.id === projectId) {
                 await saveProject(latestStateProject);
                 console.log(`[EFFECT STORAGE] Final save after storage attempt for scene ${scene.id}`);
              }
              
            } catch (error) {
              console.error(`[EFFECT STORAGE] Error storing media for scene ${scene.id}:`, error);
            } finally {
              // Ensure storing flag is reset regardless of outcome
              dispatch({
                type: 'SET_SCENE_STORING_MEDIA',
                payload: { sceneId: scene.id, isStoringMedia: false }
              });
            }
          });
        }
      }, [state.currentProject, updateSceneMedia]); // Depend on currentProject

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
  }, [state.currentProject, dispatch, updateSceneMedia, saveCurrentProject, isMediaStorageInProgress, saveProject, getProjectWithScenes]);

  // Remove a scene - simplified for reliability
  const removeScene = useCallback((sceneId: string) => {
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
  }, [state.currentProject, dispatch]);

  // Reorder scenes in the current project
  const reorderScenes = useCallback((sceneIds: string[]) => {
    if (!state.currentProject) return;

    dispatch({
      type: 'REORDER_SCENES',
      payload: { sceneIds },
    });

    // Save after reordering with a slight delay to avoid too many saves
    setTimeout(() => {
      try {
        saveCurrentProject();
      } catch (error) {
        console.error('Error during follow-up save after reordering:', error);
      }
    }, 1000);
  }, [state.currentProject, dispatch, saveCurrentProject]);

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
    saveCurrentProject().catch(error => {
      console.error('Error saving project after updating scene audio:', error);
    });
  }, [saveCurrentProject]);

  // Set project title
  const setProjectTitle = useCallback((title: string) => {
    dispatch({ type: 'SET_PROJECT_TITLE', payload: { title } });
  }, []);

  // Delete current project
  const deleteCurrentProject = useCallback(async () => {
    if (!state.currentProject) {
      console.warn('No active project to delete');
      return;
    }

    try {
      const projectId = state.currentProject.id;
      
      // First delete from backend API to clean up R2 storage
      console.log(`Deleting project ${projectId} from backend API`);
      await deleteProjectFromAPI(projectId);
      
      // Then remove from local storage
      console.log(`Deleting project ${projectId} from local storage`);
      await deleteProject(projectId);
      
      // Only refresh projects after successful deletion
      await loadProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to delete project: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
    }
  }, [state.currentProject, loadProjects]);

  // Load a project by ID
  const loadProject = useCallback(async (projectId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });

      // Check if project exists
      const exists = await projectExists(projectId);
      if (!exists) {
        throw new Error(`Project with ID ${projectId} not found`);
      }

      // Load the project
      const project = await getProject(projectId);
      if (!project) {
        throw new Error(`Failed to load project with ID ${projectId}`);
      }

      console.log(`Loading project: ${projectId}`);

      // Update state with loaded project
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project },
      });

      // Ensure project is set as current
      dispatch({
        type: 'SET_CURRENT_PROJECT',
        payload: { projectId },
      });

      return project;
    } catch (error) {
      console.error('Failed to load project:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: {
          error: `Failed to load project: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        },
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);

  // Duplicate an existing project
  const duplicateProject = useCallback(async (projectId: string): Promise<string | null> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      // Load the source project to duplicate
      const sourceProject = await getProject(projectId);
      
      if (!sourceProject) {
        dispatch({
          type: 'SET_ERROR',
          payload: { error: `Project with ID ${projectId} not found` },
        });
        return null;
      }
      
      // Create a new project object with a new ID and updated timestamps
      const newProject: Project = {
        ...sourceProject,
        id: generateId(),
        title: `${sourceProject.title} (Copy)`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      // Save the new project
      await saveProject(newProject);
      
      dispatch({ 
        type: 'DUPLICATE_PROJECT_SUCCESS', 
        payload: { projectId: newProject.id } 
      });
      
      // Refresh the projects list
      await refreshProjects();
      
      return newProject.id;
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Failed to duplicate project: ${error}` },
      });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch, refreshProjects]);

  // Delete all projects
  const deleteAllProjects = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: true } });
      
      // Clear all projects from localStorage
      await clearAllProjects();
      
      // Update state
      dispatch({ type: 'CLEAR_ALL_PROJECTS' });
      
    } catch (error) {
      dispatch({
        type: 'SET_ERROR',
        payload: { error: `Failed to delete all projects: ${error}` },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { isLoading: false } });
    }
  }, [dispatch]);

  // Set the UI mode
  const setMode = useCallback((mode: 'organization' | 'voice-enabled' | 'preview') => {
    dispatch({ type: 'SET_MODE', payload: { mode } });
  }, []);

  // Progress to the next UI mode
  const nextMode = useCallback(() => {
    dispatch({ 
      type: 'SET_MODE', 
      payload: { 
        mode: state.mode === 'organization' 
          ? 'voice-enabled' 
          : state.mode === 'voice-enabled' 
            ? 'preview' 
            : 'organization' 
      } 
    });
  }, [state.mode]);

  // Return to the previous UI mode
  const previousMode = useCallback(() => {
    dispatch({ 
      type: 'SET_MODE', 
      payload: { 
        mode: state.mode === 'preview' 
          ? 'voice-enabled' 
          : state.mode === 'voice-enabled' 
            ? 'organization' 
            : 'preview' 
      } 
    });
  }, [state.mode]);

  // Set project aspect ratio  
  const setProjectAspectRatio = useCallback(async (aspectRatio: Project['aspectRatio']) => {
    if (!state.currentProject) {
      console.warn('[ProjectProvider] No active project to update aspect ratio for');
      return;
    }

    console.log('[ProjectProvider] Setting aspect ratio:', {
      currentRatio: state.currentProject.aspectRatio,
      newRatio: aspectRatio,
      projectId: state.currentProject.id
    });

    // Create updated project with new aspect ratio
    const updatedProject = {
      ...state.currentProject,
      aspectRatio,
      updatedAt: Date.now()
    };

    // First update the state immediately for UI responsiveness
    dispatch({
      type: 'SET_PROJECT_ASPECT_RATIO',
      payload: { aspectRatio }
    });

    // Then save the project
    try {
      await saveProject(updatedProject);
      
      // Verify the update by getting a fresh copy of the project
      const savedProject = await getProject(state.currentProject.id);
      
      if (!savedProject) {
        throw new Error('Failed to retrieve saved project');
      }
      
      console.log('[ProjectProvider] Aspect ratio update verification:', {
        requestedRatio: aspectRatio,
        savedRatio: savedProject.aspectRatio,
        stateRatio: state.currentProject.aspectRatio
      });
      
      // Check if the aspect ratio was properly saved
      if (savedProject.aspectRatio !== aspectRatio) {
        console.error('[ProjectProvider] Aspect ratio mismatch after save:', {
          requested: aspectRatio,
          saved: savedProject.aspectRatio
        });
        throw new Error('Aspect ratio update failed to persist');
      }

      // Update state with the saved project to ensure consistency
      dispatch({
        type: 'LOAD_PROJECT_SUCCESS',
        payload: { project: savedProject }
      });

      console.log('[ProjectProvider] Aspect ratio update successful:', aspectRatio);
    } catch (error) {
      console.error('[ProjectProvider] Error saving project after updating aspect ratio:', error);
      dispatch({
        type: 'SET_ERROR',
        payload: { 
          error: `Failed to save aspect ratio change: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      throw error;
    }
  }, [state.currentProject, dispatch, saveProject]);

  // Toggle letterboxing display
  const toggleLetterboxing = useCallback((show: boolean) => {
    console.log('[ProjectProvider] Toggling letterboxing:', show);
    
    dispatch({ 
      type: 'TOGGLE_LETTERBOXING', 
      payload: { showLetterboxing: show } 
    });
    
    // Force a re-render of affected components
    dispatch({ type: 'FORCE_UPDATE' });
    
    // Save the project after toggling letterboxing
    saveCurrentProject().catch(error => {
      console.error('Error saving project after toggling letterboxing:', error);
    });
  }, [saveCurrentProject]);

  // Memoize the context value to prevent unnecessary re-renders
  // Split context values into separate memoized objects
  const stateValues = useMemo(() => ({
    projects: state.projects,
    currentProject: state.currentProject,
    isLoading: state.isLoading,
    error: state.error,
    lastSaved: state.lastSaved,
    isSaving: state.isSaving,
    mode: state.mode,
  }), [
    state.projects,
    state.currentProject,
    state.isLoading,
    state.error,
    state.lastSaved,
    state.isSaving,
    state.mode
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
    setProjectTitle,
    saveCurrentProject,
    deleteCurrentProject,
    loadProject,
    duplicateProject,
    deleteAllProjects,
    refreshProjects,
    setMode,
    nextMode,
    previousMode,
    storeAllMedia,
    setProjectAspectRatio,
    toggleLetterboxing
  }), [
    createProject,
    setCurrentProject,
    addScene,
    removeScene,
    reorderScenes,
    updateSceneText,
    updateSceneAudio,
    updateSceneMedia,
    setProjectTitle,
    saveCurrentProject,
    deleteCurrentProject,
    loadProject,
    duplicateProject,
    deleteAllProjects,
    refreshProjects,
    setMode,
    nextMode,
    previousMode,
    storeAllMedia,
    setProjectAspectRatio,
    toggleLetterboxing
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
