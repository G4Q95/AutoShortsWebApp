/**
 * VideoContextEditor.tsx
 * 
 * Part of the VideoContext integration (Phase 2)
 * 
 * Main component that integrates VideoContextPreview and VideoContextTimeline
 * to provide a complete video editing experience using the VideoContext library.
 * This should not be confused with other video editing components in the application.
 */

import React, { useState, useEffect } from 'react';
import VideoContextProvider from '../../contexts/VideoContextProvider';
import VideoContextPreview from './VideoContextPreview';
import VideoContextTimeline from './VideoContextTimeline';

// Interface for the scene data structure
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

interface VideoContextEditorProps {
  scenes: Scene[];
  onSceneOrderChange?: (scenes: Scene[]) => void;
  onSceneDurationChange?: (sceneId: string, duration: number) => void;
  className?: string;
}

const VideoContextEditorComponent: React.FC<VideoContextEditorProps> = ({
  scenes,
  onSceneOrderChange,
  onSceneDurationChange,
  className = '',
}) => {
  const [currentSceneIndex, setCurrentSceneIndex] = useState<number>(0);
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null);

  // Update selected scene when current index changes
  useEffect(() => {
    if (scenes && scenes.length > 0 && currentSceneIndex < scenes.length) {
      setSelectedScene(scenes[currentSceneIndex]);
    } else {
      setSelectedScene(null);
    }
  }, [scenes, currentSceneIndex]);

  // Handle scene selection from timeline
  const handleSceneSelect = (index: number) => {
    setCurrentSceneIndex(index);
  };

  // Handle scene duration change
  const handleDurationChange = (duration: number) => {
    if (selectedScene && onSceneDurationChange) {
      onSceneDurationChange(selectedScene.id, duration);
    }
  };

  return (
    <div className={`videocontext-editor ${className}`} data-testid="videocontext-editor">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="preview-container flex flex-col items-center">
          <h2 className="text-lg font-semibold mb-2">Preview</h2>
          <VideoContextPreview width={320} aspectRatio="portrait" />
        </div>
        
        <div className="scene-details">
          <h2 className="text-lg font-semibold mb-2">Scene Details</h2>
          {selectedScene ? (
            <div className="p-4 border rounded-md">
              <h3 className="text-md font-medium">Scene {currentSceneIndex + 1}</h3>
              <p className="text-sm text-gray-600 mt-1">
                Type: {selectedScene.media.type}
              </p>
              
              {/* Duration control */}
              <div className="mt-4">
                <label className="block text-sm text-gray-600 mb-1">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={selectedScene.duration || 5}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                  className="w-full p-2 border rounded-md"
                  data-testid="videocontext-duration-input"
                />
              </div>
              
              {/* Text content display/edit */}
              {selectedScene.content.text && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium">Text Content</h4>
                  <p className="text-sm mt-1 p-2 bg-gray-100 rounded-md">
                    {selectedScene.content.text}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No scene selected</p>
          )}
        </div>
      </div>
      
      <div className="timeline-container">
        <h2 className="text-lg font-semibold mb-2">Timeline</h2>
        <VideoContextTimeline 
          scenes={scenes} 
          currentSceneIndex={currentSceneIndex}
          onSceneSelect={handleSceneSelect}
        />
      </div>
    </div>
  );
};

// Wrap the component with the VideoContextProvider
const VideoContextEditor: React.FC<VideoContextEditorProps> = (props) => (
  <VideoContextProvider>
    <VideoContextEditorComponent {...props} />
  </VideoContextProvider>
);

export default VideoContextEditor; 