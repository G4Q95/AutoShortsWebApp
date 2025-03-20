'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { SceneContainer } from '@/components/scene/SceneContainer';
import { ProjectProvider, useProject } from '@/components/project/ProjectProvider';
import { Scene, Project } from '@/components/project/ProjectTypes';
import { AudioProvider } from '@/contexts/AudioContext';
import { VoiceProvider } from '@/contexts/VoiceContext';

// Create a wrapper component to set up the project after the context is loaded
function SceneContainerWrapper() {
  const { createProject, currentProject, addScene } = useProject();
  const [isReady, setIsReady] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>([]);
  
  // Set up the project on mount
  useEffect(() => {
    async function setupProject() {
      if (!currentProject) {
        await createProject("Test Project");
        
        // Add the sample scene
        const sceneUrl = 'https://www.reddit.com/r/aww/comments/sample';
        await addScene(sceneUrl);
        
        // Mark as ready once the project is set up
        setIsReady(true);
      } else {
        setIsReady(true);
      }
    }
    
    setupProject();
  }, [createProject, currentProject, addScene]);
  
  // Update local scenes state when currentProject changes
  useEffect(() => {
    if (currentProject) {
      setScenes(currentProject.scenes);
    }
  }, [currentProject]);
  
  // Handle scene removal
  const handleSceneRemove = (sceneId: string) => {
    // This would be handled by the ProjectProvider in a real app
    // For this test, we'll just update the local state
    setScenes(prevScenes => prevScenes.filter(scene => scene.id !== sceneId));
  };

  // Handle scene reordering
  const handleSceneReorder = (sceneId: string, newIndex: number) => {
    console.log(`Reordering scene ${sceneId} to index ${newIndex}`);
    // In a real app, this would reorder the scenes
  };
  
  if (!isReady) {
    return <div className="p-4">Loading test scene...</div>;
  }
  
  return (
    <div className="mt-4">
      {scenes.length > 0 ? (
        scenes.map((scene, index) => (
          <SceneContainer
            key={scene.id}
            scene={scene}
            preview={null}
            index={index}
            onSceneRemove={handleSceneRemove}
            onSceneMove={() => {}}
            onSceneReorder={handleSceneReorder}
            useNewAudioControls={true}
          />
        ))
      ) : (
        <div className="p-4 text-center bg-gray-100 rounded-md">
          <p>No scenes to display.</p>
        </div>
      )}
    </div>
  );
}

/**
 * Test page for SceneContainer component
 */
export default function SceneContainerTest() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">SceneContainer Component Test</h1>
      
      <div className="mb-4 p-3 bg-blue-50 rounded-md">
        <p>This is a test page for the SceneContainer component. It demonstrates:</p>
        <ul className="list-disc pl-6 mt-2">
          <li>The refactored component structure</li>
          <li>Integration of all the hooks (useSceneMedia, useSceneAudio, useSceneEdit)</li>
          <li>Text editing capabilities</li>
          <li>Media display</li>
          <li>Voice generation UI</li>
          <li>Scene actions (delete)</li>
        </ul>
      </div>
      
      <ProjectProvider>
        <AudioProvider>
          <VoiceProvider>
            <SceneContainerWrapper />
          </VoiceProvider>
        </AudioProvider>
      </ProjectProvider>
    </div>
  );
} 