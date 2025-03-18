/**
 * Preview Test Page - Demonstrates the ScenePreviewPlayer and TrimControls
 */

import React, { useState } from 'react';
import Head from 'next/head';
import ScenePreviewPlayer from '@/components/preview/ScenePreviewPlayer';
import TrimControls from '@/components/preview/TrimControls';

// Mock data for testing
const TEST_MEDIA = [
  {
    id: 'scene1',
    mediaUrl: 'https://i.imgur.com/JRCgQpg.jpg',
    audioUrl: 'https://assets.coderrocketfuel.com/pomodoro-times-up.mp3',
    mediaType: 'image',
    title: 'Test Image with Audio'
  },
  {
    id: 'scene2',
    mediaUrl: 'https://media.giphy.com/media/eCwAEs05phtK/giphy.mp4',
    audioUrl: 'https://assets.coderrocketfuel.com/pomodoro-times-up.mp3',
    mediaType: 'video',
    title: 'Test Video with Audio'
  }
];

const PreviewTestPage = () => {
  // State
  const [selectedMedia, setSelectedMedia] = useState(TEST_MEDIA[0]);
  const [trim, setTrim] = useState({ start: 0, end: 10 });
  
  // Handle trim change
  const handleTrimChange = (start: number, end: number) => {
    setTrim({ start, end });
    console.log(`Trim updated: ${start} - ${end}`);
  };
  
  return (
    <div className="bg-gray-100 min-h-screen">
      <Head>
        <title>Media Preview Testing</title>
      </Head>
      
      <main className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-8 text-center">Media Preview Test</h1>
        
        {/* Media selector */}
        <div className="mb-8 flex justify-center gap-4">
          {TEST_MEDIA.map((media) => (
            <button
              key={media.id}
              onClick={() => setSelectedMedia(media)}
              className={`px-4 py-2 rounded ${
                selectedMedia.id === media.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-300 text-gray-800'
              }`}
            >
              {media.title}
            </button>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Preview player */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold mb-4">Scene Preview Player</h2>
            <ScenePreviewPlayer
              projectId="test-project"
              sceneId={selectedMedia.id}
              mediaUrl={selectedMedia.mediaUrl}
              audioUrl={selectedMedia.audioUrl}
              mediaType={selectedMedia.mediaType as any}
              trim={trim}
              onTrimChange={handleTrimChange}
              className="shadow-lg"
            />
          </div>
          
          {/* Trim controls */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Trim Controls</h2>
            <TrimControls
              duration={20} // Fixed duration for demo
              trimStart={trim.start}
              trimEnd={trim.end}
              onChange={handleTrimChange}
              className="shadow-lg"
            />
            
            <div className="mt-8 bg-white p-4 rounded shadow-lg">
              <h3 className="text-lg font-medium mb-2">Current Settings</h3>
              <p><strong>Media Type:</strong> {selectedMedia.mediaType}</p>
              <p><strong>Trim Start:</strong> {trim.start.toFixed(1)}s</p>
              <p><strong>Trim End:</strong> {trim.end.toFixed(1)}s</p>
              <p><strong>Duration:</strong> {(trim.end - trim.start).toFixed(1)}s</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PreviewTestPage; 