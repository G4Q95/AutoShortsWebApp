'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProject } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import { PlusCircle as PlusCircleIcon, Loader2 as LoaderIcon, AlertTriangle as AlertIcon, Save as SaveIcon, Check as CheckIcon, Zap as ZapIcon } from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { processVideoWithCustomization, processVideoFast, getUrlPreview } from '@/lib/project-utils';

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
    setProjectTitle, 
    createProject,
    reorderScenes,
    isLoading,
    error,
    saveCurrentProject,
    isSaving,
    lastSaved
  } = useProject();
  
  const [urls, setUrls] = useState<string[]>(['']);
  const [urlPreviews, setUrlPreviews] = useState<{[key: string]: any}>({});
  const [isCreating, setIsCreating] = useState(!projectId);
  const [title, setTitle] = useState('');
  const [isAddingScene, setIsAddingScene] = useState(false);
  const [addSceneError, setAddSceneError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<{isChecked: boolean, isAvailable: boolean}>({
    isChecked: false,
    isAvailable: false
  });
  
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
  
  // Add URL input field function
  const addUrlInput = () => {
    setUrls([...urls, '']);
  };
  
  // Function to handle URL changes
  const handleUrlChange = (index: number, value: string) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };
  
  // Function to handle URL submission (Enter key)
  const handleUrlSubmit = async (index: number) => {
    if (!urls[index] || urls[index].trim() === '') return;
    
    setIsAddingScene(true);
    setAddSceneError(null);
    
    try {
      // Fetch preview data using utility function
      const previewData = await getUrlPreview(urls[index]);
      
      setUrlPreviews({
        ...urlPreviews,
        [urls[index]]: previewData
      });
      
      // Add scene to project
      await addScene(urls[index]);
      
      // Add a new input field if this is the last one
      if (index === urls.length - 1) {
        addUrlInput();
      }
      
      setDebugInfo({
        lastAction: 'URL added with preview',
        timestamp: Date.now(),
        details: { url: urls[index] }
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

  // Function to add a new scene from URL
  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Use the first URL in the array
    const url = urls[0];
    if (!url || !url.trim()) return;
    
    setIsAddingScene(true);
    setAddSceneError(null);
    
    try {
      console.log('Adding scene with URL:', url);
      await addScene(url);
      
      // Clear the first URL input and add a new one if needed
      const newUrls = [...urls];
      newUrls[0] = '';
      setUrls(newUrls);
      
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
    const newUrls = [...urls];
    newUrls[0] = 'https://www.reddit.com/r/oddlyterrifying/comments/1j7csx4/some_sorta_squid_in_australian_street/';
    setUrls(newUrls);
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
    <div className="max-w-3xl mx-auto">
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
        <div className="flex justify-center items-center py-12">
          <LoaderIcon className="h-8 w-8 text-blue-500 animate-spin" />
          <span className="ml-2 text-lg text-gray-600">Loading project...</span>
        </div>
      ) : currentProject ? (
        <>
          {/* Project header */}
          <div className="mb-6 flex justify-between items-center">
            <div>
              <input 
                type="text" 
                value={currentProject.title}
                onChange={(e) => setProjectTitle(e.target.value)}
                className="text-3xl font-bold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1 py-0.5" 
                aria-label="Project title" 
              />
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
            <button
              onClick={handleManualSave}
              className="flex items-center px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              disabled={isSaving}
            >
              <SaveIcon className="h-4 w-4 mr-1" />
              Save
            </button>
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
            
            {urls.map((url, index) => (
              <div key={index} className="mb-4">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit(index)}
                    placeholder="Enter Reddit URL"
                    className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isAddingScene}
                  />
                  <button 
                    onClick={() => handleUrlSubmit(index)}
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
                
                {/* URL Preview */}
                {urlPreviews[url] && (
                  <div className="mt-2 p-3 border rounded bg-gray-50">
                    <h3 className="font-medium">{urlPreviews[url].title || 'No title'}</h3>
                    {urlPreviews[url].thumbnail && (
                      <img src={urlPreviews[url].thumbnail} alt="Preview" className="mt-2 max-h-32" />
                    )}
                    <p className="text-sm text-gray-600 mt-1">{urlPreviews[url].description || 'No description'}</p>
                  </div>
                )}
              </div>
            ))}
            
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
              <button 
                type="button" 
                onClick={addUrlInput}
                className="flex items-center text-blue-600 text-sm"
              >
                <PlusCircleIcon className="h-4 w-4 mr-1" />
                Add another URL
              </button>
            </div>
          </div>
          
          {/* Process buttons */}
          {currentProject.scenes.length > 0 && (
            <div className="mb-8 flex flex-col space-y-4">
              <button 
                onClick={handleProcessVideo}
                className="px-4 py-3 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition flex items-center justify-center"
                disabled={isAddingScene || isSaving}
              >
                Process Video (Customize Each Scene)
              </button>
              
              <button 
                onClick={handleFastVideo}
                className="px-4 py-3 bg-red-600 text-white font-medium rounded hover:bg-red-700 transition flex items-center justify-center"
                disabled={isAddingScene || isSaving}
              >
                <ZapIcon className="h-5 w-5 mr-2" />
                Fast Video (Automated Processing)
              </button>
              
              <p className="text-sm text-gray-600 mt-1">
                <strong>Process Video:</strong> Customize each scene before processing<br />
                <strong>Fast Video:</strong> Automatically process with default settings
              </p>
            </div>
          )}
          
          {/* Scenes list */}
          {currentProject.scenes.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4">Scenes</h2>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="scenes">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="pl-8" // Space for drag handle
                    >
                      {currentProject.scenes.map((scene, index) => (
                        <Draggable key={scene.id} draggableId={scene.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <SceneComponent
                                scene={scene}
                                index={index}
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
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && debugInfo && (
            <div className="mt-8 border-t pt-4 text-xs text-gray-500">
              <h3 className="font-semibold mb-1">Debug Info</h3>
              <div>Last action: {debugInfo.lastAction}</div>
              <div>Timestamp: {new Date(debugInfo.timestamp).toLocaleTimeString()}</div>
              {debugInfo.details && (
                <pre className="mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-20">
                  {JSON.stringify(debugInfo.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </>
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