'use client';

/**
 * COMPLEX VIDEO CREATION FLOW
 * 
 * This is the advanced video creation page that offers a full project workspace with:
 * 1. Multiple scenes from different Reddit URLs
 * 2. Drag-and-drop scene reordering
 * 3. Text editing for each scene
 * 4. Full project management
 * 
 * Route: /projects/create
 * 
 * Note: This is different from the SIMPLE flow at /create
 * which offers a basic single URL form for quick video creation.
 */

import { useEffect, useState, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProjectProvider } from '@/components/project/ProjectProvider';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';
import { projectExists } from '@/lib/storage-utils';

export default function ComplexProjectWorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNameInput, setShowNameInput] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [submittedName, setSubmittedName] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if we have a project ID in the query params
    const id = searchParams.get('id');
    if (id) {
      // Verify the project exists
      if (projectExists(id)) {
        setProjectId(id);
      } else {
        console.error('Project not found:', id);
        // If the project doesn't exist, redirect to the create page without ID
        router.replace('/projects/create');
      }
    } else {
      // If no project ID is provided, we should show the name input form
      setShowNameInput(true);
    }
    setIsLoading(false);
  }, [searchParams, router]);

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    
    // Store the submitted name and hide the form
    setSubmittedName(projectName);
    setShowNameInput(false);
    
    console.log(`Project name submitted: ${projectName}`);
  };

  // Show loading spinner while checking project existence
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
      </div>
    );
  }

  // Show project name input form if needed
  if (showNameInput) {
    return (
      <div className="container mx-auto py-8 max-w-md">
        <div className="bg-white shadow-md rounded-lg p-6 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">Create New Video Project</h1>
          
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter project name"
                required
                autoFocus
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition duration-200"
            >
              Create Project
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <ProjectProvider>
        <ProjectWorkspace 
          projectId={projectId || undefined} 
          initialProjectName={submittedName || undefined}
        />
      </ProjectProvider>
    </div>
  );
} 