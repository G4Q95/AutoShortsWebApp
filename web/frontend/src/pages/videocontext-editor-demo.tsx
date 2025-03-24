/**
 * videocontext-editor-demo.tsx
 * 
 * Part of the VideoContext integration (Phase 2)
 * 
 * Demo page to showcase the VideoContext integration through the VideoContextEditor component.
 * This is separate from the original video preview implementations.
 */

import React, { useState } from 'react';
import { VideoContextProvider } from '../contexts/VideoContextProvider';
import VideoContextEditor from '../components/video/VideoContextEditor';
import { useRouter } from 'next/router';

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
      url: 'https://picsum.photos/id/237/1080/1920', // Sample image
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
      url: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4', // Sample video
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
      url: 'https://picsum.photos/id/1015/1080/1920', // Another sample image
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
        
        <p className="text-gray-600 mt-4">
          This is a demonstration of the VideoContext integration (Phase 2), showing how scenes can be combined
          and edited on a timeline. The sample scenes include both images and videos.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <VideoContextProvider>
          <VideoContextEditor 
            scenes={scenes}
            onSceneOrderChange={handleSceneOrderChange}
            onSceneDurationChange={handleSceneDurationChange}
          />
        </VideoContextProvider>
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