'use client';

import React, { useEffect } from 'react';
import { useProject } from '@/components/project/ProjectProvider';
import LoadingState from '@/components/LoadingState';

interface ProjectWorkspaceProps {
  projectId: string;
}

/**
 * ProjectWorkspace component
 * 
 * Main workspace for editing a project, showing scenes and controls
 */
export default function ProjectWorkspace({ projectId }: ProjectWorkspaceProps) {
  const { project, isLoading, error, loadProject } = useProject();

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  // Show loading state
  if (isLoading && !project) {
    return <LoadingState message="Loading project..." />;
  }

  // Show error state
  if (error) {
    return (
      <div className="p-6 bg-red-50 text-red-700 rounded-md">
        <h2 className="text-lg font-bold">Error loading project</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  // Show empty state if no project loaded
  if (!project) {
    return (
      <div className="p-6 bg-gray-50 text-gray-700 rounded-md">
        <h2 className="text-lg font-bold">No project loaded</h2>
        <p>Please select a project to view.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.title}</h1>
        {project.description && (
          <p className="text-gray-600 mt-1">{project.description}</p>
        )}
      </div>

      {/* Scenes list */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Scenes</h2>
        {project.scenes.length === 0 ? (
          <p className="text-gray-500">No scenes added yet. Add your first scene to get started.</p>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {project.scenes.map((scene) => (
              <div key={scene.id} className="border rounded-md p-4 bg-white shadow-sm">
                <h3 className="font-medium">{scene.title}</h3>
                {scene.mediaUrl && (
                  <div className="mt-2 aspect-video bg-gray-100 rounded overflow-hidden">
                    {scene.mediaType === 'image' ? (
                      <img
                        src={scene.mediaUrl}
                        alt={scene.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <p className="text-gray-500">Video preview</p>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{scene.content}</p>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    Duration: {scene.duration}s
                  </span>
                  <button className="text-blue-500 text-sm">Edit</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add scene button */}
      <div className="mt-6">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md">
          Add Scene
        </button>
      </div>
    </div>
  );
} 