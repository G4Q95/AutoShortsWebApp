'use client';

import { useState } from 'react';
import { createVideo } from '@/lib/api-client';
import { isValidUrl } from '@/lib/utils';
import Link from 'next/link';
import { VideoIcon, Loader2Icon } from 'lucide-react';

export default function CreateVideoPage() {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Validate inputs
    if (!title) {
      setError('Please enter a title for your video');
      return;
    }
    
    if (!url || !isValidUrl(url)) {
      setError('Please enter a valid URL');
      return;
    }
    
    setError(null);
    setLoading(true);
    
    try {
      const response = await createVideo(url, title);
      
      if (response.error) {
        setError(response.error.detail);
      } else {
        // Set the task ID
        setTaskId(response.data.task_id);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create a New Video</h1>
        <p className="text-gray-600">
          Turn any online content into an engaging short-form video in minutes.
        </p>
      </div>
      
      {taskId ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Video Creation Started!</h2>
          <p className="mb-4 text-gray-600">
            Your video is being processed. You can check its status or view it when it's ready.
          </p>
          <div className="flex justify-center space-x-4">
            <Link 
              href={`/status/${taskId}`} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Check Status
            </Link>
            <Link 
              href="/dashboard" 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Video Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title for your video"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              Content URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/your-content"
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter a URL containing the content you want to convert to a video.
            </p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Create Video'
            )}
          </button>
        </form>
      )}
    </div>
  );
} 