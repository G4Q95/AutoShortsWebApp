import React, { useState } from 'react';
import { Scene } from './project/ProjectTypes';
import SceneAudioControls from './audio/SceneAudioControls';
import SceneControlsLayout from './audio/SceneControlsLayout';
import { SceneTextEditor } from './text-editor/SceneTextEditor';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { generateVoice } from '@/lib/api-client';

// Create a simplified MediaContentItem that accepts only the scene prop
// To avoid circular dependencies and type issues
const SimpleMediaDisplay: React.FC<{ scene: Scene }> = ({ scene }) => {
  return (
    <div className="media-display">
      {scene.media?.type === 'image' && (
        <img 
          src={scene.media.url} 
          alt="Content" 
          className="w-full h-auto object-contain"
        />
      )}
      {scene.media?.type === 'video' && (
        <video 
          src={scene.media.url}
          controls
          className="w-full h-auto"
        />
      )}
      {scene.media?.type === 'gallery' && (
        <div className="gallery-placeholder p-4 bg-gray-100 text-center">
          Gallery with multiple items
        </div>
      )}
      {!scene.media && (
        <div className="no-media-placeholder p-4 bg-gray-100 text-center">
          No media available
        </div>
      )}
    </div>
  );
};

interface SceneComponentProps {
  scene: Scene;
  onRemoveScene: (sceneId: string) => void;
  onTextChange: (sceneId: string, text: string) => void;
  onAudioChange: (
    sceneId: string, 
    audioData: Scene['audio'], 
    voiceSettings: Scene['voice_settings']
  ) => void;
  isRemoving?: boolean;
}

const SceneComponent: React.FC<SceneComponentProps> = ({
  scene,
  onRemoveScene,
  onTextChange,
  onAudioChange,
  isRemoving = false
}) => {
  // Voice generation state
  const { selectedVoice } = useVoiceContext();
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  
  // Handle voice generation
  const handleGenerateVoice = async () => {
    if (!selectedVoice || !scene.text || isGeneratingVoice) return;
    
    try {
      console.log('Voice generation initiated:', {
        sceneId: scene.id,
        mockAudioEnabled: Boolean(window.USE_MOCK_AUDIO),
        voiceId: selectedVoice,
        textLength: scene.text?.length || 0
      });
      
      setIsGeneratingVoice(true);
      
      const response = await generateVoice({
        text: scene.text,
        voice_id: selectedVoice
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Save audio data and voice settings
      onAudioChange(
        scene.id,
        { 
          audio_base64: response.data.audio_base64,
          content_type: response.data.content_type,
          audio_url: `data:${response.data.content_type};base64,${response.data.audio_base64}`,
          generated_at: Date.now(),
          character_count: response.data.character_count
        },
        { 
          voice_id: selectedVoice, 
          stability: 0.5, 
          similarity_boost: 0.75,
          style: 0,
          speaker_boost: false,
          speed: 1
        }
      );
      
    } catch (error) {
      console.error('Error generating voice:', error);
    } finally {
      setIsGeneratingVoice(false);
    }
  };
  
  // Regenerate voice with current settings
  const handleRegenerateVoice = async () => {
    handleGenerateVoice();
  };
  
  // Handle voice selection change
  const handleVoiceChange = (voiceId: string) => {
    // This will be handled by the VoiceContext
    console.log('Voice changed to:', voiceId);
  };
  
  return (
    <div className="scene-component relative bg-white rounded-md shadow overflow-hidden border border-gray-200" data-testid="scene-component">
      {/* Media content */}
      <div className="media-container relative">
        <SimpleMediaDisplay scene={scene} />
      </div>

      {/* Text content */}
      <div className="text-container p-3">
        <SceneTextEditor 
          text={scene.text || ''}
          onTextChange={(newText) => onTextChange(scene.id, newText)}
        />
      </div>

      {/* Audio controls with trash button */}
      <SceneControlsLayout
        isRemoving={isRemoving}
        onRemoveScene={() => onRemoveScene(scene.id)}
      >
        <SceneAudioControls
          sceneId={scene.id}
          audioSource={scene.audio?.audio_url}
          isGeneratingAudio={isGeneratingVoice}
          onGenerateClick={handleGenerateVoice}
          onRegenerateClick={handleRegenerateVoice}
          onVoiceChange={handleVoiceChange}
        />
      </SceneControlsLayout>
    </div>
  );
};

export default SceneComponent; 