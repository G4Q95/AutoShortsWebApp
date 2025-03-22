/**
 * SceneVoiceControlsWrapper
 * 
 * Bridge component that extracts voice generation and audio playback functionality from SceneComponent.
 * Serves as a compatibility layer between SceneComponent and specialized voice/audio components.
 */
'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SceneAudioControls } from '@/components/audio/SceneAudioControls';
import { SceneVoiceSettings } from '@/components/scene/SceneVoiceSettings';
import { useVoiceContext } from '@/contexts/VoiceContext';

// Voice settings interface
interface VoiceSettings {
  voice_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
  speed: number;
}

interface SceneVoiceControlsWrapperProps {
  /** Scene ID for this component */
  sceneId: string;
  
  /** Text content to generate voice for */
  text: string;
  
  /** URL for audio source if already generated */
  audioSource: string | null;
  
  /** Current voice settings */
  voiceSettings: {
    voice_id?: string;
    stability?: number;
    similarity_boost?: number;
    style?: number;
    speaker_boost?: boolean;
    speed?: number;
  };
  
  /** Whether audio is currently being generated */
  isGeneratingAudio: boolean;
  
  /** Error message from audio generation if any */
  audioError: string | null;
  
  /** Callback for voice generation request */
  onGenerateClick: () => void;
  
  /** Callback for voice ID change */
  onVoiceIdChange: (voiceId: string) => void;
  
  /** Callback for voice settings changes */
  onVoiceSettingsChange: (settings: Partial<VoiceSettings>) => void;
  
  /** Callback for playback rate change */
  onPlaybackRateChange?: (rate: number) => void;
  
  /** Additional classes for styling */
  className?: string;
}

/**
 * SceneVoiceControlsWrapper component
 * 
 * Wraps and coordinates voice generation and audio playback functionality.
 * Extracts this functionality from SceneComponent to improve separation of concerns.
 */
const SceneVoiceControlsWrapper: React.FC<SceneVoiceControlsWrapperProps> = ({
  sceneId,
  text,
  audioSource,
  voiceSettings,
  isGeneratingAudio,
  audioError,
  onGenerateClick,
  onVoiceIdChange,
  onVoiceSettingsChange,
  onPlaybackRateChange,
  className = ''
}) => {
  console.log(`[SceneVoiceControlsWrapper] Rendering for scene: ${sceneId}`);
  
  // Extract voice settings with defaults
  const voiceId = voiceSettings.voice_id || '';
  const stability = voiceSettings.stability || 0.5;
  const similarityBoost = voiceSettings.similarity_boost || 0.75;
  const style = voiceSettings.style || 0;
  const speakerBoost = voiceSettings.speaker_boost || false;
  const speed = voiceSettings.speed || 1.0;
  
  // Use voice context to access available voices
  const { voices } = useVoiceContext();
  
  // Check for valid text content before generation
  const canGenerateVoice = Boolean(text && text.trim() !== '');
  
  // Handle voice settings change
  const handleVoiceSettingsChange = useCallback((settings: Partial<VoiceSettings>) => {
    console.log('[SceneVoiceControlsWrapper] Voice settings changed:', settings);
    onVoiceSettingsChange(settings);
  }, [onVoiceSettingsChange]);
  
  // Handle playback rate change
  const handlePlaybackRateChange = useCallback((rate: number) => {
    console.log('[SceneVoiceControlsWrapper] Playback rate changed:', rate);
    if (onPlaybackRateChange) {
      onPlaybackRateChange(rate);
    }
  }, [onPlaybackRateChange]);
  
  // Log when props change to help with debugging
  useEffect(() => {
    console.log(`[SceneVoiceControlsWrapper] Props updated for scene: ${sceneId}`, {
      hasText: Boolean(text),
      textLength: text?.length || 0,
      hasAudio: Boolean(audioSource),
      isGenerating: isGeneratingAudio
    });
  }, [sceneId, text, audioSource, isGeneratingAudio]);
  
  return (
    <div className={`scene-voice-controls ${className}`} data-testid="scene-voice-controls">
      {/* Voice selection and settings */}
      <SceneVoiceSettings
        voiceId={voiceId}
        voiceSettings={{
          stability,
          similarity_boost: similarityBoost,
          style,
          speaker_boost: speakerBoost,
          speed
        }}
        isGenerating={isGeneratingAudio}
        audioError={audioError}
        onVoiceChange={onVoiceIdChange}
        onSettingsChange={handleVoiceSettingsChange}
        onGenerateClick={onGenerateClick}
      />
      
      {/* Audio controls with generation button */}
      <SceneAudioControls
        sceneId={sceneId}
        audioSource={audioSource || undefined}
        isGeneratingAudio={isGeneratingAudio}
        onGenerateClick={onGenerateClick}
        onRegenerateClick={onGenerateClick}
        onVoiceChange={onVoiceIdChange}
        onRateChange={handlePlaybackRateChange}
      />
    </div>
  );
};

export default SceneVoiceControlsWrapper; 