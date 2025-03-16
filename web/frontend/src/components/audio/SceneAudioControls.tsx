'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import {
  Volume2 as Volume2Icon,
  Settings as SettingsIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  RotateCw as RegenerateIcon,
  MoreVertical as MoreVerticalIcon,
  X as XIcon,
  Download as DownloadIcon,
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
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  
  // Refs
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioSettingsButtonRef = useRef<HTMLButtonElement>(null);
  
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
  
  // Update audio element state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    
    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioRef.current]);
  
  // Format time for audio display
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
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
  
  // Toggle play/pause
  const togglePlayPause = () => {
    if (!audioRef.current) return;
    
    if (audioRef.current.paused) {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setAudioError('Error playing audio. Please try again.');
      });
    } else {
      audioRef.current.pause();
    }
  };
  
  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  // Handle playback speed change
  const handlePlaybackSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };
  
  // Regenerate voice
  const handleRegenerateVoice = () => {
    handleGenerateVoice();
  };

  // Download audio
  const handleDownloadAudio = () => {
    if (!audioSrc || !audioRef.current) return;
    
    // Create an anchor element for download
    const a = document.createElement('a');
    a.href = audioSrc;
    a.download = `audio-${scene.id}-${voiceId}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-gray-700">Voice Narration</div>
        <button
          ref={settingsButtonRef}
          onClick={() => setShowSettings(!showSettings)}
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
      
      {/* Generate voice button or Audio Player controls */}
      {!audioSrc ? (
        <div className="relative mt-1" style={{ width: '100%', height: '100%' }}>
          <button
            onClick={handleGenerateVoice}
            disabled={generatingAudio || !voiceId}
            className="w-full front absolute inset-0 flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
            aria-label="Generate voice"
            data-testid="generate-voiceover-btn"
          >
            <Volume2Icon className="h-4 w-4 mr-1" />
            <span className="font-medium">{generatingAudio ? "Generating..." : "Generate Voiceover"}</span>
          </button>
        </div>
      ) : (
        <div className="bg-green-600 text-white text-sm rounded-bl-md py-2 px-2 flex items-center justify-between" style={{ width: '100%' }}>
          {/* Audio playback controls */}
          <div className="flex items-center w-full justify-between">
            {/* Left side - play button and time */}
            <div className="flex items-center">
              <button 
                onClick={togglePlayPause}
                className="text-white p-0.5 hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 mr-1"
                style={{ width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                {isPlaying ? 
                  <PauseIcon className="h-3.5 w-3.5" /> : 
                  <PlayIcon className="h-3.5 w-3.5" />
                }
              </button>
              
              <div className="text-xs whitespace-nowrap font-semibold">
                <span>{formatTime(currentTime)}</span>
                <span className="mx-0.5">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
            
            {/* Middle - volume slider */}
            <div className="relative mx-2 flex-grow max-w-[250px]">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                className="w-full h-2 bg-white bg-opacity-70 rounded appearance-none cursor-pointer"
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              />
            </div>
            
            {/* Right - action buttons */}
            <div className="flex items-center">
              <button 
                onClick={handleRegenerateVoice}
                disabled={generatingAudio}
                className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center mr-1.5"
                title="Regenerate voice"
                style={{ width: '18px', height: '18px' }}
              >
                <RegenerateIcon className="h-3 w-3" />
              </button>
              
              <button 
                className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center"
                title="Audio options"
                onClick={() => setShowAudioSettings(true)}
                ref={audioSettingsButtonRef}
                style={{ width: '18px', height: '18px' }}
              >
                <MoreVerticalIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Audio Playback Settings Panel Overlay */}
      {showAudioSettings && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowAudioSettings(false);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-300 w-80 max-w-[90vw] p-4 absolute"
            style={{
              top: audioSettingsButtonRef.current 
                ? audioSettingsButtonRef.current.getBoundingClientRect().top - 220 
                : '10vh',
              left: audioSettingsButtonRef.current 
                ? audioSettingsButtonRef.current.getBoundingClientRect().left - 244
                : '10vw',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium text-gray-800">Audio Settings</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAudioSettings(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1">
                <label className="text-sm text-gray-600">Playback Speed: {playbackSpeed.toFixed(2)}x</label>
                <span className="text-xs text-gray-500">
                  {playbackSpeed < 0.85 ? 'Slower' : playbackSpeed > 1.1 ? 'Faster' : 'Normal'}
                </span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2.0" 
                step="0.05" 
                value={playbackSpeed} 
                onChange={(e) => {
                  e.stopPropagation();
                  handlePlaybackSpeedChange(parseFloat(e.target.value));
                }}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                onMouseDown={(e) => e.stopPropagation()}
              />
              <div className="flex justify-between text-[10px] text-gray-400">
                <span>0.5x</span>
                <span>2.0x</span>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={handleDownloadAudio}
                disabled={!audioSrc}
                className={`w-full py-2 rounded-md flex items-center justify-center space-x-2 ${
                  audioSrc ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <DownloadIcon className="h-4 w-4" />
                <span>Download Audio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Settings Panel Overlay */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget) {
              setShowSettings(false);
            }
          }}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-gray-300 w-80 max-w-[90vw] absolute"
            style={{
              top: settingsButtonRef.current 
                ? settingsButtonRef.current.getBoundingClientRect().top - 320 
                : '10vh',
              left: settingsButtonRef.current 
                ? settingsButtonRef.current.getBoundingClientRect().left - 244
                : '10vw',
              boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-3 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-800">Voice Settings</h3>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Speed Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-gray-600">Speed: {speed.toFixed(2)}x</label>
                  <span className="text-xs text-gray-500">
                    {speed < 0.9 ? 'Slower' : speed > 1.1 ? 'Faster' : 'Normal'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.7" 
                  max="1.3" 
                  step="0.05" 
                  value={speed} 
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0.7x</span>
                  <span>1.3x</span>
                </div>
              </div>

              {/* Stability Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-gray-600">Stability: {stability.toFixed(2)}</label>
                  <span className="text-xs text-gray-500">
                    {stability < 0.3 ? 'More Variable' : stability > 0.7 ? 'More Stable' : 'Balanced'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={stability} 
                  onChange={(e) => setStability(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0</span>
                  <span>1</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Higher values result in more consistent outputs, lower values allow for more variation. 
                </div>
              </div>

              {/* Similarity Boost Slider */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm text-gray-600">Similarity Boost: {similarityBoost.toFixed(2)}</label>
                  <span className="text-xs text-gray-500">
                    {similarityBoost < 0.3 ? 'More Creative' : similarityBoost > 0.7 ? 'More Similar' : 'Balanced'}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={similarityBoost} 
                  onChange={(e) => setSimilarityBoost(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>0</span>
                  <span>1</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Higher values result in more accurate cloning of the original voice, lower values allow more creativity.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden audio element */}
      <div className="hidden">
        <audio
          ref={audioRef}
          src={audioSrc || ''}
          onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
          onEnded={() => setIsPlaying(false)}
          data-testid="audio-element"
        />
      </div>
    </div>
  );
};

export default memo(SceneAudioControls);