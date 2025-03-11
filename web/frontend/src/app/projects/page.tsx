'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PlusCircle as PlusCircleIcon,
  Layers as LayersIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
} from 'lucide-react';
import { Project } from '@/components/project/ProjectProvider';
import {
  getProjectsList,
  deleteProject as deleteProjectUtil,
  clearAllProjects,
} from '@/lib/storage-utils';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load projects only once on component mount
  useEffect(() => {
    async function loadProjects() {
      try {
        setIsLoading(true);
        const projectsMetadata = await getProjectsList();
        setProjects(
          projectsMetadata.map((metadata) => ({
            id: metadata.id,
            title: metadata.title,
            scenes: [],
            createdAt: metadata.createdAt,
            updatedAt: metadata.updatedAt,
            status: 'draft',
          }))
        );
      } catch (err) {
        console.error('Failed to load projects:', err);
        setError('Failed to load projects. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadProjects();
  }, []);

  // Handle project deletion
  const handleDelete = async (e: React.MouseEvent, projectId: string) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation(); // Prevent event bubbling

    if (confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProjectUtil(projectId);
        setProjects(projects.filter((project) => project.id !== projectId));
      } catch (error) {
        console.error('Failed to delete project:', error);
        setError('Failed to delete project. Please try again.');
      }
    }
  };

  // Handle deleting all projects
  const handleDeleteAll = async () => {
    if (confirm('Are you sure you want to delete ALL projects? This cannot be undone.')) {
      try {
        await clearAllProjects();
        setProjects([]);
      } catch (error) {
        console.error('Failed to delete all projects:', error);
        setError('Failed to delete all projects. Please try again.');
      }
    }
  };

  // Handle duplication - for now just show an info message since we need the full project data
  const handleDuplicate = (e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    e.stopPropagation();
    alert('Project duplication feature coming soon!');
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Your Projects</h1>
        <Link
          href="/projects/create"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <PlusCircleIcon className="h-5 w-5 mr-2" />
          Create Video
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <LayersIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No projects yet</h2>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">Create your first video project.</p>
          <Link
            href="/projects/create"
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            <PlusCircleIcon className="h-5 w-5 mr-2" />
            Create Your First Video
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border border-gray-200 rounded-lg hover:shadow-md transition-shadow bg-white overflow-hidden"
              >
                <Link href={`/projects/${project.id}`} className="block p-6">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{project.title}</h3>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        project.status === 'draft'
                          ? 'bg-yellow-100 text-yellow-800'
                          : project.status === 'processing'
                            ? 'bg-blue-100 text-blue-800'
                            : project.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mb-4">
                    Created: {new Date(project.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center text-gray-600">
                    <span>Last updated: {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
                <div className="border-t border-gray-200 p-3 flex justify-end space-x-3 bg-gray-50">
                  <button
                    onClick={(e) => handleDuplicate(e, project.id)}
                    className="text-blue-600 hover:text-blue-800 flex items-center text-sm"
                    aria-label="Duplicate project"
                  >
                    <CopyIcon className="h-4 w-4 mr-1" />
                    Duplicate
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="text-red-600 hover:text-red-800 flex items-center text-sm"
                    aria-label="Delete project"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {projects.length > 1 && (
            <div className="flex justify-center mt-8 mb-4">
              <button
                onClick={handleDeleteAll}
                className="text-red-600 hover:bg-red-50 border border-red-300 rounded-md px-4 py-2 flex items-center text-sm font-medium"
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete All Projects
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
