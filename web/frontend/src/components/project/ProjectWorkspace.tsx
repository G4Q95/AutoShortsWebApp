'use client';

import React, { useState, useEffect } from 'react';
import { useProject } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import { PlusCircle as PlusCircleIcon, Loader2 as LoaderIcon, AlertTriangle as AlertIcon } from 'lucide-react';
import ErrorDisplay from '../ErrorDisplay';

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
        
        <form onSubmit={handleAddScene} className="flex gap-2">
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
            {isAddingScene ? 'Adding...' : 'Add Scene'}
          </button>
        </form>
        
        <div className="mt-2 flex justify-end">
          <button 
            onClick={fillExampleUrl}
            className="text-blue-600 text-sm hover:underline"
          >
            Use example URL
          </button>
        </div>
      </div>
      
      {/* Debug Information */}
      {debugInfo && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-yellow-800 flex items-center">
            <AlertIcon className="h-4 w-4 mr-1" />
            Debug Information
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p><strong>Last Action:</strong> {debugInfo.lastAction}</p>
            <p><strong>Timestamp:</strong> {new Date(debugInfo.timestamp).toLocaleTimeString()}</p>
            {debugInfo.details && (
              <div>
                <p><strong>Details:</strong></p>
                <pre className="bg-yellow-100 p-2 rounded mt-1 overflow-auto max-h-40">
                  {JSON.stringify(debugInfo.details, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Scenes list */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Scenes ({currentProject.scenes.length})</h2>
        
        {currentProject.scenes.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
            <p className="text-gray-600 mb-4">
              No scenes added yet. Add your first scene using the form above.
            </p>
          </div>
        ) : (
          <div className="pl-10"> {/* Add padding for the drag handles */}
            {currentProject.scenes.map((scene, index) => (
              <SceneComponent
                key={scene.id}
                scene={scene}
                index={index}
                onRemove={removeScene}
                onTextChange={updateSceneText}
                onRetryLoad={handleRetryLoad}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Project actions */}
      <div className="flex justify-end space-x-3 mb-12">
        <button
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
        >
          Save Draft
        </button>
        <button
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          disabled={currentProject.scenes.length === 0 || currentProject.scenes.some(scene => scene.isLoading || scene.error)}
        >
          Generate Video
        </button>
      </div>
    </div>
  );
} 