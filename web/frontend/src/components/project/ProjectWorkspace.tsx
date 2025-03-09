'use client';

import React, { useState } from 'react';
import { useProject } from './ProjectProvider';
import SceneComponent from './SceneComponent';
import { PlusCircle as PlusCircleIcon } from 'lucide-react';

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
    error 
  } = useProject();
  
  const [newUrl, setNewUrl] = useState('');
  const [isCreating, setIsCreating] = useState(!projectId);
  const [title, setTitle] = useState('');
  
  // Handle project creation
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    
    createProject(title.trim());
    setIsCreating(false);
  };
  
  // Handle adding a new scene
  const handleAddScene = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;
    
    addScene(newUrl.trim());
    setNewUrl('');
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
          >
            Create Project
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
        >
          Create a New Project
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
        <form onSubmit={handleAddScene} className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Paste a Reddit URL here"
            className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            <PlusCircleIcon className="h-5 w-5 mr-1" />
            Add Scene
          </button>
        </form>
      </div>
      
      {/* Scenes list */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Scenes</h2>
        
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
          disabled={currentProject.scenes.length === 0}
        >
          Generate Video
        </button>
      </div>
    </div>
  );
} 