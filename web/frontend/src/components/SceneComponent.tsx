import React, { useState } from 'react';
import { Scene } from '@/components/project/ProjectTypes';
import SceneAudioControls from '@/components/audio/SceneAudioControls';
import SceneTextEditor from '@/components/text-editor/SceneTextEditor';
import { GenerateVoiceResponse } from '@/lib/api-types';
import { generateVoice } from '@/lib/api/voice';

/**
 * A simplified media display component that only requires the scene prop
 */
function SimpleMediaDisplay({ scene }: { scene: Scene }) {
  if (!scene.media) {
    return (
      <div className="h-40 bg-gray-100 flex items-center justify-center rounded-t-lg">
        <p className="text-gray-500 text-sm">No media available</p>
      </div>
    );
  }

  if (scene.media.type === 'image') {
    return (
      <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src={scene.media.url} 
            alt={scene.text} 
            className="rounded-t-lg h-40 object-contain"
          />
        </div>
      </div>
    );
  }

  if (scene.media.type === 'video') {
    return (
      <div className="relative w-full h-40 bg-black rounded-t-lg overflow-hidden">
        <video 
          src={scene.media.url} 
          controls 
          className="w-full h-full object-contain rounded-t-lg"
          crossOrigin="anonymous"
        />
      </div>
    );
  }

  if (scene.media.type === 'gallery') {
    return (
      <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
        <div className="w-full h-full flex items-center justify-center">
          <img 
            src={scene.media.url} 
            alt={scene.text} 
            className="rounded-t-lg h-40 object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-40 bg-gray-100 flex items-center justify-center rounded-t-lg">
      <p className="text-gray-500 text-sm">Unsupported media type</p>
    </div>
  );
}

interface SceneComponentProps {
  scene: Scene;
  onRemoveScene: (sceneId: string) => void;
  onTextChange: (sceneId: string, text: string) => void;
  onAudioChange: (sceneId: string, audioData: any) => void;
  isRemoving?: boolean;
}

export default function SceneComponent({ 
  scene, 
  onRemoveScene, 
  onTextChange, 
  onAudioChange,
  isRemoving = false
}: SceneComponentProps) {
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);

  const handleTextChange = (text: string) => {
    onTextChange(scene.id, text);
  };

  const handleGenerateVoice = async () => {
    if (!scene.voice_settings?.voice_id || !scene.text || isGeneratingVoice) return;
    
    setIsGeneratingVoice(true);
    try {
      const response = await generateVoice({
        text: scene.text,
        voice_id: scene.voice_settings.voice_id,
        stability: scene.voice_settings.stability,
        similarity_boost: scene.voice_settings.similarity_boost,
        style: scene.voice_settings.style || 0,
        use_speaker_boost: scene.voice_settings.speaker_boost || true,
        speed: scene.voice_settings.speed || 1.0
      });

      if (response.error) {
        console.error('Error generating voice:', response.error);
        return;
      }

      const audioData = response.data;
      const audioUrl = `data:${audioData.content_type};base64,${audioData.audio_base64}`;

      // Update the scene with the new audio data
      onAudioChange(scene.id, {
        audio_base64: audioData.audio_base64,
        content_type: audioData.content_type,
        audio_url: audioUrl,
        character_count: audioData.character_count,
        generated_at: Date.now()
      });
    } catch (error) {
      console.error('Error generating voice:', error);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const handleRegenerateVoice = async () => {
    await handleGenerateVoice();
  };

  const handleVoiceChange = (voiceId: string) => {
    onAudioChange(scene.id, {
      ...scene.audio,
      voice_settings: {
        ...scene.voice_settings,
        voice_id: voiceId
      }
    });
  };

  return (
    <div 
      id={`scene-${scene.id}`}
      data-testid="scene-component"
      className={`relative rounded-lg border overflow-hidden shadow-sm bg-white
      border-gray-300
      ${isRemoving ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}
      style={{ 
        opacity: isRemoving ? 0.5 : 1,
        transition: 'opacity 0.5s ease-out',
        height: 348 // Fixed height for consistent layout
      }}
    >
      <div 
        data-testid={`scene-number-${scene.id}`}
        className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium z-10"
      >
        {/* Scene number will be set by parent component */}
        {scene.id}
      </div>

      <div className="flex flex-col h-full">
        {/* Media section */}
        <div className="h-40" data-testid="scene-media">
          <SimpleMediaDisplay scene={scene} />
        </div>

        {/* Content section */}
        <div className="p-1 flex-1 flex flex-col">
          {/* Source info */}
          <div className="flex flex-wrap items-center text-xs text-gray-500 mb-1 pb-1 border-b border-gray-200" data-testid="scene-source-info">
            {scene.source?.author && <span className="mr-1 truncate">By: {scene.source.author}</span>}
            {scene.source?.subreddit && <span className="truncate">r/{scene.source.subreddit}</span>}
          </div>

          {/* Text section */}
          <SceneTextEditor 
            text={scene.text} 
            onTextChange={handleTextChange} 
          />

          {/* Audio section */}
          <div className="mt-1 pt-1 border-t border-gray-200" data-testid="scene-audio-section">
            <SceneAudioControls
              sceneId={scene.id}
              audioSource={scene.audio?.audio_url}
              isGeneratingAudio={isGeneratingVoice}
              onGenerateClick={handleGenerateVoice}
              onRegenerateClick={handleRegenerateVoice}
              onVoiceChange={handleVoiceChange}
            />
          </div>
        </div>

        {/* Delete button */}
        <div className="border-t border-gray-200 flex justify-end">
          <button
            className="flex-shrink-0 w-10 py-2 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 shadow-sm"
            aria-label="Remove scene"
            data-testid="delete-scene-button"
            onClick={() => onRemoveScene(scene.id)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash2 h-4 w-4">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              <line x1="10" x2="10" y1="11" y2="17"></line>
              <line x1="14" x2="14" y1="11" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
} 