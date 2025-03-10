'use client';

import React from 'react';
import Link from 'next/link';
import { ProjectProvider, useProject } from '@/components/project/ProjectProvider';
import { PlusCircle as PlusCircleIcon, Layers as LayersIcon } from 'lucide-react';

function ProjectsList() {
  const { projects, loadProjects } = useProject();
  
  // Load projects on mount
  React.useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <Link 
          href="/projects/create" 
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          New Project
        </Link>
      </div>
      
      {projects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <LayersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No projects yet</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            Create your first project to start organizing content for your videos.
          </p>
          <Link 
            href="/projects/create" 
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Create Your First Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map(project => (
            <Link 
              key={project.id} 
              href={`/projects/${project.id}`}
              className="block border border-gray-200 rounded-lg hover:shadow-md transition-shadow p-6 bg-white"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">{project.title}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  project.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                  project.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  project.status === 'completed' ? 'bg-green-100 text-green-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-4">
                Created: {new Date(project.createdAt).toLocaleDateString()}
              </p>
              <div className="flex items-center text-gray-600">
                <span className="mr-4">{project.scenes.length} scenes</span>
                <span>Last updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <ProjectProvider>
      <ProjectsList />
    </ProjectProvider>
  );
} 