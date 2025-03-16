'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Volume2 as Volume2Icon,
  Settings as SettingsIcon,
} from 'lucide-react';
import { Scene } from '../project/ProjectTypes';
import { getAvailableVoices, generateVoice, persistVoiceAudio } from '@/lib/api-client';
import { useProject } from '../project/ProjectProvider';

/**
 * Helper function to convert base64 to Blob
 * @param base64 - Base64 encoded string
 * @param contentType - MIME type of the content
 * @returns Blob representation of the base64 data
 */
const base64ToBlob = (base64: string, contentType: string = 'audio/mp3'): Blob => {
  try {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: contentType });
  } catch (error) {
    console.error('Error converting base64 to blob:', error);
    return new Blob([], { type: contentType });
  }
};

interface SceneAudioControlsProps {
  /** Scene data containing content and media information */
  scene: Scene;
  /** Scene text content to be used for generating voice */
  textContent: string;
  /** Whether the scene is in read-only mode */
  readOnly?: boolean;
  /** Callback when audio generation completes successfully */
  onAudioGenerated?: () => void;
}

/**
 * SceneAudioControls - Component for managing audio generation and playback for a scene
 * This component now handles voice selection and generation with the same UI/structure as SceneComponent.
 */
export const SceneAudioControls: React.FC<SceneAudioControlsProps> = ({
  scene,
  textContent,
  readOnly = false,
  onAudioGenerated
}) => {
  const { updateSceneAudio, currentProject } = useProject();
  const projectId = currentProject?.id;
  
  // Voice state
  const [voices, setVoices] = useState<Array<any>>([]);
  const [voiceId, setVoiceId] = useState(scene.voice_settings?.voice_id || '');
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Voice settings state (matching SceneComponent)
  const [stability, setStability] = useState(scene.voice_settings?.stability || 0.5);
  const [similarityBoost, setSimilarityBoost] = useState(scene.voice_settings?.similarity_boost || 0.75);
  const [style, setStyle] = useState(scene.voice_settings?.style || 0);
  const [speakerBoost, setSpeakerBoost] = useState(scene.voice_settings?.speaker_boost || true);
  const [speed, setSpeed] = useState(scene.voice_settings?.speed || 1.0);
  
  // Audio state
  const [audioSrc, setAudioSrc] = useState<string | null>(
    scene.audio?.persistentUrl || scene.audio?.audio_url || null
  );
  
  // Refs
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Load available voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const result = await getAvailableVoices();
        if (result.error) {
          console.error('Error fetching voices:', result.error);
          setAudioError('Error loading voices. Please try again later.');
          return;
        }
        
        if (result.data) {
          setVoices(result.data.voices);
          
          // Set default voice if none selected
          if (!voiceId && result.data.voices.length > 0) {
            setVoiceId(result.data.voices[0].voice_id);
          }
        }
      } catch (err) {
        console.error('Error fetching voices:', err);
        setAudioError('Error loading voices. Please try again later.');
      }
    };
    
    fetchVoices();
  }, [voiceId]);
  
  // Generate voice for the scene text - Identical to SceneComponent's handleGenerateVoice
  const handleGenerateVoice = async () => {
    if (!voiceId) {
      setAudioError('Please select a voice first');
      return;
    }
    
    if (!textContent || textContent.trim() === '') {
      setAudioError('No text content to convert to speech. Please add some text content to the scene.');
      return;
    }

    setAudioError(null);
    setGeneratingAudio(true);
    
    try {
      const result = await generateVoice({
        text: textContent,
        voice_id: voiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: speakerBoost,
        output_format: "mp3_44100_128",
        speed
      });
      
      if (result.error) {
        throw new Error(result.error.message);
      }
      
      const { audio_base64 } = result.data!;
      
      // Create blob from base64
      const audioBlob = base64ToBlob(audio_base64, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioSrc(audioUrl);
      
      // Prepare audio data for storage
      const audioData = {
        audio_base64, // Keep the base64 data for persistence across sessions
        content_type: 'audio/mp3',
        audio_url: audioUrl,
        generated_at: Date.now(),
        character_count: result.data.character_count
      };
      
      // Prepare voice settings for storage
      const voiceSettings = {
        voice_id: voiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        speaker_boost: speakerBoost,
        speed
      };
      
      // First update scene with local audio data to ensure it's saved to project
      updateSceneAudio(scene.id, audioData, voiceSettings);
      
      // Then try to persist to R2 storage if available
      if (currentProject?.id) {
        try {
          console.log('Persisting audio to storage with data:', {
            projectId: currentProject.id,
            sceneId: scene.id,
            voiceId,
            contentType: 'audio/mp3',
            audioLength: audio_base64.length
          });
          
          const persistResult = await persistVoiceAudio({
            audio_base64,
            content_type: 'audio/mp3',
            project_id: currentProject.id,
            scene_id: scene.id,
            voice_id: voiceId
          });
          
          if (persistResult.error) {
            console.error('Error persisting audio to storage:', persistResult.error);
            // Already updated with local audio, so still try to play, but log the error
            setAudioError(`Warning: Audio generated but not saved to cloud. ${persistResult.error.message}`);
          } else if (persistResult.data && persistResult.data.success) {
            // If audio was successfully saved to R2, update with the returned URL
            const audioDataWithUrl = {
              ...audioData,
              persistentUrl: persistResult.data.url,
              storageKey: persistResult.data.storage_key
            };
            
            console.log('Audio successfully saved to storage with URL:', persistResult.data.url);
            updateSceneAudio(scene.id, audioDataWithUrl, voiceSettings);
          }
        } catch (err) {
          console.error('Exception when persisting audio to storage:', err);
          setAudioError('Warning: Audio generated but not saved to cloud storage');
          // Already updated with local audio, so still try to play
        }
      } else {
        console.warn('No project ID available for storage. Audio saved locally only.');
        setAudioError('Audio saved for this session only (no project ID for cloud storage)');
      }
      
      // Make sure audio element is updated before playing
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Error playing audio:', err);
            setAudioError('Error playing audio. Please try again.');
          });
        }
      }, 100);
      
      // Call the onAudioGenerated callback if provided
      if (onAudioGenerated) {
        onAudioGenerated();
      }
    } catch (err) {
      console.error('Error generating voice:', err);
      setAudioError(`Error generating voice: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingAudio(false);
    }
  };
  
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Voice Narration</div>
        <button
          ref={settingsButtonRef}
          className="text-xs text-blue-600 hover:text-blue-700 p-0.5 rounded flex items-center"
          aria-label="Voice settings"
        >
          <SettingsIcon className="h-3 w-3 mr-0.5" />
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
        disabled={generatingAudio || voices.length === 0}
      >
        {voices.length === 0 ? (
          <option>Loading voices...</option>
        ) : (
          voices.map((voice) => (
            <option key={voice.voice_id} value={voice.voice_id}>
              {voice.name}
            </option>
          ))
        )}
      </select>
      
      {/* Generate voice button - using identical styling to SceneComponent */}
      {!audioSrc && (
        <div className="relative mt-1">
          <button
            onClick={handleGenerateVoice}
            disabled={generatingAudio || !voiceId}
            className="front absolute inset-0 flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
            aria-label="Generate voice"
          >
            <Volume2Icon className="h-4 w-4 mr-1" />
            <span className="font-medium">{generatingAudio ? "Generating..." : "Generate Voiceover"}</span>
          </button>
        </div>
      )}
      
      {/* Hidden audio element */}
      <div className="hidden">
        <audio ref={audioRef} controls src={audioSrc || ''} className="w-full h-7" />
      </div>
    </div>
  );
};

export default memo(SceneAudioControls);