'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import { PlusCircle as PlusCircleIcon, Loader2 as LoaderIcon, AlertTriangle as AlertIcon } from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

interface ProjectWorkspaceProps {
  projectId?: string;
}

export default function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { 
    currentProject, 
    addScene, 
    removeScene, 
    updateSceneText, 
    setProjectTitle, 
    createProject,
    reorderScenes,
    isLoading,
    error 
  } = useProject();
  
  const [newUrl, setNewUrl] = useState('');
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

  // Check if we're on the right page/component
  useEffect(() => {
    console.log('ProjectWorkspace component mounted', { projectId, currentProject });
    setDebugInfo({
      lastAction: 'Component mounted',
      timestamp: Date.now(),
      details: { projectId, hasCurrentProject: !!currentProject }
    });
  }, [projectId, currentProject]);
  
  // Handle project creation
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    setDebugInfo({
      lastAction: 'Creating project',
      timestamp: Date.now(),
      details: { title }
    });
    
    createProject(title.trim());
    setIsCreating(false);
  };
  
  // Handle adding a new scene
  const handleAddScene = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    
    setIsAddingScene(true);
    setAddSceneError(null);
    
    // Update debug info
    setDebugInfo({
      lastAction: 'Adding scene',
      timestamp: Date.now(),
      details: { url: newUrl.trim() }
    });
    
    try {
      console.log('Adding scene with URL:', newUrl.trim());
      await addScene(newUrl.trim());
      setNewUrl('');
      
      // Update debug info on success
      setDebugInfo(prev => ({
        lastAction: 'Scene added successfully',
        timestamp: Date.now(),
        details: { 
          url: newUrl.trim(),
          previousAction: prev?.lastAction 
        }
      }));
    } catch (error) {
      console.error('Error adding scene:', error);
      setAddSceneError(error instanceof Error ? error.message : 'Failed to add scene');
      
      // Update debug info on error
      setDebugInfo(prev => ({
        lastAction: 'Error adding scene',
        timestamp: Date.now(),
        details: { 
          url: newUrl.trim(),
          error: error instanceof Error ? error.message : 'Unknown error',
          previousAction: prev?.lastAction 
        }
      }));
    } finally {
      setIsAddingScene(false);
    }
  };
  
  // Pre-fill the input with the example URL for testing
  const fillExampleUrl = () => {
    setNewUrl('https://www.reddit.com/r/ARTIST/comments/1j6sswr/what_comes_to_ur_mind_when_seeing_my_art/');
  };
  
  // Handle retrying scene loading
  const handleRetryLoad = async (url: string) => {
    try {
      // Update debug info
      setDebugInfo({
        lastAction: 'Retrying scene load',
        timestamp: Date.now(),
        details: { url }
      });
      
      await addScene(url);
    } catch (error) {
      // Error is handled by the scene component
      console.error('Error retrying scene load:', error);
    }
  };
  
  // Handle drag end event
  const handleDragEnd = (result: DropResult) => {
    const { destination, source } = result;
    
    // Update debug info
    setDebugInfo({
      lastAction: 'Drag operation',
      timestamp: Date.now(),
      details: { source, destination }
    });
    
    // If dropped outside the list or at the same position
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }
    
    // Get the current scene IDs in order
    const sceneIds = currentProject?.scenes.map(scene => scene.id) || [];
    
    // Reorder the list
    const newSceneIds = Array.from(sceneIds);
    const [movedId] = newSceneIds.splice(source.index, 1);
    newSceneIds.splice(destination.index, 0, movedId);
    
    // Call the reorderScenes function from context
    reorderScenes(newSceneIds);
    
    // Update debug info again
    setDebugInfo(prev => ({
      lastAction: 'Scenes reordered',
      timestamp: Date.now(),
      details: { 
        newOrder: newSceneIds,
        previousAction: prev?.lastAction 
      }
    }));
  };
  
  // Project creation form
  if (isCreating) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Create a New Project</h1>
        
        <form onSubmit={handleCreateProject} className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <label htmlFor="projectTitle" className="block text-sm font-medium text-gray-700 mb-1">
              Project Title
            </label>
            <input
              type="text"
              id="projectTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your project"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
                Creating...
              </span>
            ) : 'Create Project'}
          </button>
        </form>
      </div>
    );
  }
  
  // If no current project, display error
  if (!currentProject) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">No Project Selected</h2>
        <p className="text-gray-600 mb-6">
          {error || "Please create a new project or select an existing one."}
        </p>
        <button
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
              Loading...
            </span>
          ) : 'Create a New Project'}
        </button>
      </div>
    );
  }
  
  // Project workspace
  return (
    <div className="max-w-3xl mx-auto">
      {/* Project header */}
      <div className="mb-6">
        <input
          type="text"
          value={currentProject.title}
          onChange={(e) => setProjectTitle(e.target.value)}
          className="text-3xl font-bold border-none focus:outline-none focus:ring-0 p-0 bg-transparent w-full"
          aria-label="Project title"
        />
        <p className="text-gray-500 text-sm mt-1">
          Created: {new Date(currentProject.createdAt).toLocaleDateString()}
        </p>
      </div>
      
      {/* Add new scene form */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Add a new scene</h2>
        
        {addSceneError && (
          <div className="mb-4">
            <ErrorDisplay 
              error={addSceneError} 
              type="extraction" 
              className="mb-4"
            />
          </div>
        )}
        
        <form onSubmit={handleAddScene} className="flex flex-col gap-3">
          <div className="flex gap-2 w-full">
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Paste a Reddit URL here"
              className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              disabled={isAddingScene}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
              disabled={isAddingScene || !newUrl.trim()}
            >
              {isAddingScene ? (
                <LoaderIcon className="h-5 w-5 mr-1 animate-spin" />
              ) : (
                <PlusCircleIcon className="h-5 w-5 mr-1" />
              )}
              Add Scene
            </button>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              {currentProject.scenes.length} scene{currentProject.scenes.length !== 1 ? 's' : ''} in project
            </div>
            <button
              type="button"
              onClick={fillExampleUrl}
              className="text-xs text-blue-600 hover:underline"
            >
              Use Example URL
            </button>
          </div>
        </form>
      </div>
      
      {/* Scenes list container with drag and drop */}
      <div className="flex flex-col space-y-4 mb-8 min-h-[200px]">
        <h2 className="text-xl font-semibold mb-2">Project Scenes</h2>
        
        {currentProject.scenes.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-600 mb-4">
              No scenes added yet. Add your first scene using the form above.
            </p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="scenes" type="grid" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {currentProject.scenes.map((scene, index) => (
                    <Draggable key={scene.id} draggableId={scene.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className="h-full"
                        >
                          <SceneComponent
                            key={scene.id}
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
        )}
      </div>
      
      {/* Process button - disabled if no scenes */}
      <div className="mt-8 mb-16">
        <button
          disabled={currentProject.scenes.length === 0}
          className={`w-full py-3 rounded-md transition-colors ${
            currentProject.scenes.length === 0
              ? 'bg-gray-300 cursor-not-allowed text-gray-500'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Process Video
        </button>
        {currentProject.scenes.length === 0 && (
          <p className="mt-2 text-sm text-center text-gray-500">
            Add at least one scene to process the video
          </p>
        )}
      </div>
      
      {/* Debug information - only in development, can be removed in production */}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <div className="mt-10 p-4 border border-gray-300 rounded bg-gray-50 text-sm text-gray-700">
          <h3 className="font-bold mb-2">Debug Info:</h3>
          <p>Last action: {debugInfo.lastAction}</p>
          <p>Timestamp: {new Date(debugInfo.timestamp).toLocaleTimeString()}</p>
          {debugInfo.details && (
            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
              {JSON.stringify(debugInfo.details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
} 