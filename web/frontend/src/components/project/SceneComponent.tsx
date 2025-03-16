'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Scene } from './ProjectProvider';
import {
  Trash2 as TrashIcon,
  Edit as EditIcon,
  GripVertical as GripVerticalIcon,
  RefreshCw as RefreshIcon,
  Volume2 as Volume2Icon,
  Settings as SettingsIcon,
  X as XIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  Type as TypeIcon,
  Play as PlayIcon,
  Pause as PauseIcon,
  RotateCw as RegenerateIcon,
  MoreVertical as MoreVerticalIcon,
  Download as DownloadIcon,
  Mic as MicIcon
} from 'lucide-react';
import Image from 'next/image';
import ErrorDisplay from '../ErrorDisplay';
import { transformRedditVideoUrl } from '@/lib/media-utils';
import { useProject } from './ProjectProvider';
import { getAvailableVoices, generateVoice, persistVoiceAudio, getStoredAudio } from '@/lib/api-client';
import SceneAudioControls from '../audio/SceneAudioControls';

/**
 * Utility function to clean post text by removing "Post by u/Username:" prefix
 * @param text - The text to clean
 * @returns The cleaned text without the username prefix
 */
const cleanPostText = (text: string): string => {
  return text.replace(/^Post by u\/[^:]+:\s*/i, '');
};

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
  } catch (err) {
    console.error('Error converting base64 to blob:', err);
    // Fallback method
    return new Blob(
      [Uint8Array.from(atob(base64), c => c.charCodeAt(0))],
      { type: contentType }
    );
  }
};

/**
 * Props for the SceneComponent
 * @interface SceneComponentProps
 */
interface SceneComponentProps {
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
}

/**
 * A component that displays and manages a single scene in a project.
 * Handles media display, text content, drag-and-drop reordering, and scene actions.
 * 
 * Features:
 * - Media preview with support for images, videos, and galleries
 * - Text content display and editing
 * - Drag and drop reordering
 * - Scene removal
 * - Error handling for media loading
 * - Responsive design
 * - Accessibility support
 * 
 * @component
 * @example
 * ```tsx
 * <SceneComponent
 *   scene={{
 *     id: "scene1",
 *     url: "https://example.com",
 *     media: { type: "image", url: "https://example.com/image.jpg" },
 *     text: "Example scene content"
 *   }}
 *   preview="https://example.com/preview.jpg"
 *   index={0}
 *   onSceneRemove={(id) => handleRemove(id)}
 *   onSceneMove={(id, index) => handleMove(id, index)}
 *   onSceneReorder={(id, index) => handleReorder(id, index)}
 * />
 * ```
 */
export const SceneComponent: React.FC<SceneComponentProps> = memo(function SceneComponent({
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
  useNewAudioControls = false
}: SceneComponentProps) {
  // Use new controls for all scenes
  const useNewControls = useNewAudioControls;
  
  const { mode, updateSceneText, updateSceneAudio, currentProject } = useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text));
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [manuallyRemoving, setManuallyRemoving] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const removingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localPreview = useRef<string | null>(null);
  const isRemovedRef = useRef<boolean>(false);
  
  // Voice generation states
  const [voiceId, setVoiceId] = useState<string>(scene.voice_settings?.voice_id || "");
  const [voices, setVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
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
  
  // Text expansion state
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
  // Volume controls
  const [volume, setVolume] = useState(1); // 0-1 range
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
  
  // Store local preview reference for potential fallbacks
  useEffect(() => {
    if (preview && !localPreview.current) {
      localPreview.current = preview;
    }
  }, [preview]);

  // Reset removing state if component gets new scene
  useEffect(() => {
    return () => {
      if (removingTimeoutRef.current) {
        clearTimeout(removingTimeoutRef.current);
      }
    };
  }, []);

  // Update text state when scene.text changes
  useEffect(() => {
    setText(cleanPostText(scene.text));
  }, [scene.text]);

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
      if (currentProject?.id) {
        try {
          console.log(`SceneComponent ${scene.id}: Checking for stored audio in storage for project ${currentProject.id}...`);
          const response = await getStoredAudio(currentProject.id, scene.id);
          
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
            console.log(`SceneComponent ${scene.id}: No stored audio found for project ${currentProject.id}, scene ${scene.id}`);
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
      if (audioSrc && audioSrc.startsWith('blob:')) {
        console.log(`SceneComponent ${scene.id}: Cleaning up blob URL`);
        URL.revokeObjectURL(audioSrc);
      }
    };
  }, [scene.id, scene.audio, audioSrc, currentProject, updateSceneAudio, voiceId, scene.voice_settings]);

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
    if (voices.length === 0 && !loadingVoices) {
      fetchVoices();
      
      // Ensure text is updated
      setText(cleanPostText(scene.text));
    }
  }, [scene.text, voices.length, loadingVoices]);

  const fetchVoices = async () => {
    setLoadingVoices(true);
    setAudioError(null);
    try {
      const response = await getAvailableVoices();
      
      if (response.error) {
        setAudioError(`Error fetching voices: ${response.error.message}`);
        setVoices([]);
      } else {
        setVoices(response.data.voices);
        // Only set voice ID if it's not already set from scene.voice_settings
        if (response.data.voices.length > 0 && !voiceId) {
          setVoiceId(response.data.voices[0].voice_id);
        }
      }
    } catch (err) {
      setAudioError(`Error fetching voices: ${err instanceof Error ? err.message : String(err)}`);
      setVoices([]);
    } finally {
      setLoadingVoices(false);
    }
  };

  const handleGenerateVoice = async () => {
    if (!voiceId) {
      setAudioError('Please select a voice first');
      return;
    }
    
    if (!text || text.trim() === '') {
      setAudioError('No text content to convert to speech. Please add some text content to the scene.');
      console.log('Empty text detected. Scene text:', scene.text, 'Local text state:', text);
      return;
    }

    setAudioError(null);
    setGeneratingAudio(true);
    try {
      const result = await generateVoice({
        text,
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
            
            // Verify the storage URL works by doing a HEAD request
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
    } catch (err) {
      console.error('Error generating voice:', err);
      setAudioError(`Error generating voice: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setGeneratingAudio(false);
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleTextBlur = () => {
    // Auto-save on blur (clicking away)
    saveText();
  };

  const saveText = () => {
    // Only save if text has changed
    if (text !== cleanPostText(scene.text)) {
      // Update the scene text in the project provider
      updateSceneText(scene.id, text);
      
      // Trigger a reorder (save) of the project
      onSceneReorder(scene.id, index);
    }
    setIsEditing(false);
  };

  const handleRetry = async () => {
    if (!scene.url) return;

    setIsRetrying(true);
    try {
      await onSceneReorder(scene.id, index);
    } catch (error) {
      console.error('Failed to retry loading content:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRemoveScene = useCallback(() => {
    if (isRemoving || isRemovedRef.current) {
      console.log(`Already removing scene ${scene.id}, ignoring duplicate request`);
      return;
    }
    
    try {
      console.log(`Initiating removal for scene: ${scene.id}`);
      setIsRemoving(true);
      setFadeOut(true);
      
      // Start UI removal animation
      const sceneElement = document.getElementById(`scene-${scene.id}`);
      if (sceneElement) {
        sceneElement.style.transition = 'opacity 0.5s ease-out';
        sceneElement.style.opacity = '0.5';
      }
      
      // Call the actual removal function
      onSceneRemove(scene.id);
      
      // Set a backup timeout to forcibly remove component from UI
      removingTimeoutRef.current = setTimeout(() => {
        console.log(`Scene ${scene.id} removal timeout reached, forcing UI update`);
        setManuallyRemoving(true);
        isRemovedRef.current = true;
        
        // Fully hide the element
        if (sceneElement) {
          sceneElement.style.opacity = '0';
          sceneElement.style.height = '0';
          sceneElement.style.margin = '0';
          sceneElement.style.padding = '0';
          sceneElement.style.overflow = 'hidden';
        }
        
        // Check if component is still mounted after 3 seconds
        const checkMountTimeout = setTimeout(() => {
          const stillExists = document.getElementById(`scene-${scene.id}`);
          if (stillExists) {
            console.warn(`Scene ${scene.id} still in DOM after forced removal, resetting state`);
            setManuallyRemoving(false);
            setIsRemoving(false);
            setFadeOut(false);
            isRemovedRef.current = false;
            
            // Restore visibility
            if (stillExists) {
              stillExists.style.opacity = '1';
              stillExists.style.height = '';
              stillExists.style.margin = '';
              stillExists.style.padding = '';
              stillExists.style.overflow = '';
            }
          }
        }, 3000);

        // Clean up the check mount timeout
        return () => clearTimeout(checkMountTimeout);
      }, 2000);
    } catch (error) {
      console.error(`Error initiating scene removal for ${scene.id}:`, error);
      setIsRemoving(false);
      setFadeOut(false);
    }
  }, [scene.id, isRemoving, onSceneRemove]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (removingTimeoutRef.current) {
        clearTimeout(removingTimeoutRef.current);
        removingTimeoutRef.current = null;
      }
    };
  }, []);

  // Function to render loading state
  const renderLoadingState = () => {
    return (
      <div className="w-full">
        <div className="bg-gray-100 w-full h-48 flex items-center justify-center rounded-t-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-2"></div>
            <p className="text-gray-600 text-sm">Loading content...</p>
          </div>
        </div>
        <div className="p-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
        </div>
      </div>
    );
  };

  // Function to render error state
  const renderErrorState = () => {
    return (
      <div className="w-full">
        <div className="bg-red-50 w-full p-4 rounded-t-lg">
          <ErrorDisplay
            error={scene.error || 'Failed to load content'}
            type="extraction"
            showRetry={!!scene.url}
            onRetry={handleRetry}
          />
        </div>
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">URL: {scene.url}</p>
        </div>
      </div>
    );
  };

  // Function to render the appropriate media component
  const renderMedia = () => {
    if (!scene.media) {
      return (
        <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
          <p className="text-gray-500">No media available</p>
        </div>
      );
    }

    switch (scene.media.type) {
      case 'image':
        return (
          <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Scene image'}
                width={400}
                height={200}
                className="rounded-t-lg h-40 object-contain"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="relative w-full h-40 bg-black rounded-t-lg overflow-hidden">
            <video
              src={transformRedditVideoUrl(scene.media.url)}
              controls
              className="w-full h-full object-contain rounded-t-lg"
              crossOrigin="anonymous"
              poster={scene.media.thumbnailUrl}
            />
          </div>
        );

      case 'gallery':
        // For simplicity, just show the first image of the gallery
        return (
          <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Gallery image'}
                width={400}
                height={200}
                className="rounded-t-lg h-40 object-contain"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
            <p className="text-gray-500">Unsupported media type</p>
          </div>
        );
    }
  };

  // Modified onSceneMove to prevent dragging when settings are open
  const handleSceneMove = useCallback((id: string, newIndex: number) => {
    if (!showSettings) {
      onSceneMove(id, newIndex);
    }
  }, [onSceneMove, showSettings]);

  // Function to render text content with overlay expansion
  const renderTextContent = () => {
    const displayText = text || '<No text provided>';
    const isLongText = displayText.length > 100;
    
    return (
      <div className="relative" style={{ height: '65px' }} data-test-layout="text-content-container">
        {/* Base text container - always visible when not editing */}
        <div 
          className="h-16 overflow-hidden relative text-sm cursor-pointer hover:bg-gray-50 p-1 pt-0.5 pb-1 rounded"
          onClick={() => !readOnly && setIsEditing(true)}
          data-test-layout="text-display"
          data-test-dimensions={`height:16px;overflow:hidden`}
        >
          <p className="text-gray-800 line-clamp-3">{displayText}</p>
          
          {/* Removed the blue expand arrow */}
        </div>
        
        {/* Expanded overlay - shown when user expands without editing */}
        {isTextExpanded && !isEditing && (
          <div 
            className="absolute top-0 left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-md z-40 p-2 max-h-64 overflow-y-auto"
            style={{ minHeight: '6rem' }}
            onClick={() => setIsTextExpanded(false)}
            data-test-layout="text-expanded-overlay"
            data-test-dimensions={`min-height:6rem;max-height:16rem`}
          >
            <p className="text-gray-800 mb-2">{displayText}</p>
            
            {/* Close indicator */}
            <div className="absolute bottom-1 right-1 p-1">
              <ChevronUpIcon className="h-3 w-3 text-blue-600" />
            </div>
          </div>
        )}
        
        {/* Editing interface - absolute overlay that covers everything below */}
        {isEditing && (
          <div 
            className="absolute left-0 right-0 z-50 bg-white border border-gray-300 shadow-md rounded-md overflow-hidden"
            style={{ 
              top: '0',
              bottom: '-85px', /* Adjusted from -90px to -85px to eliminate the gap */
              height: 'auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)' /* Enhanced shadow to emphasize edges */
            }}
            data-test-layout="text-editor-overlay"
            data-test-dimensions={`position:absolute;top:0;bottom:-85px`}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              className="w-full h-full p-2 text-sm resize-none scrollable-textarea"
              style={{ 
                height: 'calc(100% - 26px)', /* Reserve space for the footer */
                minHeight: '160px', /* Slightly reduced to match the new position */
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '8px'
              }}
              placeholder="Enter scene text..."
              autoFocus
              data-test-layout="text-editor-textarea"
              data-test-dimensions={`min-height:160px;height:calc(100% - 26px)`}
            />
            {/* Footer with save hint - with proper rounded corners to match top */}
            <div className="bg-gray-100 py-1.5 px-2 text-xs text-gray-500 flex justify-end border-t border-gray-300"
                 style={{borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px'}}
                 data-test-layout="text-editor-footer">
              <span>Click outside to save</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Format time for audio display
  const formatTime = (timeInSeconds: number): string => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Add an event listener to update time display during playback
  useEffect(() => {
    const updateTimeDisplay = () => {
      if (audioRef.current) {
        const currentTime = audioRef.current.currentTime;
        const duration = audioRef.current.duration;
        
        const timeDisplay = document.getElementById(`time-display-${scene.id}`);
        const durationDisplay = document.getElementById(`duration-display-${scene.id}`);
        
        if (timeDisplay) {
          timeDisplay.textContent = formatTime(currentTime);
        }
        
        if (durationDisplay && !isNaN(duration)) {
          durationDisplay.textContent = formatTime(duration);
        }
      }
    };
    
    if (audioRef.current && audioSrc) {
      audioRef.current.addEventListener('timeupdate', updateTimeDisplay);
      audioRef.current.addEventListener('loadedmetadata', updateTimeDisplay);
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', updateTimeDisplay);
        audioRef.current.removeEventListener('loadedmetadata', updateTimeDisplay);
      }
    };
  }, [audioRef, audioSrc, scene.id]);

  // Simplified CSS classes for flip animation
  useEffect(() => {
    // Add styles for flip animation if they don't exist
    if (!document.getElementById('flip-animation-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'flip-animation-styles';
      styleSheet.textContent = `
        .flip-container {
          perspective: 1000px;
        }
        
        .flip-container.flipped .flipper {
          transform: rotateX(180deg);
        }
        
        .flipper {
          transition: 0.6s;
          transform-style: preserve-3d;
          position: relative;
          transform-origin: center center;
        }
        
        .front, .back {
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        .front {
          z-index: 2;
          transform: rotateX(0deg);
        }
        
        .back {
          transform: rotateX(180deg);
          background-color: #16a34a; /* Ensuring the green color is consistent */
        }
        
        .flip-container.flipped .front {
          z-index: 0;
        }
        
        .flip-container.flipped .back {
          z-index: 2;
        }
      `;
      document.head.appendChild(styleSheet);
    }
    
    return () => {
      // Cleanup styles when component unmounts
      const styleElement = document.getElementById('flip-animation-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Add event listeners for audio playback state
  useEffect(() => {
    const audioElement = audioRef.current;
    
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    
    if (audioElement) {
      audioElement.addEventListener('play', handlePlay);
      audioElement.addEventListener('pause', handlePause);
      audioElement.addEventListener('ended', handleEnded);
    }
    
    return () => {
      if (audioElement) {
        audioElement.removeEventListener('play', handlePlay);
        audioElement.removeEventListener('pause', handlePause);
        audioElement.removeEventListener('ended', handleEnded);
      }
    };
  }, [audioRef.current]);

  // Updated audio play/pause handler
  const togglePlayPause = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(e => console.error("Error playing audio:", e));
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Handle volume change
  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Remove the custom volume slider styles
  useEffect(() => {
    if (!document.getElementById('volume-slider-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'volume-slider-styles';
      styleSheet.textContent = `
        /* Simple horizontal volume slider styling */
        .volume-slider {
          height: 6px;
          appearance: none;
          width: 100%;
          background: rgba(255, 255, 255, 0.7);
          border-radius: 3px;
          outline: none;
        }
        
        .volume-slider::-webkit-slider-thumb {
          appearance: none;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.4);
        }
        
        .volume-slider::-moz-range-thumb {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: white;
          cursor: pointer;
          border: none;
          box-shadow: 0 0 2px rgba(0,0,0,0.4);
        }
      `;
      document.head.appendChild(styleSheet);
    }
    
    return () => {
      // Cleanup styles when component unmounts
      const styleElement = document.getElementById('volume-slider-styles');
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Remove the complex event handlers
  // Close volume slider when clicking outside, but only if not interacting with slider
  useEffect(() => {
    let isDraggingSlider = false;
    
    const handleMouseDown = (e: MouseEvent) => {
      // Check if the click was on the volume slider
      if (e.target instanceof Element && e.target.classList.contains('volume-slider')) {
        isDraggingSlider = true;
      }
    };
    
    const handleMouseUp = () => {
      isDraggingSlider = false;
    };
    
    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if we're interacting with the slider
      if (isDraggingSlider) return;
      
      if (
        volumeButtonRef.current && 
        !volumeButtonRef.current.contains(event.target as Node) &&
        showVolumeSlider &&
        event.target instanceof Element && 
        !event.target.classList.contains('volume-slider') &&
        !event.target.closest('.volume-popup')
      ) {
        setShowVolumeSlider(false);
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showVolumeSlider]);

  // Handle playback speed change
  const handlePlaybackSpeedChange = (newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = newSpeed;
    }
  };
  
  // Download audio
  const handleDownloadAudio = () => {
    if (audioSrc) {
      const a = document.createElement('a');
      a.href = audioSrc;
      a.download = `audio_${scene.id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  // Add event listeners for text area scrolling
  useEffect(() => {
    const textarea = textareaRef.current;
    
    if (textarea && isEditing) {
      // Debug log when effect runs
      console.log("Setting up textarea scroll handlers");
      
      // Improved wheel event handler with better prevention
      const handleWheel = (e: WheelEvent) => {
        console.log("Wheel event detected:", { 
          deltaY: e.deltaY, 
          scrollTop: textarea.scrollTop,
          scrollHeight: textarea.scrollHeight,
          clientHeight: textarea.clientHeight
        });
        
        // Critical: Prevent default behavior first - this is key for Mac trackpads
        e.preventDefault();
        
        // Then manually scroll the textarea
        textarea.scrollTop += e.deltaY;
        
        // Also stop propagation to parent elements
        e.stopPropagation();
        
        // Log the new scroll position after our manual adjustment
        console.log("New scroll position:", textarea.scrollTop);
        
        return false;
      };
      
      // Use the more forceful event capturing
      textarea.addEventListener('wheel', handleWheel, { passive: false, capture: true });
      
      // Additional handler for click events to ensure focus
      const handleClick = (e: MouseEvent) => {
        console.log("Textarea clicked");
        e.stopPropagation();
        textarea.focus();
      };
      
      textarea.addEventListener('click', handleClick);
      
      // Additional logging to check when events actually occur
      const debugEvent = (e: Event) => {
        console.log(`Textarea ${e.type} event triggered`);
      };
      
      textarea.addEventListener('focus', debugEvent);
      textarea.addEventListener('blur', debugEvent);
      
      console.log("All textarea event handlers attached");
      
      return () => {
        textarea.removeEventListener('wheel', handleWheel, { capture: true });
        textarea.removeEventListener('click', handleClick);
        textarea.removeEventListener('focus', debugEvent);
        textarea.removeEventListener('blur', debugEvent);
        console.log("Textarea event handlers removed");
      };
    }
  }, [isEditing]);

  // Add enhanced styles for enabling proper textarea scrolling
  useEffect(() => {
    if (!document.getElementById('textarea-scroll-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'textarea-scroll-styles';
      styleSheet.textContent = `
        .scrollable-textarea {
          -webkit-overflow-scrolling: touch; /* Enables momentum scrolling on iOS/Mac */
          scrollbar-width: thin; /* Firefox */
          overflow-y: auto !important;
          overflow-x: hidden !important;
          overscroll-behavior: contain !important; /* Prevent scroll chaining */
          pointer-events: auto !important; /* Ensure events go to the textarea */
          touch-action: pan-y !important; /* Allow vertical touch scrolling */
          position: relative !important; /* Ensure correct stacking */
          z-index: 30 !important; /* Higher z-index to catch events first */
        }
        
        .scrollable-textarea::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollable-textarea::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .scrollable-textarea:focus {
          outline: none;
        }
        
        /* Ensure parent container doesn't interfere */
        .textarea-container {
          position: relative;
          z-index: 20;
          overscroll-behavior: contain;
          overflow: hidden;
        }
      `;
      document.head.appendChild(styleSheet);
      console.log("Added textarea scroll styles");
    }
    
    return () => {
      // Cleanup styles when component unmounts
      const styleElement = document.getElementById('textarea-scroll-styles');
      if (styleElement) {
        styleElement.remove();
        console.log("Removed textarea scroll styles");
      }
    };
  }, []);

  return manuallyRemoving ? null : (
    <div
      id={`scene-${scene.id}`}
      className={`relative rounded-lg border overflow-hidden shadow-sm bg-white 
      ${isDragging ? 'border-blue-500 shadow-lg bg-blue-50' : 'border-gray-300'}
      ${isRemoving ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}
      style={{
        opacity: fadeOut ? 0.6 : 1,
        transition: 'opacity 0.5s ease-out',
        height: '348px' // Reduced height to make the layout more compact
      }}
      {...(reorderMode && !showSettings ? {
        'data-handler-id': scene.id,
        'draggable': 'true'
      } : {})}
    >
      {/* Scene number indicator */}
      <div 
        data-testid={`scene-number-${index + 1}`}
        className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium z-10"
      >
        {index + 1}
      </div>

      {/* Content based on scene state */}
      {scene.isLoading ? (
        renderLoadingState()
      ) : scene.error ? (
        renderErrorState()
      ) : (
        <div className="flex flex-col h-full">
          {/* Media section - fixed height */}
          <div className="h-40">
          {renderMedia()}
          </div>

          {/* Content section - with minimal spacing */}
          <div className="p-1 flex-1 flex flex-col">
            {/* Source info with bottom border */}
            <div className="flex flex-wrap items-center text-xs text-gray-500 mb-1 pb-1 border-b border-gray-200">
              {scene.source.author && (
                <span className="mr-1 truncate">By: {scene.source.author}</span>
              )}
              {scene.source.subreddit && (
                <span className="truncate">r/{scene.source.subreddit}</span>
              )}
            </div>

            {/* Text content with overlay expansion */}
            {renderTextContent()}
            
            {/* Voice generation controls with top padding */}
            <div className="mt-1 pt-1 border-t border-gray-200">
              {useNewControls ? (
                // New component (extracted)
                <div data-testid="new-audio-controls">
                  <SceneAudioControls 
                    sceneId={scene.id}
                    audioSource={audioSrc || undefined}
                    isGeneratingAudio={generatingAudio}
                    onGenerateClick={handleGenerateVoice}
                    onRegenerateClick={handleGenerateVoice}
                    onVoiceChange={(voice) => setVoiceId(voice)}
                    onRateChange={handlePlaybackSpeedChange}
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
                  
                  {/* We're hiding the separate audio player div */}
                  <div className="hidden">
                    <audio ref={audioRef} controls src={audioSrc || ''} className="w-full h-7" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Controls - positioned at bottom without gap */}
          <div className="border-t border-gray-200 flex justify-between items-stretch">
            {/* Left side controls */}
            <div className="flex items-center">
            {scene.error && scene.url && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm flex items-center text-xs"
                aria-label="Retry loading content"
              >
                <RefreshIcon className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                <span className="ml-1">Retry</span>
              </button>
            )}
            </div>
            
            {/* Right side controls */}
            <div className="flex flex-grow" style={{ gap: '0' }}>
            {!scene.isLoading && !scene.error && (
                <div className="relative flex-grow flex pr-0" style={{ marginRight: '0', padding: '0', width: 'calc(100% - 40px)' }}>
                  {/* This is the flipping container that will rotate */}
                  <div 
                    className={`flip-container flex-grow relative ${audioSrc ? 'flipped' : ''}`}
                    style={{
                      perspective: '1000px',
                      height: '100%',
                      marginRight: '0', // Ensure no margin pushes it to the right
                      width: '100%' // Ensure full width
                    }}
                  >
                    <div className="flipper" style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      transition: 'transform 0.6s',
                      transformStyle: 'preserve-3d',
                      transform: audioSrc ? 'rotateX(180deg)' : 'rotateX(0deg)'
                    }}>
                      {/* Front face - Generate button */}
                      {!scene.audio && !useNewControls && (
                        <div className="relative w-full" style={{ width: '100%', height: '100%' }}>
                          <button
                            className="w-full generate-button front absolute inset-0 flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
                            data-testid="generate-voice-button"
                            disabled={generatingAudio || !text || text.length === 0}
                            onClick={handleGenerateVoice}
                          >
                            <MicIcon className="h-4 w-4 mr-2" />
                            Generate Voiceover
                          </button>
                        </div>
                      )}
                      
                      {/* Back face - Audio controls */}
                      {!useNewControls && audioSrc && (
                        <div
                          className="back absolute inset-0 flex-grow px-2 py-2 bg-green-600 text-white text-sm rounded-bl-md flex items-center justify-between"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateX(180deg)',
                            zIndex: audioSrc ? '2' : '0',
                            right: '0', // Ensure right edge alignment
                            width: '100%', // Full width
                            paddingRight: '0.75rem', // Add extra right padding to create space from trash button
                            borderRight: 'none' // Ensure no border on right side
                          }}
                        >
                          {/* Audio Control Section - all controls in a single row with flex */}
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
                                <span id={`time-display-${scene.id}`}>
                                  {audioRef.current ? 
                                    formatTime(audioRef.current.currentTime || 0) : 
                                    "0:00"}
                                </span>
                                <span className="mx-0.5">/</span>
                                <span id={`duration-display-${scene.id}`}>
                                  {audioRef.current ? 
                                    formatTime(audioRef.current.duration || 0) : 
                                    "0:00"}
                                </span>
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
                                className="volume-slider w-full h-2"
                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                data-testid="audio-slider"
                              />
                            </div>
                            
                            {/* Right - action buttons */}
                            <div className="flex items-center">
                              <button 
                                onClick={handleGenerateVoice}
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
                          <div className="hidden">
                            <audio
                              ref={audioRef}
                              src={audioSrc}
                              onTimeUpdate={() => {
                                // This is a placeholder for the time update event
                              }}
                              onEnded={() => {
                                // This is a placeholder for the end of playback event
                              }}
                              data-testid="audio-element"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
            )}
            <button
              onClick={handleRemoveScene}
              disabled={isRemoving}
              className={`flex-shrink-0 w-10 py-2 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
              aria-label="Remove scene"
              style={{ marginLeft: '0' }} /* Remove negative margin */
            >
              <TrashIcon className={`h-4 w-4 ${isRemoving ? 'animate-spin' : ''}`} />
            </button>
            </div>
          </div>
          
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
                className="bg-white rounded-lg shadow-xl w-72 p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Audio Options</h3>
                  <button
                    onClick={() => setShowAudioSettings(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XIcon className="h-5 w-5" />
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
          
          {/* Voice Settings Panel Overlay (original) */}
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
                
                <div className="p-4">
                  {/* Speed slider - MOVED TO TOP */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Speed: {speed.toFixed(2)}x</label>
                      <span className="text-xs text-gray-500">
                        {speed < 0.85 ? 'Slower' : speed > 1.1 ? 'Faster' : 'Normal'}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.7" 
                      max="1.2" 
                      step="0.01" 
                      value={speed} 
                      onChange={(e) => {
                        e.stopPropagation();
                        setSpeed(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>Slower (0.7x)</span>
                      <span>Faster (1.2x)</span>
                    </div>
                  </div>
                  
                  {/* Stability slider - CHANGED TO PERCENTAGE */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Stability: {Math.round(stability * 100)}%</label>
                      <span className="text-xs text-gray-500">{stability < 0.3 ? 'Variable' : stability > 0.7 ? 'Stable' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={stability} 
                      onChange={(e) => {
                        e.stopPropagation();
                        setStability(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Similarity Boost slider - CHANGED TO PERCENTAGE */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Similarity: {Math.round(similarityBoost * 100)}%</label>
                      <span className="text-xs text-gray-500">{similarityBoost < 0.3 ? 'Less Similar' : similarityBoost > 0.7 ? 'More Similar' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={similarityBoost} 
                      onChange={(e) => {
                        e.stopPropagation();
                        setSimilarityBoost(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Style slider - CHANGED TO PERCENTAGE */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-gray-600">Style: {Math.round(style * 100)}%</label>
                      <span className="text-xs text-gray-500">{style < 0.3 ? 'Natural' : style > 0.7 ? 'Expressive' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={style} 
                      onChange={(e) => {
                        e.stopPropagation();
                        setStyle(parseFloat(e.target.value));
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>0%</span>
                      <span>100%</span>
                    </div>
                  </div>
                  
                  {/* Speaker Boost toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs text-gray-600">Speaker Boost</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSpeakerBoost(!speakerBoost);
                      }}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full ${speakerBoost ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${speakerBoost ? 'translate-x-5' : 'translate-x-1'}`}
                      />
                    </button>
                  </div>
                  
                  <div className="text-[10px] text-gray-500 mb-3">
                    These settings apply only to this scene.
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettings(false);
                      }}
                      className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-medium"
                    >
                      Apply Settings
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
