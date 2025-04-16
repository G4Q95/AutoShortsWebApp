'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectProvider, useProject, Project } from '@/components/project/ProjectProvider';
import { VideoIcon, Loader2 as LoaderIcon } from 'lucide-react';
import { saveProject, getProject } from '@/lib/storage-utils';

function CreateVideoForm() {
  const { createProject } = useProject();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateVideo = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      console.log(`Creating project with title: "${title}"`);

      // Await createProject and get the returned project object
      const newProject = await createProject(title.trim());

      // Check if project creation was successful
      if (!newProject || !newProject.id) {
        throw new Error('Project creation failed - no project returned from createProject');
      }

      const projectId = newProject.id;
      console.log(`Successfully created project: ${projectId}`);

      // Optional: Small delay might still be helpful for context propagation, but less critical now.
      // await new Promise((resolve) => setTimeout(resolve, 100)); 

      console.log(`Redirecting to project workspace: ${projectId}`);

      // Use router.replace instead of push to prevent going back to this page
      router.replace(`/projects/${projectId}`);
      
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error instanceof Error ? error.message : 'Failed to create project');
      setIsCreating(false);
    }
    // Note: No need to set isCreating to false here if navigation succeeds
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6">Create Video</h1>

      <form onSubmit={handleCreateVideo}>
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
            disabled={isCreating}
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex justify-center items-center"
          disabled={!title.trim() || isCreating}
        >
          {isCreating ? (
            <>
              <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <VideoIcon className="w-5 h-5 mr-2" />
              Create Video
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          <p className="text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}

export default function CreateVideoPage() {
  return (
    <ProjectProvider>
      <div className="container mx-auto p-6">
        <CreateVideoForm />
      </div>
    </ProjectProvider>
  );
}
