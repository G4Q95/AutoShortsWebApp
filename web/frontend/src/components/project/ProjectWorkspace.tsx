'use client';

/**
 * COMPLEX VIDEO CREATION - Main Workspace Component
 *
 * This component provides the full project workspace interface for the COMPLEX video creation flow, including:
 * - Adding multiple Reddit URL scenes
 * - Reordering scenes via drag-and-drop
 * - Editing scene content
 * - Saving and processing the project
 *
 * It is used in the /projects/create route and other project-related pages.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from '@/components/project/ProjectProvider';
import { Scene, Project } from './ProjectProvider';
import { SceneComponent } from './SceneComponent';
import {
  PlusCircle as PlusCircleIcon,
  Loader2 as LoaderIcon,
  AlertTriangle as AlertIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Zap as ZapIcon,
  LayoutTemplate,
} from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { processVideoWithCustomization, processVideoFast } from '@/lib/project-utils';
import { getProject } from '@/lib/storage-utils';
import SaveStatusIndicator from './SaveStatusIndicator';
import AspectRatioDropdown from '../ui/AspectRatioDropdown';
import { type AspectRatioOption } from '../ui/AspectRatioIcon';

/**
 * Props for the ProjectWorkspace component
 * @interface ProjectWorkspaceProps
 */
interface ProjectWorkspaceProps {
  /** Optional project ID when editing an existing project */
  projectId?: string;
  /** Optional preloaded project data */
  preloadedProject?: Project;
  /** Optional initial project name for new projects */
  initialProjectName?: string;
}

/**
 * The main workspace component for creating and editing video projects.
 * Provides a full-featured interface for managing scenes, content, and project settings.
 * 
 * Features:
 * - Project creation and editing
 * - Scene management (add, remove, reorder)
 * - URL content extraction
 * - Drag and drop scene reordering
 * - Auto-saving
 * - Manual save option
 * - Video processing with customization
 * - Fast video processing mode
 * - Error handling and recovery
 * - Loading states
 * - Project status indicators
 * 
 * States:
 * - Loading: Initial project load
 * - Saving: Auto or manual save in progress
 * - Processing: Video generation
 * - Error: Various error states with recovery options
 * - Ready: Normal editing state
 * 
 * @component
 * @example
 * ```tsx
 * // Create new project
 * <ProjectWorkspace 
 *   initialProjectName="My Video Project"
 * />
 * 
 * // Edit existing project
 * <ProjectWorkspace
 *   projectId="existing-project-id"
 *   preloadedProject={existingProject}
 * />
 * ```
 */
export default function ProjectWorkspace({
  projectId,
  preloadedProject,
  initialProjectName,
}: ProjectWorkspaceProps) {
  const router = useRouter();
  const {
    currentProject,
    addScene,
    removeScene,
    updateSceneText,
    setCurrentProject,
    error: contextError,
    setProjectTitle,
    saveCurrentProject,
    reorderScenes,
    isLoading: isContextLoading,
    isSaving,
    lastSaved,
    createProject,
    loadProject,
    mode,
    setMode,
    nextMode,
    setProjectAspectRatio,
    toggleLetterboxing,
  } = useProject();

  const [url, setUrl] = useState('');
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [addSceneError, setAddSceneError] = useState<string | null>(null);
  const [localProject, setLocalProject] = useState<Project | null>(preloadedProject || null);
  const [localLoading, setLocalLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{ isChecked: boolean; isAvailable: boolean }>({
    isChecked: false,
    isAvailable: false,
  });
  const [title, setTitle] = useState(initialProjectName || 'New Project');
  const [isCreating, setIsCreating] = useState(false);
  const [debugInfo, setDebugInfo] = useState<{ lastAction: string }>({ lastAction: 'Initial load' });

  // Local state to track if we're already loaded from the preloaded project
  const loadAttemptedRef = useRef(false);
  const mountCountRef = useRef(0);
  const instanceIdRef = useRef(`workspace-${Math.random().toString(36).substring(2, 7)}`);
  const newProjectCreatedRef = useRef(false);
  const projectLoadingRef = useRef(false); // New ref to track if project is currently loading

  /**
   * Effect: Project Initialization
   * Handles the initial setup of the project workspace based on provided props.
   * - Loads existing project if projectId is provided
   * - Uses preloaded project if available
   * - Creates new project if neither exists
   * 
   * Dependencies: [projectId, preloadedProject, currentProject, setCurrentProject, createProject, 
   *               loadProject, initialProjectName, setLocalProject, setLocalLoading, setError, setDebugInfo]
   */
  useEffect(() => {
    mountCountRef.current += 1;
    console.log(
      `[${instanceIdRef.current}] ProjectWorkspace mounted (count: ${mountCountRef.current})`,
      {
        projectId,
        preloadedProject: preloadedProject ? preloadedProject.id : null,
        localProject: localProject ? localProject.id : null,
        currentProject: currentProject ? currentProject.id : null,
      }
    );

    // Set voice-enabled as the default mode
    if (mode === 'organization') {
      setMode('voice-enabled');
    }

    // If we're already loading a project, don't do anything
    if (projectLoadingRef.current) {
      return;
    }

    // If we have a preloaded project, use it and don't trigger context loading
    if (preloadedProject) {
      console.log(`[${instanceIdRef.current}] Using preloaded project:`, preloadedProject.id);
      setLocalProject(preloadedProject);
      setLocalLoading(false);
      return;
    }

    // If we already have a project, don't load again
    if (currentProject) {
      console.log(`[${instanceIdRef.current}] Using existing project:`, currentProject.id);
      setLocalLoading(false);
      return;
    }

    // If we have a project ID, attempt to load it
    if (projectId && !loadAttemptedRef.current && loadProject) {
      loadAttemptedRef.current = true;
      projectLoadingRef.current = true;
      console.log(`[${instanceIdRef.current}] Loading project via API:`, projectId);
      
      setLocalLoading(true);
      loadProject(projectId)
        .then(() => {
          console.log(`Successfully loaded project ${projectId}`);
          
          // Check if we need to explicitly set the project as current
          if (!currentProject) {
            console.log(`Project ${projectId} was not set as current project after loading, setting it now`);
            setCurrentProject(projectId);
          }
        })
        .catch((err) => {
          console.error(`Failed to load project ${projectId}:`, err);
          setError(`Failed to load project: ${err instanceof Error ? err.message : 'Unknown error'}`);
        })
        .finally(() => {
          setLocalLoading(false);
          projectLoadingRef.current = false;
        });
      return;
    }

    // If we don't have a project ID or preloaded project, create a new one
    if (!projectId && !preloadedProject && !currentProject && !newProjectCreatedRef.current && createProject) {
      newProjectCreatedRef.current = true;
      console.log(`[${instanceIdRef.current}] Creating new project automatically`);

      // Create a new project with the provided title or default
      createProject(initialProjectName || 'New Video Project');
      setDebugInfo((prev) => ({ ...prev, lastAction: 'Created new project automatically' }));
    }

    setLocalLoading(false);
  }, [
    projectId,
    preloadedProject,
    currentProject,
    setCurrentProject,
    createProject,
    loadProject,
    initialProjectName,
    setLocalProject,
    setLocalLoading,
    setError,
    setDebugInfo,
    mode,
    setMode
  ]);

  // Use either preloaded project, local state, or context project
  const effectiveProject = localProject || currentProject;

  /**
   * Effect: Project Synchronization
   * Ensures the effective project (local or preloaded) is synchronized with the current project in context.
   * - Syncs project state between local and context
   * - Handles project loading when needed
   * - Manages project ID consistency
   * 
   * Dependencies: [effectiveProject, currentProject, setCurrentProject, projectId, loadProject]
   */
  useEffect(() => {
    if (effectiveProject && setCurrentProject && 
        (!currentProject || currentProject.id !== effectiveProject.id)) {
      console.log(`Synchronizing effectiveProject as currentProject: ${effectiveProject.id}`);
      
      // If we're setting a project that doesn't exist in context yet, we may need to load it
      if (projectId && loadProject && 
          (!currentProject || currentProject.id !== projectId)) {
        console.log(`Project ${projectId} needs to be loaded before setting as current`);
        loadProject(projectId)
          .then(() => {
            console.log(`Successfully loaded project ${projectId} during sync`);
          })
          .catch(err => {
            console.error(`Error loading project during sync: ${err}`);
          });
        return;
      }
      
      setCurrentProject(effectiveProject.id);
    }
  }, [effectiveProject, currentProject, setCurrentProject, projectId, loadProject]);

  /**
   * Effect: Local Project State Update
   * Updates the local project state whenever the current project in context changes.
   * Ensures local state reflects the latest project data.
   * 
   * Dependencies: [currentProject]
   */
  useEffect(() => {
    if (currentProject) {
      console.log(`Current project updated in context, syncing to local state: ${currentProject.id} (${currentProject.scenes.length} scenes)`);
      setLocalProject(currentProject);
    }
  }, [currentProject]);

  /**
   * Formats the last saved time into a human-readable string
   * @returns {string} A formatted string representing when the project was last saved
   * - 'just now' for less than 60 seconds
   * - 'X min ago' for less than an hour
   * - 'X hours ago' for less than a day
   * - Date string for older saves
   */
  const formatSavedTime = () => {
    if (!lastSaved) return '';

    const now = new Date();
    const savedTime = new Date(lastSaved);
    const diffMs = now.getTime() - savedTime.getTime();
    const diffSecs = Math.floor(diffMs / 1000);

    if (diffSecs < 60) return 'just now';
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)} min ago`;
    if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)} hours ago`;
    return savedTime.toLocaleDateString();
  };

  /**
   * Handles changes to the URL input field
   * Clears any previous error messages when the URL is updated
   * @param {string} newUrl - The new URL value from the input field
   */
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setAddSceneError(null);
  };

  /**
   * Handles the submission of a new URL to create a scene
   * This function performs several steps:
   * 1. Validates the URL and project state
   * 2. Ensures the correct project is set as current
   * 3. Adds the scene to the project
   * 4. Updates local and context state with the new scene
   * 5. Handles any errors that occur during the process
   * 
   * @throws Will set error state if:
   * - URL is empty
   * - No active project exists
   * - Scene addition fails
   * - Project state synchronization fails
   */
  const handleUrlSubmit = async () => {
    if (!url.trim() || !addScene) return;

    setIsAddingScene(true);
    setAddSceneError(null);
    setDebugInfo({ lastAction: `Adding scene URL: ${url.trim()}` });

    // Ensure the project is set as current before adding a scene
    if (effectiveProject && (!currentProject || currentProject.id !== effectiveProject.id) && setCurrentProject) {
      console.log(`Synchronizing project state before adding scene: ${effectiveProject.id}`);
      
      // If we need to load the project first
      if (projectId && loadProject && (!currentProject || currentProject.id !== projectId)) {
        console.log(`Loading project ${projectId} before adding scene`);
        
        try {
          await loadProject(projectId);
          console.log(`Successfully loaded project ${projectId} for adding scene`);
        } catch (err) {
          console.error(`Failed to load project ${projectId} for adding scene:`, err);
          setAddSceneError(`Failed to load project: ${err instanceof Error ? err.message : 'Unknown error'}`);
          setIsAddingScene(false);
          return;
        }
      } else {
        // Set the effective project as current
        setCurrentProject(effectiveProject.id);
        
        // Small delay to let state update
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const projectToUse = effectiveProject?.id || (currentProject?.id);
    if (!projectToUse) {
      setAddSceneError('No active project to add scene to');
      setIsAddingScene(false);
      return;
    }

    try {
      // Add the scene
      await addScene(url.trim());
      setUrl(''); // Clear input after addScene returns

      // Direct approach: Get the fresh project data from localStorage
      try {
        const updatedProject = await getProject(projectToUse);
        if (updatedProject) {
          // Update both local state and context
          setLocalProject(updatedProject);

          // Explicitly load the project into context
          if (loadProject) {
            await loadProject(projectToUse);
          }
        } else {
          console.error(`[WORKSPACE] Failed to fetch updated project ${projectToUse} after adding scene`);
        }
      } catch (fetchErr) {
        console.error('[WORKSPACE] Error fetching updated project:', fetchErr);
      }

      // Explicitly mark this action in debug info
      setDebugInfo({ lastAction: `Successfully added scene with URL: ${url.trim()}` });
    } catch (error) {
      console.error('[WORKSPACE] Error adding scene:', error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to add scene');
      setDebugInfo({ lastAction: `Error adding scene: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsAddingScene(false);
    }
  };

  /**
   * Fills the URL input field with an example Reddit post URL
   * Used for demonstration purposes and to help users understand the expected format
   */
  const fillExampleUrl = () => {
    setUrl(
      'https://www.reddit.com/r/oddlyterrifying/comments/1j7csx4/some_sorta_squid_in_australian_street/'
    );
  };

  /**
   * Retries loading a scene by removing and re-adding it with the same URL
   * Useful when a scene fails to load initially due to temporary issues
   * 
   * @param {string} sceneId - The ID of the scene to retry
   * @param {string} url - The original URL of the scene
   */
  const handleRetryLoad = async (sceneId: string, url: string) => {
    if (!removeScene || !addScene) return;

    // First remove the scene
    await removeScene(sceneId);

    // Then add it again with the same URL
    try {
      await addScene(url);
    } catch (error) {
      console.error('Error retrying scene load:', error);
    }
  };

  /**
   * Handles the completion of a drag-and-drop operation for scene reordering
   * Updates the scene order in the project state based on the drag result
   * 
   * @param {DropResult} result - The result object from react-beautiful-dnd containing source and destination indices
   */
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !reorderScenes) {
      console.log('Invalid drag result or reorderScenes not available:', result);
      return;
    }

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    if (effectiveProject) {
      setDebugInfo({ lastAction: `Reordering scenes: ${sourceIndex} → ${destinationIndex}` });
      
      const newSceneIds = [...effectiveProject.scenes.map((scene) => scene.id)];
      const [removed] = newSceneIds.splice(sourceIndex, 1);
      newSceneIds.splice(destinationIndex, 0, removed);

      // Log the scene IDs for debugging
      console.log('Reordering scenes with IDs:', newSceneIds);
      
      reorderScenes(newSceneIds);
      
      // Log completion of reordering
      setDebugInfo({ lastAction: `Completed reordering scenes: ${sourceIndex} → ${destinationIndex}` });
    }
  };

  /**
   * Creates a new project with the current title
   * Prevents default form submission and validates the title
   * 
   * @param {React.FormEvent} e - The form submission event
   */
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    // Implementation would go here
  };

  /**
   * Manually saves the current project state
   * Handles various edge cases:
   * - Project not in context
   * - Project needs to be loaded first
   * - Project state synchronization
   * 
   * Includes delays to ensure state updates are processed
   */
  const handleManualSave = () => {
    if (!saveCurrentProject) {
      console.error('Save function not available');
      return;
    }
    
    // Ensure the project is set as current before saving
    if (!currentProject && effectiveProject && setCurrentProject) {
      console.log('Project not in context before save, setting as current project');
      
      // First check if we need to load the project from localStorage
      if (loadProject && projectId) {
        console.log(`Loading project ${projectId} before saving`);
        setLocalLoading(true);
        
        loadProject(projectId)
          .then(() => {
            console.log(`Successfully loaded project ${projectId} for saving`);
            setTimeout(() => {
              saveCurrentProject();
              setLocalLoading(false);
            }, 100);
          })
          .catch((err) => {
            console.error(`Failed to load project ${projectId} for saving:`, err);
            setError(`Failed to load project for saving: ${err instanceof Error ? err.message : 'Unknown error'}`);
            setLocalLoading(false);
          });
        return;
      }
      
      // If we have the project in local state but not in context, set it directly
      setCurrentProject(effectiveProject.id);
      
      // Wait briefly to let the state update
      setTimeout(() => {
        saveCurrentProject();
      }, 100);
      return;
    }
    
    saveCurrentProject();
  };

  /**
   * Handles video processing with customization options.
   * Initiates the video generation process with user-defined settings.
   * 
   * @returns {Promise<void>}
   */
  const handleProcessVideo = async () => {
    if (!effectiveProject) return;

    try {
      await processVideoWithCustomization(effectiveProject.id);
    } catch (error) {
      console.error('Error processing video:', error);
      setError('Failed to process video');
    }
  };

  /**
   * Handles quick video processing without customization.
   * Initiates a faster video generation process with default settings.
   * 
   * @returns {Promise<void>}
   */
  const handleFastVideo = async () => {
    if (!effectiveProject) return;

    try {
      await processVideoFast(effectiveProject.id);
    } catch (error) {
      console.error('Error processing video:', error);
      setError('Failed to process video');
    }
  };

  /**
   * Removes a scene from the project with proper state synchronization
   * Includes error handling and project state validation
   * Uses a callback to prevent unnecessary re-renders
   * 
   * @param {string} sceneId - The ID of the scene to remove
   */
  const handleRemoveScene = useCallback((sceneId: string) => {
    if (!removeScene) {
      console.error('Cannot remove scene: removeScene function is not available');
      setError('Cannot remove scene: app not initialized properly');
      return;
    }

    if (!effectiveProject) {
      console.error('Cannot remove scene: no active project');
      setError('Cannot remove scene: no active project');
      return;
    }

    // Ensure we have the current project set correctly
    if (setCurrentProject && (!currentProject || currentProject.id !== effectiveProject.id)) {
      console.log(`Synchronizing project state before removal: ${effectiveProject.id}`);
      setCurrentProject(effectiveProject.id);
      
      // Add a small delay to ensure state updates before scene removal
      setTimeout(() => {
        removeScene(sceneId);
      }, 100);
      return;
    }
    
    // If project is already synchronized, execute removal
    removeScene(sceneId);
  }, [removeScene, effectiveProject, currentProject, setCurrentProject, setError]);

  /**
   * Handles transitioning to voice generation mode
   * Changes the UI mode to enable voiceover features
   * 
   * @returns {void}
   */
  const handleStartVoiceovers = () => {
    setMode('voice-enabled');
  };

  // Add logging for project state
  console.log('[ProjectWorkspace] Current project state:', {
    aspectRatio: effectiveProject?.aspectRatio,
    showLetterboxing: effectiveProject?.showLetterboxing,
    hasSetProjectAspectRatio: !!setProjectAspectRatio,
    hasToggleLetterboxing: !!toggleLetterboxing
  });

  const handleAspectRatioChange = async (ratio: AspectRatioOption) => {
    console.log('[ProjectWorkspace] Aspect ratio change requested:', {
      newRatio: ratio,
      currentRatio: effectiveProject?.aspectRatio,
      setProjectAspectRatioExists: !!setProjectAspectRatio
    });

    if (setProjectAspectRatio) {
      await setProjectAspectRatio(ratio);
      console.log('[ProjectWorkspace] Aspect ratio updated:', ratio);
      await handleManualSave();
      console.log('[ProjectWorkspace] Project saved after aspect ratio change');
    } else {
      console.warn('[ProjectWorkspace] setProjectAspectRatio function not available');
    }
  };

  const handleToggleLetterboxing = async (show: boolean) => {
    console.log('[ProjectWorkspace] Toggle letterboxing requested:', {
      currentState: effectiveProject?.showLetterboxing,
      newState: show,
      toggleFunctionExists: !!toggleLetterboxing
    });

    if (toggleLetterboxing) {
      await toggleLetterboxing(show);
      console.log('[ProjectWorkspace] Letterboxing toggled to:', show);
      await handleManualSave();
      console.log('[ProjectWorkspace] Project saved after letterboxing toggle');
    } else {
      console.warn('[ProjectWorkspace] toggleLetterboxing function not available');
    }
  };

  if (isContextLoading) {
    return (
      <div className="flex justify-center items-center py-12 bg-white">
        <LoaderIcon className="h-8 w-8 text-blue-500 animate-spin" />
        <span className="ml-2 text-lg text-gray-600">Loading project...</span>
      </div>
    );
  }

  if (!effectiveProject) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No project data available.</p>
      </div>
    );
  }

  // Use the original UI rendering for the workspace when we have a project
  return (
    <div className="bg-white" data-testid="project-workspace">
      <div className="bg-white p-6 rounded-lg shadow">
        <div>
          {/* Project Header Section Removed - Now in layout/Header.tsx */}
          {/* Apply max-width and centering to Add URL form section */}
          <div className="max-w-3xl mx-auto">
            <div className="mb-8 bg-white p-6 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Add Content</h2>

              <div className="mb-4">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                    placeholder="Enter Reddit URL"
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isAddingScene}
                    data-testid="url-input"
                  />
                  <button
                    onClick={() => handleUrlSubmit()}
                    className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    disabled={isAddingScene || !url.trim()}
                    data-testid="add-content-button"
                  >
                    {isAddingScene ? <LoaderIcon className="h-5 w-5 animate-spin" /> : 'Add'}
                  </button>
                </div>
              </div>

              {addSceneError && (
                <div className="text-red-500 text-sm mt-2 mb-4">Error: {addSceneError}</div>
              )}

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={fillExampleUrl}
                  className="text-blue-600 text-sm underline"
                  data-testid="fill-example-button"
                >
                  Fill with example URL
                </button>
              </div>
            </div>
          </div>

          {/* Scenes list - Should now be full width within the outer padding */}
          {effectiveProject.scenes.length > 0 && (
            <div className="mb-8" data-testid="scenes-container">
              <h2 className="text-xl font-semibold mb-4 max-w-3xl mx-auto">Scenes</h2>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="scenes" direction="horizontal">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4"
                    >
                      {effectiveProject.scenes.map((scene, i) => (
                        <Draggable key={scene.id} draggableId={scene.id} index={i}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className="h-full"
                            >
                              <SceneComponent
                                scene={scene}
                                preview={scene.url || null}
                                index={i}
                                onSceneRemove={handleRemoveScene}
                                _onSceneMove={(id: string, newIndex: number) => console.log(`Move scene ${id} to position ${newIndex}`)}
                                onSceneReorder={(id: string, newIndex: number) => console.log(`Reorder scene ${id} to position ${newIndex}`)}
                                isDragging={snapshot.isDragging}
                                dragHandleProps={provided.dragHandleProps || undefined}
                                projectAspectRatio={(effectiveProject as any)?.aspectRatio || '9:16'}
                                showLetterboxing={(effectiveProject as any)?.showLetterboxing || true}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          )}

          {/* Action Buttons Section - Apply max-width and centering */}
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-2 mt-4 gap-4">
              {/* Process Video / Fast Video Buttons */}
              <button
                onClick={handleProcessVideo}
                className="px-3 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition flex items-center justify-center"
                disabled={isAddingScene || isSaving}
                data-testid="process-video-button"
              >
                Process Video
              </button>

              {/* Fast Video button always visible */}
              <button
                onClick={handleFastVideo}
                className="px-3 py-2 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition flex items-center justify-center"
                disabled={isAddingScene || isSaving}
                data-testid="fast-video-button"
              >
                <ZapIcon className="h-5 w-5 mr-2" />
                Fast Video
              </button>

              <p className="text-sm text-gray-600 mt-1 col-span-2">
                <strong>Process Video:</strong> Customize each scene before processing
              </p>
            </div>

            {/* Debug information */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Debug Info</h3>
                <div className="text-xs text-gray-500">
                  Last action: {debugInfo?.lastAction || 'Component mounted'}
                  <br />
                  Timestamp: {new Date().toLocaleTimeString()}
                </div>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify(
                    {
                      hasCurrentProject: !!currentProject,
                      hasLocalProject: !!localProject,
                      effectiveProjectId: effectiveProject?.id,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
