import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene } from '../project/ProjectProvider';
import { useProject } from '../project/ProjectProvider';
import { getSceneContainerClassName } from '@/utils/scene';
import { SceneMediaPlayer } from './SceneMediaPlayer';
import { SceneTextContent } from './SceneTextContent';
import { SceneAudioControls } from '../audio/SceneAudioControls';
import { SceneHeader } from './SceneHeader';
import { cleanPostText, getWordCount } from '@/utils/scene/event-handlers';
import { GripVertical } from 'lucide-react';
import { SceneActions } from './SceneActions';
import { SceneVoiceSettings } from './SceneVoiceSettings';
import { getAvailableVoices, generateVoice, persistVoiceAudio } from '@/lib/api-client';
import { Voice, VoiceSettings, GenerateVoiceResponse, SaveAudioRequest, SaveAudioResponse } from '@/lib/api-types';
import { useAudioContext } from '@/contexts/AudioContext';
import { fetchStoredAudio, cleanupAudioUrl } from '@/utils/scene/audio-utils';

/**
 * Props for the SceneContainer component
 */
interface SceneContainerProps {
  /** Scene data containing content and media information */
  scene: Scene;
  /** Preview URL for the scene's media content */
  preview: string | null;
  /** Index of the scene in the project */
  index: number;
  /** Callback to remove a scene */
  onSceneRemove: (id: string) => void;
  /** Callback when a scene is being moved (during drag) */
  onSceneMove: (id: string, newIndex: number) => void;
  /** Callback when a scene's position is finalized */
  onSceneReorder: (id: string, newIndex: number) => void;
  /** Whether the scene is in reorder mode */
  reorderMode?: boolean;
  /** Whether the scene is read-only */
  readOnly?: boolean;
  /** Reference to the text editor element */
  editorRef?: React.RefObject<HTMLTextAreaElement>;
  /** Whether the scene is currently being dragged */
  isDragging?: boolean;
  /** Whether to display the scene at full width */
  isFullWidth?: boolean;
  /** Custom styles for the scene component */
  customStyles?: React.CSSProperties;
  /** Feature flag to use the new SceneAudioControls component instead of built-in audio controls */
  useNewAudioControls?: boolean;
  /** Children components */
  children?: React.ReactNode;
  /** Callback to delete a scene */
  onDelete: () => void;
}

// Define extended voice settings interface to ensure proper typing with both keys
interface SceneVoiceSettingsState {
  voice_id?: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean; // This is the property in our local state
  speed: number;
}

// Type that maps between our component state and the API format
interface VoiceSettingsForAPI {
  voice_id: string;
  stability: number;
  similarity_boost: number;
  style: number;
  speaker_boost: boolean;
  speed: number;
}

/**
 * Container component for scene-related components
 * This component will coordinate state and interactions between scene components
 */
export const SceneContainer: React.FC<SceneContainerProps> = ({
  scene,
  preview,
  index,
  onSceneRemove,
  onSceneMove,
  onSceneReorder,
  reorderMode = false,
  readOnly = false,
  editorRef,
  isDragging = false,
  isFullWidth = false,
  customStyles = {},
  useNewAudioControls = false,
  children,
  onDelete
}) => {
  const { currentProject, updateSceneText, updateSceneAudio } = useProject();
  const { audioState, setAudioPlaying, setAudioVolume } = useAudioContext();
  
  // Add state for view mode
  const [isCompactView, setIsCompactView] = useState(true);
  
  // Add state for info section
  const [showInfo, setShowInfo] = useState(false);
  
  // Add state for text editing
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text));
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
  // Add state for audio generation
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(
    scene.audio?.persistentUrl || scene.audio?.audio_url || null
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(audioState.volume);
  // Add playback speed state
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // Add confirmation state for scene removal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add state for voice settings
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceId, setVoiceId] = useState<string>(scene.voice_settings?.voice_id || "");
  const [voiceSettings, setVoiceSettings] = useState<SceneVoiceSettingsState>({
    stability: scene.voice_settings?.stability || 0.5,
    similarity_boost: scene.voice_settings?.similarity_boost || 0.75,
    style: scene.voice_settings?.style || 0.5,
    speaker_boost: scene.voice_settings?.speaker_boost || true,
    speed: scene.voice_settings?.speed || 1.0
  });

  // Audio playback handlers
  const handlePlayPauseToggle = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setAudioPlaying(false);
    } else {
      audioRef.current.play().catch(error => {
        console.error('Error playing audio:', error);
      });
      setIsPlaying(true);
      setAudioPlaying(true, scene.id);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setAudioVolume(newVolume);
  };

  // Add playback speed handler
  const handlePlaybackSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };

  // Add event listeners for audio playback
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    if (audioElement) {
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);
      audioElement.volume = volume;
      // Set playback speed on audio element when it's available
      audioElement.playbackRate = playbackSpeed;
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioRef.current, volume, playbackSpeed]);

  // Handle view mode toggle
  const handleViewModeToggle = () => {
    setIsCompactView(!isCompactView);
  };

  // Handle info toggle
  const handleToggleInfo = () => {
    setShowInfo(prev => !prev);
  };

  // Text content handlers
  const handleTextChange = (newText: string) => {
    setText(newText);
  };

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleSaveText = () => {
    updateSceneText(scene.id, text);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setText(cleanPostText(scene.text));
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSaveText();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleToggleTextExpand = () => {
    setIsTextExpanded(!isTextExpanded);
  };

  // Voice settings handlers
  const handleVoiceChange = (newVoiceId: string) => {
    setVoiceId(newVoiceId);
    
    // Update scene voice settings in the project
    if (scene.voice_settings) {
      updateSceneAudio(scene.id, scene.audio || {}, {
        ...scene.voice_settings,
        voice_id: newVoiceId
      });
    } else {
      // Create new voice settings object if it doesn't exist
      updateSceneAudio(scene.id, scene.audio || {}, {
        voice_id: newVoiceId,
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarity_boost,
        style: voiceSettings.style,
        speaker_boost: voiceSettings.speaker_boost,
        speed: voiceSettings.speed
      });
    }
  };

  const handleVoiceSettingsChange = (settings: Partial<SceneVoiceSettingsState>) => {
    const updatedSettings = { ...voiceSettings, ...settings };
    setVoiceSettings(updatedSettings);
    
    // Update scene voice settings in the project
    if (scene.voice_settings) {
      updateSceneAudio(scene.id, scene.audio || {}, {
        ...scene.voice_settings,
        ...settings
      });
    }
  };

  // Handle audio regeneration
  const handleRegenerateVoice = () => {
    handleGenerateVoice();
  };

  // Handle voice generation
  const handleGenerateVoice = async () => {
    if (!voiceId) {
      // TODO: Better error handling
      console.error('No voice selected');
      return;
    }

    if (!text.trim()) {
      // TODO: Better error handling
      console.error('No text to generate audio for');
      return;
    }

    setIsGeneratingAudio(true);
    setAudioError(null);

    try {
      const result = await generateVoice({
        text,
        voice_id: voiceId,
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarity_boost,
        style: voiceSettings.style,
        use_speaker_boost: voiceSettings.speaker_boost,
        output_format: "mp3_44100_128",
        speed: voiceSettings.speed
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      const { audio_base64 } = result.data!;
      
      // Create blob URL for audio playback
      const blob = new Blob(
        [Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      );
      const url = URL.createObjectURL(blob);
      setAudioSrc(url);

      // Prepare audio data for storage
      const audioData = {
        audio_base64,
        content_type: 'audio/mp3',
        audio_url: url,
        generated_at: Date.now(),
        character_count: result.data.character_count
      };

      // Prepare voice settings for storage - map to the expected scene component format
      const updatedVoiceSettings: VoiceSettingsForAPI = {
        voice_id: voiceId,
        stability: voiceSettings.stability,
        similarity_boost: voiceSettings.similarity_boost,
        style: voiceSettings.style,
        speaker_boost: voiceSettings.speaker_boost,
        speed: voiceSettings.speed
      };

      // Update scene with audio data
      updateSceneAudio(scene.id, audioData, updatedVoiceSettings);

      // Persist audio to storage if project ID is available
      if (currentProject?.id) {
        try {
          const persistResult = await persistVoiceAudio({
            audio_base64,
            content_type: 'audio/mp3',
            project_id: currentProject.id,
            scene_id: scene.id,
            voice_id: voiceId
          });

          if (persistResult.error) {
            console.error('Error persisting audio:', persistResult.error);
          } else if (persistResult.data?.success) {
            // Update scene with persistent URL
            const audioDataWithUrl = {
              ...audioData,
              persistentUrl: persistResult.data.url,
              storageKey: persistResult.data.storage_key
            };
            
            // Update scene with audio data and the same voice settings
            updateSceneAudio(scene.id, audioDataWithUrl, updatedVoiceSettings);
          }
        } catch (error) {
          console.error('Error persisting audio:', error);
        }
      }
    } catch (error) {
      console.error('Error generating audio:', error);
      setAudioError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  // Handle media trim change
  const handleTrimChange = (start: number, end: number) => {
    if (scene.media) {
      // Update local state if needed (for UI feedback)
      // Later we'll add the actual media update to the backend
      console.log(`Trim changed for scene ${scene.id}: ${start} - ${end}`);
      
      // TODO: Implement proper media update handling
      // This would update the scene.media.trim property in the project context
    }
  };

  // Transform scene.media to match SceneMediaPlayer's expected format
  const mediaProps = scene.media ? {
    url: scene.media.url,
    storedUrl: scene.media.storedUrl,
    type: scene.media.type,
    trim: scene.media.trim,
    storageKey: scene.media.storageKey,
    isStorageBacked: scene.media.isStorageBacked
  } : null;

  // Handle scene removal with confirmation
  const handleSceneRemove = () => {
    if (showDeleteConfirm) {
      onSceneRemove(scene.id);
      setShowDeleteConfirm(false);
    } else {
      setShowDeleteConfirm(true);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.currentTarget.classList.add('opacity-50');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('opacity-50');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('border-blue-500');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('border-blue-500');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('border-blue-500');
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    if (onSceneReorder && dragIndex !== index) {
      onSceneReorder(scene.id, dragIndex);
    }
  };

  // Add useEffect to fetch stored audio on component mount
  useEffect(() => {
    const loadStoredAudio = async () => {
      if (currentProject?.id) {
        // Create a wrapper function to correctly adapt the updateSceneAudio to the required signature
        const updateAudioWrapper = (
          sceneId: string, 
          audio: NonNullable<Scene['audio']>, 
          voiceSettings: VoiceSettings
        ) => {
          // Create a new object that matches the Scene['voice_settings'] structure
          const adaptedVoiceSettings = {
            voice_id: voiceId, // Use the current voiceId from component state
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarity_boost,
            style: voiceSettings.style ?? 0,
            speaker_boost: voiceSettings.use_speaker_boost ?? false, 
            speed: voiceSettings.speed ?? 1.0
          };
          
          updateSceneAudio(sceneId, audio, adaptedVoiceSettings);
        };
        
        await fetchStoredAudio(
          currentProject.id,
          scene.id,
          scene,
          setAudioSrc,
          updateAudioWrapper,
          voiceId
        );
      }
    };
    
    loadStoredAudio();
    
    // Cleanup function to revoke blob URLs when component unmounts
    return () => {
      cleanupAudioUrl(audioSrc);
    };
  }, [scene.id, scene.audio, currentProject?.id, updateSceneAudio, voiceId, scene.voice_settings]);

  return (
    <div
      id={`scene-${scene.id}`}
      className="scene-component relative mb-4 bg-white rounded-md border opacity-100 transition-opacity duration-500 shadow-sm"
      data-testid="scene-component"
      data-scene-id={scene.id}
      style={{ maxWidth: '100%', minHeight: '200px' }}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Scene Header with Number and Controls */}
      <SceneHeader
        index={index}
        isCompactView={isCompactView}
        showInfo={showInfo}
        onToggleViewMode={handleViewModeToggle}
        onToggleInfo={handleToggleInfo}
      />

      <div className="flex flex-col h-full">
        {/* Media section wrapper */}
        <div className="h-[190px]" data-testid="scene-media">
          <SceneMediaPlayer
            projectId={currentProject?.id || ''}
            sceneId={scene.id}
            media={mediaProps}
            isCompactView={isCompactView}
            onToggleViewMode={handleViewModeToggle}
          />
        </div>

        {/* Text content section */}
        <div className="p-2 flex-grow" data-testid="scene-text-content">
          <SceneTextContent
            text={text}
            isEditing={isEditing}
            isTextExpanded={isTextExpanded}
            onTextChange={handleTextChange}
            onStartEditing={handleStartEditing}
            onSaveText={handleSaveText}
            onCancelEdit={handleCancelEdit}
            onKeyDown={handleKeyDown}
            onToggleTextExpand={handleToggleTextExpand}
            readOnly={readOnly}
            wordCount={getWordCount(text)}
            originalText={scene.text}
          />
        </div>

        {/* Voice settings and generation */}
        <div className="p-2 border-t border-gray-100">
          <SceneVoiceSettings
            voiceId={voiceId}
            voiceSettings={voiceSettings as VoiceSettings}
            isGenerating={isGeneratingAudio}
            audioError={audioError}
            onVoiceChange={handleVoiceChange}
            onSettingsChange={handleVoiceSettingsChange}
            onGenerateClick={handleGenerateVoice}
          />
        </div>

        {/* Audio controls section */}
        {audioSrc && (
          <div className="mt-1 border-t border-gray-100">
            <SceneAudioControls
              key={`audio-controls-${scene.id}`}
              sceneId={scene.id}
              audioSource={audioSrc}
              isGeneratingAudio={isGeneratingAudio}
              onGenerateClick={handleGenerateVoice}
              onRegenerateClick={handleRegenerateVoice}
              onVoiceChange={handleVoiceChange}
              onRateChange={handlePlaybackSpeedChange}
            />
          </div>
        )}

        {/* Audio element for playback */}
        {audioSrc && (
          <audio 
            ref={audioRef} 
            src={audioSrc} 
            preload="metadata" 
            className="hidden"
          />
        )}

        {/* Delete button */}
        {showDeleteConfirm ? (
          <div className="absolute bottom-0 right-0 flex items-center bg-red-50 rounded-bl-md rounded-tr-md overflow-hidden">
            <button
              onClick={handleCancelDelete}
              className="px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
              data-testid="cancel-delete-button"
            >
              Cancel
            </button>
            <button
              onClick={handleSceneRemove}
              className="px-2 py-1 text-xs text-white bg-red-600 hover:bg-red-700"
              data-testid="confirm-delete-button"
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="absolute bottom-0 right-0">
            <SceneActions
              onDelete={handleSceneRemove}
              className="mt-auto"
            />
          </div>
        )}
      </div>
    </div>
  );
}; 