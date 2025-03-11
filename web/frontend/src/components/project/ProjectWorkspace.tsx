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

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useProject, Scene, Project } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import {
  PlusCircle as PlusCircleIcon,
  Loader2 as LoaderIcon,
  AlertTriangle as AlertIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Zap as ZapIcon,
} from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { processVideoWithCustomization, processVideoFast } from '@/lib/project-utils';
import { getProject } from '@/lib/storage-utils';

interface ProjectWorkspaceProps {
  projectId?: string;
  preloadedProject?: Project;
  initialProjectName?: string;
}

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
  const [debugInfo, setDebugInfo] = useState<{ lastAction?: string }>({});

  // Local state to track if we're already loaded from the preloaded project
  const loadAttemptedRef = useRef(false);
  const mountCountRef = useRef(0);
  const instanceIdRef = useRef(`workspace-${Math.random().toString(36).substring(2, 7)}`);
  const newProjectCreatedRef = useRef(false);

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

    // If we have a preloaded project, use it and don't trigger context loading
    if (preloadedProject) {
      console.log(`[${instanceIdRef.current}] Using preloaded project:`, preloadedProject.id);
      setLocalProject(preloadedProject);
      setLocalLoading(false);
      return;
    }

    // If we have a project ID, attempt to load it
    if (projectId && !loadAttemptedRef.current && !currentProject) {
      loadAttemptedRef.current = true;
      console.log(`[${instanceIdRef.current}] Loading project via context:`, projectId);
      setCurrentProject(projectId);
      return;
    }

    // If we don't have a project ID or preloaded project, create a new one
    if (!projectId && !preloadedProject && !currentProject && !newProjectCreatedRef.current) {
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
    initialProjectName,
  ]);

  // Use either preloaded project, local state, or context project
  const effectiveProject = localProject || currentProject;

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

  // Original ProjectWorkspace code for URL handling
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    setAddSceneError(null);
  };

  const handleUrlSubmit = async () => {
    if (!url.trim() || !addScene) return;

    setIsAddingScene(true);
    setAddSceneError(null);
    setDebugInfo({ lastAction: `Adding scene URL: ${url.trim()}` });

    try {
      await addScene(url.trim());
      setUrl('');
      // Explicitly mark this action in debug info
      setDebugInfo({ lastAction: `Successfully added scene with URL: ${url.trim()}` });
    } catch (error) {
      console.error('Error adding scene:', error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to add scene');
      setDebugInfo({ lastAction: `Error adding scene: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsAddingScene(false);
    }
  };

  const fillExampleUrl = () => {
    setUrl(
      'https://www.reddit.com/r/oddlyterrifying/comments/1j7csx4/some_sorta_squid_in_australian_street/'
    );
  };

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

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    // Implementation would go here
  };

  const handleManualSave = () => {
    if (saveCurrentProject) {
      saveCurrentProject();
    }
  };

  const handleProcessVideo = async () => {
    if (!effectiveProject) return;

    try {
      await processVideoWithCustomization(effectiveProject.id);
    } catch (error) {
      console.error('Error processing video:', error);
      setError('Failed to process video');
    }
  };

  const handleFastVideo = async () => {
    if (!effectiveProject) return;

    try {
      await processVideoFast(effectiveProject.id);
    } catch (error) {
      console.error('Error processing video:', error);
      setError('Failed to process video');
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
    <div className="max-w-3xl mx-auto bg-white">
      <div className="bg-white p-6 rounded-lg shadow">
        {/* Project header */}
        <div className="mb-6 flex justify-between items-center">
          <div>
            <input
              type="text"
              value={effectiveProject.title}
              onChange={(e) => setProjectTitle && setProjectTitle(e.target.value)}
              className="text-3xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5 text-gray-800"
              aria-label="Project title"
            />
          </div>
          <div className="flex flex-col items-end">
            <button
              onClick={handleManualSave}
              className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              disabled={isSaving}
            >
              <SaveIcon className="h-4 w-4 mr-1" />
              Save
            </button>
            {lastSaved && (
              <div className="text-xs text-gray-500 mt-1 flex items-center">
                {isSaving ? (
                  <>
                    <LoaderIcon className="inline-block h-3 w-3 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="inline-block h-3 w-3 mr-1 text-green-500" />
                    Last saved: {formatSavedTime()}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* API status warning */}
        {apiStatus.isChecked && !apiStatus.isAvailable && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <AlertIcon className="h-5 w-5 text-yellow-400 mr-2 flex-shrink-0" />
              <div>
                <p className="text-sm text-yellow-700">
                  The Auto Shorts API is currently unavailable. You can still create and edit
                  projects, but you won&apos;t be able to process videos until the API is back
                  online.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add URL form */}
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
              />
              <button
                onClick={() => handleUrlSubmit()}
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                disabled={isAddingScene || !url.trim()}
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
            >
              Fill with example URL
            </button>
          </div>
        </div>

        {/* Scenes list */}
        {effectiveProject.scenes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Scenes</h2>
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="scenes" direction="horizontal">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
                  >
                    {effectiveProject.scenes.map((scene, i) => (
                      <Draggable key={scene.id} draggableId={scene.id} index={i}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="h-full"
                          >
                            <SceneComponent
                              scene={scene}
                              index={i}
                              onRemove={removeScene}
                              onTextChange={updateSceneText}
                              onRetryLoad={(url) => handleRetryLoad(scene.id, url)}
                              isDragging={snapshot.isDragging}
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

        {/* Process buttons */}
        {effectiveProject.scenes.length > 0 && (
          <div className="mb-8 flex flex-col space-y-4">
            <button
              onClick={handleProcessVideo}
              className="px-4 py-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition flex items-center justify-center"
              disabled={isAddingScene || isSaving}
            >
              Process Video
            </button>

            <button
              onClick={handleFastVideo}
              className="px-4 py-3 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition flex items-center justify-center"
              disabled={isAddingScene || isSaving}
            >
              <ZapIcon className="h-5 w-5 mr-2" />
              Fast Video
            </button>

            <p className="text-sm text-gray-600 mt-1">
              <strong>Process Video:</strong> Customize each scene before processing
              <br />
              <strong>Fast Video:</strong> Automatically process with default settings
            </p>
          </div>
        )}

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
  );
}
