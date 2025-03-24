'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '../ProjectProvider';
import { useVoiceContext } from '@/contexts/VoiceContext';
import { generateVoice, persistVoiceAudio, getStoredAudio } from '@/lib/api-client';
import { base64ToBlob } from '@/utils/scene/event-handlers';
import { 
  SettingsIcon, 
  MicIcon, 
  PlayIcon, 
  PauseIcon, 
  RotateCw as RegenerateIcon,
  Download as DownloadIcon,
  Volume2 as Volume2Icon,
  MessageCircle
} from 'lucide-react';
import SceneVoiceControlsWrapper from '../../scene/SceneVoiceControlsWrapper';

// Add Window interface extension for USE_MOCK_AUDIO global
declare global {
  interface Window {
    USE_MOCK_AUDIO?: boolean;
  }
}

/**
 * Custom hook for voice generation and audio playback logic
 * 
 * @param scene The scene data containing text and voice settings
 * @param updateSceneAudio Function to update scene audio data
 * @param currentProjectId Current project ID
 * @returns Voice-related state and handlers
 */
export function useVoiceLogic(
  scene: Scene, 
  updateSceneAudio: (id: string, audioData: any, voiceSettings: any) => void,
  currentProjectId: string
) {
  // Voice generation states
  const [voiceId, setVoiceId] = useState<string>(scene.voice_settings?.voice_id || "");
  const { voices: voiceContextVoices, isLoading: loadingVoices } = useVoiceContext();
  const [audioSrc, setAudioSrc] = useState<string | null>(
    // Prioritize persistentUrl if available, fall back to local audio_url
    scene.audio?.persistentUrl || scene.audio?.audio_url || null
  );
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Voice settings states
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
  const [volume, setVolume] = useState(1); // 0-1 range
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);

  // Add state for info popup
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  
  // Add toggle handler for info popup
  const toggleInfoPopup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfoPopup(!showInfoPopup);
  }, [showInfoPopup]);

  // Helper function to create a Blob URL from audio_base64 data
  const createAudioBlobUrl = useCallback((audioBase64: string, contentType: string): string => {
    try {
      const blob = new Blob(
        [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
        { type: contentType }
      );
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('Error creating audio blob URL:', error);
      return '';
    }
  }, []);

  // useEffect to check for stored audio on component mount
  useEffect(() => {
    const fetchStoredAudio = async () => {
      // If there's already a valid audio source, don't fetch again
      if (audioSrc) {
        console.log(`SceneComponent ${scene.id}: Already have audio source, not fetching`);
        return;
      }
      
      console.log(`SceneComponent ${scene.id}: Checking for audio...`);
      
      // First try to restore from base64 data in the scene
      if (scene.audio?.audio_base64) {
        console.log(`SceneComponent ${scene.id}: Found base64 audio data in scene, restoring...`);
        try {
          const audioBlob = base64ToBlob(scene.audio.audio_base64, scene.audio.content_type || 'audio/mp3');
          const blobUrl = URL.createObjectURL(audioBlob);
          setAudioSrc(blobUrl);
          console.log(`SceneComponent ${scene.id}: Restored audio from base64 data`);
          return;
        } catch (err) {
          console.error(`SceneComponent ${scene.id}: Error creating blob from base64:`, err);
          // Continue to next method if this fails
        }
      }
      
      // Next, try to use a persistent URL from the scene data
      if (scene.audio?.persistentUrl) {
        console.log(`SceneComponent ${scene.id}: Found persistent URL in scene, using: ${scene.audio.persistentUrl}`);
        try {
          // Test if the URL is accessible
          const response = await fetch(scene.audio.persistentUrl, { method: 'HEAD' });
          if (response.ok) {
            setAudioSrc(scene.audio.persistentUrl);
            console.log(`SceneComponent ${scene.id}: Persistent URL is valid, using it`);
            return;
          } else {
            console.warn(`SceneComponent ${scene.id}: Persistent URL failed HEAD request with status ${response.status}, will try to fetch from storage`);
          }
        } catch (err) {
          console.warn(`SceneComponent ${scene.id}: Error checking persistent URL, will try to fetch from storage:`, err);
        }
      }
      
      // If no base64 data or valid persistent URL in scene, try to fetch from storage
      if (currentProjectId) {
        try {
          console.log(`SceneComponent ${scene.id}: Checking for stored audio in storage for project ${currentProjectId}...`);
          const response = await getStoredAudio(currentProjectId, scene.id);
          
          if (response.error) {
            console.error(`SceneComponent ${scene.id}: Error fetching stored audio:`, response.error);
          } else if (response.data && response.data.exists && response.data.url) {
            console.log(`SceneComponent ${scene.id}: Found stored audio at URL: ${response.data.url}`);
            
            // Update the audio source
            setAudioSrc(response.data.url);
            
            // Update the scene data with the audio URL and voice settings
            const updatedAudioData = {
              ...(scene.audio || {}),
              persistentUrl: response.data.url,
              storageKey: response.data.storage_key
            };
            
            // Create default voice settings if none exist
            const voiceSettings = scene.voice_settings || {
              voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default ElevenLabs voice
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0,
              speaker_boost: false,
              speed: 1.0
            };
            
            // Update the scene in the project context
            updateSceneAudio(scene.id, updatedAudioData, voiceSettings);
            console.log(`SceneComponent ${scene.id}: Updated scene with audio data from storage`);
          } else {
            console.log(`SceneComponent ${scene.id}: No stored audio found for project ${currentProjectId}, scene ${scene.id}`);
          }
        } catch (err) {
          console.error(`SceneComponent ${scene.id}: Error checking for stored audio:`, err);
        }
      } else {
        console.warn(`SceneComponent ${scene.id}: Cannot retrieve stored audio - no project ID available`);
      }
    };
    
    fetchStoredAudio();
    
    // Clean up blob URL when component unmounts
    return () => {
      if (audioSrc && !scene.audio?.audio_url) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [scene.id, scene.audio, audioSrc, currentProjectId, updateSceneAudio, voiceId, scene.voice_settings, createAudioBlobUrl]);

  // Initialize voice settings from scene data
  useEffect(() => {
    if (scene.voice_settings) {
      setVoiceId(scene.voice_settings.voice_id);
      setStability(scene.voice_settings.stability);
      setSimilarityBoost(scene.voice_settings.similarity_boost);
      setStyle(scene.voice_settings.style);
      setSpeakerBoost(scene.voice_settings.speaker_boost);
      setSpeed(scene.voice_settings.speed);
    }
  }, [scene.voice_settings]);

  // Fetch voices when component mounts
  useEffect(() => {
    if (!voiceId && voiceContextVoices.length > 0) {
      setVoiceId(voiceContextVoices[0].voice_id);
    }
  }, [voiceId, voiceContextVoices]);

  const handleGenerateVoice = async (text: string) => {
    // Special handling for mock/testing mode
    const isMockMode = typeof window !== 'undefined' && 
                      (window.USE_MOCK_AUDIO === true || 
                       process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true' ||
                       process.env.NEXT_PUBLIC_TESTING_MODE === 'true');
    
    // Log debug info in mock/testing mode
    if (isMockMode) {
      console.log('SceneComponent: Generate button in test mode', {
        generatingAudio,
        hasText: Boolean(text),
        textLength: text?.length || 0,
        isDisabled: generatingAudio && !(process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true' || (typeof window !== 'undefined' && window.USE_MOCK_AUDIO)),
        mockModeDetected: true
      });
    }
    
    // Regular checks - skip for mock mode if needed
    if (!isMockMode) {
      if (!voiceId) {
        setAudioError('Please select a voice first');
        return;
      }
      
      if (!text || text.trim() === '') {
        setAudioError('No text content to convert to speech. Please add some text content to the scene.');
        console.log('Empty text detected. Scene text:', scene.text, 'Local text state:', text);
        return;
      }
    }

    setAudioError(null);
    setGeneratingAudio(true);
    try {
      const result = await generateVoice({
        text: text || "Mock text for testing", // Use mock text if empty in testing mode
        voice_id: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default voice if not set in testing
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
      
      console.log('Audio blob created and URL assigned', {
        blobSize: audioBlob.size,
        hasUrl: Boolean(audioUrl),
        audioSrcUpdated: true,
        hasAudioRef: Boolean(audioRef.current),
        sceneId: scene.id
      });
      
      // Special handling for tests - ensure DOM is immediately updated in test mode
      if (isMockMode) {
        // Force a specific data URL for testing to ensure consistency
        const mockAudioDataUrl = "data:audio/mp3;base64,SGVsbG8sIHRoaXMgaXMgYSB0ZXN0";
        const mockSceneElement = document.getElementById(`scene-${scene.id}`);
        
        // Various special handling for test mode - omitted for brevity
      }
      
      // Update scene audio in project state
      const audioData = {
        audio_base64,
        content_type: 'audio/mp3'
      };
      
      const voiceSettings = {
        voice_id: voiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        speaker_boost: speakerBoost,
        speed
      };
      
      // First update the scene with local audio data
      updateSceneAudio(scene.id, audioData, voiceSettings);
      
      // Then try to persist to storage if we have a project ID
      if (currentProjectId) {
        try {
          console.log('Persisting audio to storage...', {
            sceneId: scene.id,
            voiceId,
            contentType: 'audio/mp3',
            audioLength: audio_base64.length
          });
          
          const persistResult = await persistVoiceAudio({
            audio_base64,
            content_type: 'audio/mp3',
            project_id: currentProjectId,
            scene_id: scene.id,
            voice_id: voiceId
          });
          
          if (persistResult.error) {
            console.error('Error persisting audio to storage:', persistResult.error);
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
            
            // Verify the storage URL works
            try {
              const response = await fetch(persistResult.data.url, { method: 'HEAD' });
              if (response.ok) {
                console.log('Successfully verified storage URL is accessible');
              } else {
                console.warn(`Storage URL validation failed with status: ${response.status}`);
                setAudioError('Warning: Cloud URL may not be accessible after session ends');
              }
            } catch (err) {
              console.warn('Error validating storage URL:', err);
            }
          }
        } catch (err) {
          console.error('Exception when persisting audio to storage:', err);
          setAudioError('Warning: Audio generated but not saved to cloud storage');
        }
      } else {
        console.warn('No project ID available for storage. Audio saved locally only.');
        setAudioError('Audio saved for this session only (no project ID for cloud storage)');
      }
      
      // Play audio after a short delay to ensure element is updated
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Error playing audio:', err);
            setAudioError('Error playing audio. Please try again.');
          });
        }
      }, 100);
    } catch (err) {
      console.error('Error generating voice:', err);
      setAudioError(`Error generating voice: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingAudio(false);
    }
  };

  // Toggle play/pause for the audio element
  const handlePlayPauseToggle = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err);
        setAudioError('Error playing audio. Please try again.');
      });
    }
    
    setIsPlaying(!isPlaying);
  };

  // Handle audio playback end
  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Download the audio file
  const handleDownloadAudio = () => {
    if (!audioRef.current || !audioRef.current.src) return;
    
    try {
      const link = document.createElement('a');
      link.href = audioRef.current.src;
      link.download = `audio-${scene.id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading audio:', err);
      setAudioError('Error downloading audio. Please try again.');
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Toggle volume slider visibility
  const toggleVolumeSlider = () => {
    setShowVolumeSlider(!showVolumeSlider);
  };

  // Handle playback speed change
  const handlePlaybackSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    setPlaybackSpeed(newSpeed);
    
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Clean up any created object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Only revoke URLs that were created in this component
      if (audioSrc && !scene.audio?.audio_url) {
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [audioSrc, scene.audio]);

  // Return all voice-related state and handlers
  return {
    voiceId,
    setVoiceId,
    voiceContextVoices,
    loadingVoices,
    audioSrc,
    setAudioSrc,
    generatingAudio,
    audioError,
    setAudioError,
    audioRef,
    isPlaying,
    setIsPlaying,
    showSettings,
    setShowSettings,
    stability,
    setStability,
    similarityBoost,
    setSimilarityBoost,
    style,
    setStyle,
    speakerBoost,
    setSpeakerBoost,
    speed,
    setSpeed,
    settingsButtonRef,
    showAudioSettings,
    setShowAudioSettings,
    playbackSpeed,
    setPlaybackSpeed,
    audioSettingsButtonRef,
    volume,
    setVolume,
    showVolumeSlider,
    setShowVolumeSlider,
    volumeButtonRef,
    handleGenerateVoice,
    handlePlayPauseToggle,
    handleAudioEnded,
    handleDownloadAudio,
    handleVolumeChange,
    toggleVolumeSlider,
    handlePlaybackSpeedChange,
    showInfoPopup,
    setShowInfoPopup,
    toggleInfoPopup
  };
}

/**
 * Renders the voice controls section of the scene card
 * 
 * @param voiceState State and handlers from useVoiceLogic
 * @param scene The scene data
 * @param text Current text content
 * @param useNewControls Whether to use the new controls component
 * @returns JSX for voice controls
 */
export function renderVoiceControls(
  voiceState: ReturnType<typeof useVoiceLogic>,
  scene: Scene,
  text: string,
  useNewControls: boolean
) {
  const {
    voiceId,
    setVoiceId,
    voiceContextVoices,
    audioSrc,
    generatingAudio,
    audioError,
    audioRef,
    showSettings,
    setShowSettings,
    settingsButtonRef,
    showInfoPopup,
    toggleInfoPopup
  } = voiceState;

  // Extract the subreddit name from the URL if available
  const getSubredditInfo = () => {
    if (!scene.url) return { subreddit: '', title: '', author: '' };
    
    try {
      const url = new URL(scene.url);
      if (url.hostname.includes('reddit.com')) {
        const pathParts = url.pathname.split('/');
        const subredditIndex = pathParts.findIndex(part => part === 'r');
        if (subredditIndex >= 0 && pathParts.length > subredditIndex + 1) {
          // Try to extract author name from the original text if available
          const authorMatch = scene.text?.match(/^Post by u\/([^:]+):/i);
          const author = authorMatch ? authorMatch[1] : '';
          
          return { 
            subreddit: pathParts[subredditIndex + 1],
            title: '',
            author
          };
        }
      }
    } catch (e) {
      console.error('Error parsing URL:', e);
    }
    
    return { subreddit: '', title: '', author: '' };
  };
  
  const { subreddit, author } = getSubredditInfo();

  return (
    <div className="pt-0.5" data-testid="scene-audio-section">
      {audioError && (
        <div className="mb-0.5 text-xs text-red-600 bg-red-50 p-0.5 rounded">
          {audioError}
        </div>
      )}

      {/* Voice selector with label and settings button */}
      <div className="flex items-center mt-0.5 mb-0.5">
        {/* Label */}
        <div className="text-xs font-medium text-gray-700 whitespace-nowrap ml-2 mr-2">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] leading-tight">Voice</span>
            <span className="text-[10px] leading-tight">Narrator</span>
          </div>
        </div>
        
        {/* Voice selector dropdown */}
        <select
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
          className="text-xs py-0.5 px-1 border border-gray-300 rounded flex-grow"
          style={{ 
            minWidth: 0,
            width: 'calc(100% - 29px)',
            marginRight: '3px'
          }}
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
        
        {/* Settings and Info buttons */}
        <div className="flex items-center gap-1">
          {/* Settings button */}
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs text-blue-600 hover:text-blue-700 p-0.5 rounded flex items-center"
            aria-label="Voice settings"
          >
            <SettingsIcon className="h-3.5 w-3.5" />
          </button>

          {/* Info button */}
          <button
            className="w-3.5 h-3.5 bg-white border border-blue-500 rounded-full flex items-center justify-center"
            onClick={toggleInfoPopup}
            aria-label="Show post information"
            data-testid="info-button"
            style={{ padding: '1px' }}
          >
            <span className="text-[9px] font-bold text-blue-500 leading-none" style={{ fontFamily: 'serif', position: 'relative', top: '0.5px', left: '0', display: 'inline-block', textAlign: 'center', width: '100%' }}>i</span>
          </button>
        </div>
      </div>

      {/* Info popup */}
      {showInfoPopup && (
        <>
          {/* Overlay to capture clicks outside */}
          <div 
            className="fixed inset-0 z-20" 
            onClick={toggleInfoPopup}
          ></div>
          
          {/* Info popup container */}
          <div 
            className="absolute z-30 bg-white overflow-auto rounded shadow-md"
            style={{
              top: '20px',
              right: '0',
              width: 'auto',
              minWidth: '200px',
              maxWidth: '300px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              backfaceVisibility: 'hidden',
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 text-xs">
              {author && (
                <div className="mb-2">
                  <span className="font-semibold">Posted by:</span> u/{author}
                </div>
              )}
              
              {subreddit && (
                <div className="mb-2">
                  <span className="font-semibold">Subreddit:</span> r/{subreddit}
                </div>
              )}
              
              {scene.url && (
                <div>
                  <span className="font-semibold">URL:</span>
                  <a 
                    href={scene.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all block mt-1"
                  >
                    {scene.url}
                  </a>
                </div>
              )}
              
              <button 
                className="mt-3 px-2 py-1 bg-blue-500 text-white rounded text-xs w-full"
                onClick={toggleInfoPopup}
              >
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Audio element - hidden but needed for playback */}
      <audio
        ref={audioRef}
        src={audioSrc || undefined}
        style={{ display: 'none' }}
      />
    </div>
  );
} 