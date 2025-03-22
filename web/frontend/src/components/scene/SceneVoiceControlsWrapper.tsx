'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scene } from '../project/ProjectTypes';
import { useProject } from '../project/ProjectProvider';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { useAudioContext } from '@/contexts/AudioContext';
import { generateVoice, persistVoiceAudio } from '@/lib/api-client';
import { SceneAudioControls } from '../audio/SceneAudioControls';
import { base64ToBlob } from '@/utils/scene/event-handlers/audio-handlers';
import { GenerateVoiceRequest, SaveAudioRequest } from '@/lib/api-types';

interface VoiceSettings {
  voice_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
  speed: number;
}

interface SceneVoiceControlsWrapperProps {
  scene: Scene;
  className?: string;
}

const SceneVoiceControlsWrapper: React.FC<SceneVoiceControlsWrapperProps> = ({
  scene,
  className = ''
}) => {
  const { updateSceneAudio, currentProject } = useProject();
  const { voices, selectedVoiceId, setSelectedVoiceId } = useVoiceContext();
  const { audioState, setAudioPlaying, setAudioVolume } = useAudioContext();
  
  // Audio state
  const [audioSrc, setAudioSrc] = useState<string | undefined>(
    scene.audio?.persistentUrl || scene.audio?.audio_url || undefined
  );
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Voice settings
  const [stability, setStability] = useState(scene.voice_settings?.stability || 0.5);
  const [similarityBoost, setSimilarityBoost] = useState(scene.voice_settings?.similarity_boost || 0.75);
  const [style, setStyle] = useState(scene.voice_settings?.style || 0);
  const [speakerBoost, setSpeakerBoost] = useState(scene.voice_settings?.speaker_boost || false);
  const [speed, setSpeed] = useState(scene.voice_settings?.speed || 1.0);
  
  // Set initial voice if none selected
  useEffect(() => {
    if (!selectedVoiceId && voices.length > 0) {
      setSelectedVoiceId(voices[0].voice_id);
    }
  }, [selectedVoiceId, voices, setSelectedVoiceId]);

  // Handle generating voice
  const handleGenerateVoice = useCallback(async () => {
    if (isGeneratingAudio || !currentProject || !selectedVoiceId || !scene.text) return;
    
    setIsGeneratingAudio(true);
    setAudioError(null);
    
    try {
      // Create voice settings object
      const voiceSettings: VoiceSettings = {
        voice_id: selectedVoiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        speaker_boost: speakerBoost,
        speed
      };

      // Create voice generation request
      const generateRequest: GenerateVoiceRequest = {
        text: scene.text,
        voice_id: selectedVoiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: speakerBoost,
        speed,
        output_format: "mp3_44100_128"
      };
      
      // Generate new audio
      const result = await generateVoice(generateRequest);
      if (!result || !result.data) {
        throw new Error('No audio data returned from API');
      }
      
      const audioBlob = base64ToBlob(result.data.audio_base64, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      setAudioSrc(audioUrl);
      
      const audioData = {
        audio_base64: result.data.audio_base64,
        audio_url: audioUrl,
        contentType: 'audio/mpeg'
      };
      
      updateSceneAudio(scene.id, audioData, voiceSettings);
      
      // Persist to storage
      if (currentProject.id) {
        try {
          const persistRequest: SaveAudioRequest = {
            audio_base64: result.data.audio_base64,
            content_type: 'audio/mpeg',
            project_id: currentProject.id,
            scene_id: scene.id,
            voice_id: selectedVoiceId
          };
          
          const persistResult = await persistVoiceAudio(persistRequest);
          
          if (persistResult.data?.url) {
            updateSceneAudio(
              scene.id,
              { ...audioData, persistentUrl: persistResult.data.url },
              voiceSettings
            );
          }
        } catch (persistError) {
          console.error('Error persisting audio:', persistError);
        }
      }
    } catch (error) {
      console.error('Error generating voice:', error);
      setAudioError(error instanceof Error ? error.message : 'Failed to generate voice');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [
    scene.id,
    scene.text,
    selectedVoiceId,
    stability,
    similarityBoost,
    style,
    speakerBoost,
    speed,
    isGeneratingAudio,
    currentProject,
    updateSceneAudio
  ]);

  // Handle voice change
  const handleVoiceChange = (voiceId: string) => {
    setSelectedVoiceId(voiceId);
  };

  // Handle playback speed change
  const handlePlaybackSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  return (
    <div className={`voice-controls-wrapper ${className}`}>
      <SceneAudioControls
        sceneId={scene.id}
        audioSource={audioSrc}
        isGeneratingAudio={isGeneratingAudio}
        onGenerateClick={handleGenerateVoice}
        onRegenerateClick={handleGenerateVoice}
        onVoiceChange={handleVoiceChange}
        onRateChange={handlePlaybackSpeedChange}
      />
      
      {/* Hidden audio element for playback */}
      {audioSrc && (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          className="hidden"
        />
      )}
    </div>
  );
};

export default SceneVoiceControlsWrapper; 