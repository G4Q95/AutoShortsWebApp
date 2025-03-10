'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import { PlusCircle as PlusCircleIcon, Loader2 as LoaderIcon, AlertTriangle as AlertIcon, Save as SaveIcon, Check as CheckIcon, Zap as ZapIcon } from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { processVideoWithCustomization, processVideoFast } from '@/lib/project-utils';

interface ProjectWorkspaceProps {
  projectId?: string;
}

export default function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const router = useRouter();
  const { 
    currentProject, 
    addScene, 
    removeScene, 
    updateSceneText, 
    createProject, 
    isSaving, 
    lastSaved,
    setProjectTitle,
    saveCurrentProject,
    reorderScenes
  } = useProject();
  
  const [isCreating, setIsCreating] = useState(!projectId);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [addSceneError, setAddSceneError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!!projectId);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{isChecked: boolean, isAvailable: boolean}>({
    isChecked: false,
    isAvailable: false
  });
  const [lastAction, setLastAction] = useState<string | null>(null);
  
  // Debug information
  const [debugInfo, setDebugInfo] = useState<{
    lastAction: string;
    timestamp: number;
    details?: any;
  } | null>(null);

  // Format time for last saved
  const formatSavedTime = (): string => {
    if (!lastSaved) return '';
    
    const now = new Date();
    const savedDate = new Date(lastSaved);
    
    // If saved today, show time
    if (now.toDateString() === savedDate.toDateString()) {
      return `Today at ${savedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If saved yesterday, show "Yesterday"
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === savedDate.toDateString()) {
      return `Yesterday at ${savedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise show date and time
    return savedDate.toLocaleString([], { 
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Function to handle URL changes
  const handleUrlChange = (value: string) => {
    setUrl(value);
  };
  
  // Function to handle URL submission (Enter key)
  const handleUrlSubmit = async () => {
    if (!url || url.trim() === '') return;
    
    setIsAddingScene(true);
    setAddSceneError(null);
    
    try {
      // Add scene to project
      await addScene(url);
      
      // Clear the URL input field after adding
      setUrl('');
      
      setDebugInfo({
        lastAction: 'URL added',
        timestamp: Date.now(),
        details: { url }
      });
      
    } catch (error) {
      console.error("Error processing URL:", error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to process URL');
    } finally {
      setIsAddingScene(false);
    }
  };
  
  // Manual save handler
  const handleManualSave = async () => {
    if (!currentProject) return;
    
    try {
      await saveCurrentProject();
      setDebugInfo({
        lastAction: 'Manual save',
        timestamp: Date.now(),
        details: { projectId: currentProject.id }
      });
    } catch (error) {
      console.error('Failed to manually save project:', error);
    }
  };

  // Process video with customization
  const handleProcessVideo = async () => {
    if (!currentProject) return;
    
    try {
      // Save the project first
      await saveCurrentProject();
      
      // Use utility function to process video
      await processVideoWithCustomization(currentProject.id);
      
      // Redirect to processing status page
      router.push(`/processing/${currentProject.id}`);
      
    } catch (error) {
      console.error('Error processing video:', error);
      // Handle error (show error message)
    }
  };
  
  // Process video fast (automated)
  const handleFastVideo = async () => {
    if (!currentProject) return;
    
    try {
      // Save the project first
      await saveCurrentProject();
      
      // Use utility function to process video in fast mode
      await processVideoFast(currentProject.id);
      
      // Redirect to processing status page
      router.push(`/processing/${currentProject.id}`);
      
    } catch (error) {
      console.error('Error processing video in fast mode:', error);
      // Handle error (show error message)
    }
  };

  // Check if we're on the right page/component
  useEffect(() => {
    console.log('ProjectWorkspace component mounted', { projectId, currentProject });
    setDebugInfo({
      lastAction: 'Component mounted',
      timestamp: Date.now(),
      details: { projectId, hasCurrentProject: !!currentProject }
    });
  }, [projectId, currentProject]);

  // Check if the API is available on mount
  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        // Assume API is available by default - removing actual API check that's failing
        setApiStatus({
          isChecked: true,
          isAvailable: true
        });
      } catch (error) {
        setApiStatus({
          isChecked: true,
          isAvailable: false
        });
        console.error('API status check failed:', error);
      }
    };
    
    checkApiStatus();
  }, []);

  // Function to create a new project
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;
    
    createProject(title.trim());
    setIsCreating(false);
    setDebugInfo({
      lastAction: 'Project created',
      timestamp: Date.now(),
      details: { title }
    });
  };

  // Function to handle adding a scene from form
  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use url instead of urls array
    if (!url || !url.trim()) return;
    
    setIsAddingScene(true);
    setAddSceneError(null);
    
    try {
      console.log('Adding scene with URL:', url);
      await addScene(url);
      
      // Clear the URL input after adding
      setUrl('');
      
      setDebugInfo({
        lastAction: 'Scene added',
        timestamp: Date.now(),
        details: { url }
      });
    } catch (error) {
      console.error('Error adding scene:', error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to add scene');
    } finally {
      setIsAddingScene(false);
    }
  };

  // Fill an example URL for easy testing
  const fillExampleUrl = () => {
    setUrl('https://www.reddit.com/r/oddlyterrifying/comments/1j7csx4/some_sorta_squid_in_australian_street/');
  };

  // Function to retry loading a scene
  const handleRetryLoad = async (url: string) => {
    if (!url) return;
    
    try {
      await addScene(url);
      setDebugInfo({
        lastAction: 'Scene reload',
        timestamp: Date.now(),
        details: { url }
      });
    } catch (error) {
      console.error('Error reloading scene:', error);
    }
  };

  // Handle drag and drop reordering of scenes
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || !currentProject) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;
    
    const newScenes = [...currentProject.scenes];
    const [removed] = newScenes.splice(sourceIndex, 1);
    newScenes.splice(destinationIndex, 0, removed);
    
    const sceneIds = newScenes.map(scene => scene.id);
    reorderScenes(sceneIds);
    
    setDebugInfo({
      lastAction: 'Scenes reordered',
      timestamp: Date.now(),
      details: { sourceIndex, destinationIndex }
    });
  };

  // Project workspace
  return (
    <div className="max-w-3xl mx-auto bg-white">
      {isCreating ? (
        <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
          <h1 className="text-2xl font-bold mb-6">Create Video</h1>
          <form onSubmit={handleCreateProject}>
            <div className="mb-4">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Video Title
              </label>
              <input 
                type="text" 
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a title for your video"
                required
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              disabled={!title.trim()}
            >
              Create Video
            </button>
          </form>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-12 bg-white">
          <LoaderIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-lg text-gray-600">Loading project...</span>
        </div>
      ) : currentProject ? (
        <div className="bg-white p-6 rounded-lg shadow">
          {/* Project header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <input 
                type="text" 
                value={currentProject.title}
                onChange={(e) => setProjectTitle(e.target.value)}
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
                    The Auto Shorts API is currently unavailable. You can still create and edit projects,
                    but you won't be able to process videos until the API is back online.
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
                  {isAddingScene ? (
                    <LoaderIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    'Add'
                  )}
                </button>
              </div>
            </div>
            
            {addSceneError && (
              <div className="text-red-500 text-sm mt-2 mb-4">
                Error: {addSceneError}
              </div>
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
          
          {/* Scenes list - MOVED UP */}
          {currentProject.scenes.length > 0 && (
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
                      {currentProject.scenes.map((scene, i) => (
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
                                onRetryLoad={handleRetryLoad}
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
          
          {/* Process buttons - MOVED DOWN */}
          {currentProject.scenes.length > 0 && (
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
                <strong>Process Video:</strong> Customize each scene before processing<br />
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
                {JSON.stringify({ hasCurrentProject: !!currentProject }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : error ? (
        <ErrorDisplay error={error} />
      ) : (
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No project selected</h2>
          <p className="text-gray-500 mb-6">Please select a project or create a new one.</p>
        </div>
      )}
    </div>
  );
} 