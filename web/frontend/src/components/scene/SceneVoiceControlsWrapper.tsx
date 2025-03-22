'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scene } from '../project/ProjectTypes';
import { useProject } from '../project/ProjectProvider';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { getStoredAudio, generateVoice, persistVoiceAudio } from '@/lib/api-client';
import SceneAudioControls from '../audio/SceneAudioControls';
import {
  base64ToBlob,
  downloadAudio,
  togglePlayPause,
  handleVolumeChange,
  handlePlaybackSpeedChange
} from '@/utils/scene';

interface SceneVoiceControlsWrapperProps {
  /** The scene data */
  scene: Scene;
  /** Audio source URL */
  audioSrc: string | null;
  /** Whether audio is being generated */
  generatingAudio: boolean;
  /** Audio error message if any */
  audioError: string | null;
  /** Reference to the audio element */
  audioRef: React.RefObject<HTMLAudioElement>;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Set function for audio source state */
  setAudioSrc: (src: string | null) => void;
  /** Set function for generating audio state */
  setGeneratingAudio: (generating: boolean) => void;
  /** Set function for audio error state */
  setAudioError: (error: string | null) => void;
  /** Set function for is playing state */
  setIsPlaying: (playing: boolean) => void;
  /** Voice ID state */
  voiceId: string;
  /** Set function for voice ID state */
  setVoiceId: (id: string) => void;
  /** Whether to use the new audio controls component */
  useNewAudioControls?: boolean;
  /** Additional class name for styling */
  className?: string;
}

/**
 * A wrapper component that handles voice controls functionality for a scene
 * This component encapsulates all voice-related functionality previously embedded in SceneComponent
 */
const SceneVoiceControlsWrapper: React.FC<SceneVoiceControlsWrapperProps> = ({
  scene,
  audioSrc,
  generatingAudio,
  audioError,
  audioRef,
  isPlaying,
  setAudioSrc,
  setGeneratingAudio,
  setAudioError,
  setIsPlaying,
  voiceId,
  setVoiceId,
  useNewAudioControls = false,
  className = ''
}) => {
  const { voices: voiceContextVoices, isLoading: loadingVoices } = useVoiceContext();
  const { updateSceneAudio, currentProject } = useProject();
  
  // Voice settings states - these are still needed for generating audio
  const [showSettings, setShowSettings] = useState(false);
  const [stability, setStability] = useState(scene.voice_settings?.stability || 0.5);
  const [similarityBoost, setSimilarityBoost] = useState(scene.voice_settings?.similarity_boost || 0.75);
  const [style, setStyle] = useState(scene.voice_settings?.style || 0);
  const [speakerBoost, setSpeakerBoost] = useState(scene.voice_settings?.speaker_boost || false);
  const [speed, setSpeed] = useState(scene.voice_settings?.speed || 1.0);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Audio playback settings
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioSettingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Volume controls
  const [volume, setVolume] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  
  // Handle generating voice
  const handleGenerateVoice = useCallback(async () => {
    if (generatingAudio || !currentProject) return;
    
    setGeneratingAudio(true);
    setAudioError(null);
    
    try {
      // Create default voice settings if none exist
      const voiceSettings = {
        voice_id: voiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        speaker_boost: speakerBoost,
        speed
      };
      
      console.log(`Generating voice for scene ${scene.id} with settings:`, voiceSettings);
      
      // Get stored audio first if available
      const storedAudio = await getStoredAudio(scene.id, voiceSettings);
      if (storedAudio?.audio_base64) {
        console.log('Found stored audio, using that instead of generating new audio');
        const audioBlob = base64ToBlob(storedAudio.audio_base64, 'audio/mpeg');
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Update the audio source with the URL
        setAudioSrc(audioUrl);
        
        // Update the scene data with the audio URL and voice settings
        const audioData = {
          audio_base64: storedAudio.audio_base64,
          audio_url: audioUrl,
          persistentUrl: storedAudio.persistent_url || null,
          contentType: 'audio/mpeg'
        };
        
        updateSceneAudio(scene.id, audioData, voiceSettings);
        setGeneratingAudio(false);
        return;
      }
      
      // If no stored audio, generate new audio
      const result = await generateVoice(scene.text, voiceSettings);
      if (!result.audio) {
        throw new Error('No audio data returned from API');
      }
      
      // Create a blob URL from the audio data
      const audioBlob = base64ToBlob(result.audio, 'audio/mpeg');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Update the audio source with the URL
      setAudioSrc(audioUrl);
      
      // Update the scene data with the audio URL and voice settings
      const audioData = {
        audio_base64: result.audio,
        audio_url: audioUrl,
        contentType: 'audio/mpeg'
      };
      
      updateSceneAudio(scene.id, audioData, voiceSettings);
      
      // Persist the audio to R2 storage
      try {
        const persistResult = await persistVoiceAudio(scene.id, {
          audio_data: result.audio,
          content_type: 'audio/mpeg',
          project_id: currentProject.id
        });
        
        if (persistResult.persistent_url) {
          // Update the scene with the persistent URL
          updateSceneAudio(
            scene.id,
            { ...audioData, persistentUrl: persistResult.persistent_url },
            voiceSettings
          );
        }
      } catch (persistError) {
        console.error('Error persisting audio:', persistError);
        // Continue even if persistence fails
      }
    } catch (error) {
      console.error('Error generating voice:', error);
      setAudioError(error instanceof Error ? error.message : 'Failed to generate voice');
    } finally {
      setGeneratingAudio(false);
    }
  }, [
    scene.id,
    scene.text,
    generatingAudio,
    currentProject,
    voiceId,
    stability,
    similarityBoost,
    style,
    speakerBoost,
    speed,
    setGeneratingAudio,
    setAudioSrc,
    setAudioError,
    updateSceneAudio
  ]);
  
  // Handle play/pause toggle
  const handlePlayPauseToggle = useCallback(() => {
    if (!audioRef.current) return;
    
    togglePlayPause(audioRef.current, isPlaying, setIsPlaying);
  }, [audioRef, isPlaying, setIsPlaying]);
  
  // Handle volume change
  const handleVolumeChangeEvent = useCallback((newVolume: number) => {
    if (!audioRef.current) return;
    
    handleVolumeChange(audioRef.current, newVolume, setVolume);
  }, [audioRef, setVolume]);
  
  // Handle playback speed
  const handlePlaybackSpeedUpdate = useCallback((newSpeed: number) => {
    if (!audioRef.current) return;
    
    handlePlaybackSpeedChange(audioRef.current, newSpeed, setPlaybackSpeed);
  }, [audioRef, setPlaybackSpeed]);
  
  // Handle download audio
  const handleDownloadAudio = useCallback(() => {
    if (!audioRef.current || !scene.audio?.audio_base64) return;
    
    downloadAudio(scene.id, scene.audio.audio_base64);
  }, [scene.id, scene.audio?.audio_base64]);
  
  return (
    <div className={`voice-controls-wrapper ${className}`} data-testid="scene-voice-controls-wrapper">
      <div className="pt-0.5 border-t border-gray-200" data-testid="scene-audio-section">
        {useNewAudioControls ? (
          // New component (extracted)
          <div data-testid="new-audio-controls">
            <SceneAudioControls 
              sceneId={scene.id}
              audioSource={audioSrc || undefined}
              isGeneratingAudio={generatingAudio}
              onGenerateClick={handleGenerateVoice}
              onRegenerateClick={handleGenerateVoice}
              onVoiceChange={(voice) => setVoiceId(voice)}
              onRateChange={handlePlaybackSpeedUpdate}
            />
          </div>
        ) : (
          // Original implementation (inline)
          <div data-testid="original-audio-controls">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-gray-700">Voice Narration</div>
                <button
                ref={settingsButtonRef}
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs text-blue-600 hover:text-blue-700 p-0.5 rounded flex items-center"
                aria-label="Voice settings"
              >
                {/* Settings icon would go here */}
                <span>Settings</span>
                </button>
            </div>
            
            {audioError && (
              <div className="mb-0.5 text-xs text-red-600 bg-red-50 p-0.5 rounded">
                {audioError}
              </div>
            )}
            
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              className="text-xs py-0.5 px-1 border border-gray-300 rounded w-full mt-0.5 mb-0.5"
              disabled={generatingAudio || voiceContextVoices.length === 0}
              data-testid="voice-selector"
            >
              {voiceContextVoices.length === 0 ? (
                <option>Loading voices...</option>
              ) : (
                voiceContextVoices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </option>
                ))
              )}
            </select>
            
            {/* We're hiding the audio player div completely, but keeping it for test mode */}
            <div 
              className="audio-container hidden"
              data-testid="audio-container">
              <audio 
                controls={false}
                src={audioSrc || ''} 
                className="w-full h-7" 
                data-testid="audio-element" 
                preload="metadata"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Voice generation or audio player buttons */}
      <div className="relative w-full" style={{ width: '100%', height: '100%' }}>
        {!scene.audio && !useNewAudioControls && (
          <button
            className="w-full generate-button front absolute inset-0 flex-grow px-3 py-2.5 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
            data-testid="generate-voice-button"
            disabled={generatingAudio}
            onClick={handleGenerateVoice}
          >
            {/* Mic icon would go here */}
            Generate Voiceover
          </button>
        )}
        
        {!useNewAudioControls && audioSrc && (
          <div
            className="back absolute inset-0 flex-grow px-2 py-2 bg-green-600 text-white text-sm rounded-bl-md flex items-center justify-between"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              zIndex: audioSrc ? '2' : '0',
              right: '0',
              width: '100%',
              paddingRight: '0.75rem',
              borderRight: 'none'
            }}
          >
            {/* Audio Control Section - all controls in a single row with flex */}
            <div className="flex items-center w-full justify-between">
              {/* Audio controls would go here */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneVoiceControlsWrapper; 