/**
 * videocontext-editor-demo.tsx
 * 
 * Part of the VideoContext integration (Phase 2)
 * 
 * Demo page to showcase the VideoContext integration through the VideoContextEditor component.
 * This is separate from the original video preview implementations.
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { VideoContextProvider } from '../contexts/VideoContextProvider';

// Use dynamic import with ssr: false to only load on client side
const VideoContextEditor = dynamic(
  () => import('../components/video/VideoContextEditor'),
  { ssr: false }
);

// Define Scene type to match VideoContextEditor component
interface Scene {
  id: string;
  media: {
    type: string;
    url: string;
  };
  content: {
    text?: string;
  };
  duration?: number;
}

// Sample scene data
const sampleScenes: Scene[] = [
  {
    id: 'scene1',
    media: {
      type: 'image',
      url: '/api/content/proxy/media?url=https://picsum.photos/id/237/1080/1920',
    },
    content: {
      text: 'This is the first scene with a sample image.',
    },
    duration: 5,
  },
  {
    id: 'scene2',
    media: {
      type: 'video',
      url: '/api/content/proxy/media?url=https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    },
    content: {
      text: 'This is the second scene with a sample video.',
    },
    duration: 8,
  },
  {
    id: 'scene3',
    media: {
      type: 'image',
      url: '/api/content/proxy/media?url=https://picsum.photos/id/1015/1080/1920',
    },
    content: {
      text: 'This is the third scene with another sample image.',
    },
    duration: 4,
  },
];

const VideoContextEditorDemo: React.FC = () => {
  const router = useRouter();
  const [scenes, setScenes] = useState<Scene[]>(sampleScenes);
  const [isClient, setIsClient] = useState(false);
  const [redditUrl, setRedditUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Check if we're on client side
  React.useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Handle Reddit URL import
  const handleImportReddit = async () => {
    if (!redditUrl) return;
    
    setIsLoading(true);
    try {
      // First, extract the Reddit content
      const extractResponse = await fetch('/api/content/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: redditUrl }),
      });
      
      if (!extractResponse.ok) {
        throw new Error('Failed to extract Reddit content');
      }
      
      const extractData = await extractResponse.json();
      
      if (!extractData.success || !extractData.data) {
        throw new Error(extractData.message || 'Failed to extract content');
      }
      
      const { data } = extractData;
      
      if (!data.media_url) {
        throw new Error('No media found in the Reddit post');
      }
      
      // Create a new scene with the proxied media URL
      const newScene: Scene = {
        id: `scene${scenes.length + 1}`,
        media: {
          type: data.media_type || 'video',
          url: `/api/content/proxy/media?url=${encodeURIComponent(data.media_url)}`,
        },
        content: {
          text: data.title || '',
        },
        duration: 5,
      };
      
      setScenes((prev) => [...prev, newScene]);
      setRedditUrl('');
    } catch (error) {
      console.error('Error importing Reddit content:', error);
      alert('Failed to import Reddit content. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle scene order change
  const handleSceneOrderChange = (updatedScenes: Scene[]) => {
    setScenes(updatedScenes);
  };
  
  // Handle scene duration change
  const handleSceneDurationChange = (sceneId: string, duration: number) => {
    setScenes((prev) => 
      prev.map((scene) => 
        scene.id === sceneId ? { ...scene, duration } : scene
      )
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">VideoContext Editor Demo</h1>
      
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md mr-4"
        >
          Back
        </button>
        
        <div className="mt-4 flex gap-4 items-center">
          <input
            type="text"
            value={redditUrl}
            onChange={(e) => setRedditUrl(e.target.value)}
            placeholder="Enter Reddit URL..."
            className="flex-1 p-2 border rounded-md"
          />
          <button
            onClick={handleImportReddit}
            disabled={isLoading || !redditUrl}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import Reddit URL'}
          </button>
        </div>
        
        <p className="text-gray-600 mt-4">
          This is a demonstration of the VideoContext integration (Phase 2), showing how scenes can be combined
          and edited on a timeline. You can import content from Reddit URLs or use the sample scenes below.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {isClient ? (
          <VideoContextProvider>
            <VideoContextEditor 
              scenes={scenes}
              onSceneOrderChange={handleSceneOrderChange}
              onSceneDurationChange={handleSceneDurationChange}
            />
          </VideoContextProvider>
        ) : (
          <div className="flex items-center justify-center p-10 bg-gray-100 rounded">
            <p className="text-gray-500">Loading editor...</p>
          </div>
        )}
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded-md">
        <h2 className="text-lg font-semibold mb-2">Current Scene Data</h2>
        <pre className="bg-gray-800 text-white p-4 rounded-md overflow-x-auto">
          {JSON.stringify(scenes, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default VideoContextEditorDemo; 