'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectProvider, useProject } from '@/components/project/ProjectProvider';
import { VideoIcon, Loader2 as LoaderIcon } from 'lucide-react';

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
      // Create a new project with the title
      const projectTitle = title.trim();
      createProject(projectTitle);
      
      // Use setTimeout to ensure state is updated before redirecting
      setTimeout(() => {
        // Just redirect to the projects page
        router.push('/projects');
      }, 100);
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Failed to create video project. Please try again.');
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-lg">
      <div className="text-center mb-8">
        <VideoIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold">Create New Video</h1>
        <p className="text-gray-600 mt-2">
          Start by giving your video a title
        </p>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <form onSubmit={handleCreateVideo}>
        <div className="mb-6">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Video Title
          </label>
          <input 
            type="text" 
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter a title for your video"
            disabled={isCreating}
            required
          />
        </div>
        
        <button 
          type="submit" 
          className="w-full flex justify-center items-center bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isCreating || !title.trim()}
        >
          {isCreating ? (
            <>
              <LoaderIcon className="h-5 w-5 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            'Continue to Add Content'
          )}
        </button>
      </form>
    </div>
  );
}

export default function CreateVideoPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <ProjectProvider>
        <CreateVideoForm />
      </ProjectProvider>
    </div>
  );
} 