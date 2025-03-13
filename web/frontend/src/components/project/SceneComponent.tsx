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
  Type as TypeIcon
} from 'lucide-react';
import Image from 'next/image';
import ErrorDisplay from '../ErrorDisplay';
import { transformRedditVideoUrl } from '@/lib/media-utils';
import { useProject } from './ProjectProvider';
import { getAvailableVoices, generateVoice } from '../../lib/api-client';

/**
 * Utility function to clean post text by removing "Post by u/Username:" prefix
 * @param text - The text to clean
 * @returns The cleaned text without the username prefix
 */
const cleanPostText = (text: string): string => {
  return text.replace(/^Post by u\/[^:]+:\s*/i, '');
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
  customStyles?: React.CSSProperties;
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
  customStyles = {}
}: SceneComponentProps) {
  const { mode } = useProject();
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
  const [voiceId, setVoiceId] = useState<string>("");
  const [voices, setVoices] = useState<any[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Voice settings states
  const [showSettings, setShowSettings] = useState(false);
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Add new state for text expansion
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
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

  // Fetch voices when component mounts
  useEffect(() => {
    if (voices.length === 0 && !loadingVoices) {
      fetchVoices();
      
      // Ensure text is updated
      setText(cleanPostText(scene.text));
    }
  }, [scene.text]);

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
        if (response.data.voices.length > 0) {
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
    
    // More robust text checking - trim the text to check for whitespace-only
    if (!text || text.trim() === '') {
      setAudioError('No text content to convert to speech. Please add some text content to the scene.');
      console.log('Empty text detected. Scene text:', scene.text, 'Local text state:', text);
      return;
    }

    setAudioError(null);
    setGeneratingAudio(true);
    try {
      const response = await generateVoice({
        text,
        voice_id: voiceId,
        stability,
        similarity_boost: similarityBoost,
        style,
        output_format: "mp3_44100_128",
        use_speaker_boost: speakerBoost,
        speed
      });
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      // Create audio URL from base64 data
      const blob = new Blob(
        [Uint8Array.from(atob(response.data.audio_base64), c => c.charCodeAt(0))],
        { type: response.data.content_type }
      );
      const audioUrl = URL.createObjectURL(blob);
      setAudioSrc(audioUrl);
      
      // Add a small delay to ensure the audio element is updated with the new source
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Error auto-playing audio:', err);
          });
        }
      }, 100);
    } catch (err: any) {
      setAudioError(`Error generating voice: ${err.message}`);
      setAudioSrc(null);
    } finally {
      setGeneratingAudio(false);
    }
  };

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
      onSceneReorder(scene.id, index);
    }
    setIsEditing(false);
  };

  const handleSave = () => {
    saveText();
  };

  const handleCancel = () => {
    setText(cleanPostText(scene.text));
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
    const displayText = cleanPostText(scene.text) || '<No text provided>';
    const isLongText = displayText.length > 100;
    
    return (
      <div className="relative">
        {/* Base text container - always visible */}
        <div 
          className="h-14 overflow-hidden relative text-sm cursor-pointer hover:bg-gray-50 p-1 rounded"
          onClick={() => !readOnly && (isEditing ? null : setIsEditing(true))}
        >
          <p className="text-gray-800 line-clamp-3">{displayText}</p>
          
          {/* Simple arrow indicator for longer text */}
          {isLongText && !isTextExpanded && !isEditing && (
            <div className="absolute bottom-0 right-0 p-1">
              <ChevronDownIcon className="h-3 w-3 text-blue-600" />
            </div>
          )}
        </div>
        
        {/* Expanded overlay - shown when user expands without editing */}
        {isTextExpanded && !isEditing && (
          <div 
            className="absolute top-0 left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-md z-20 p-2 max-h-64 overflow-y-auto"
            style={{ minHeight: '6rem' }}
            onClick={() => setIsTextExpanded(false)}
          >
            <p className="text-gray-800 mb-4">{displayText}</p>
            
            {/* Close indicator */}
            <div className="absolute bottom-1 right-1 p-1">
              <ChevronUpIcon className="h-3 w-3 text-blue-600" />
            </div>
          </div>
        )}
        
        {/* Editing interface */}
        {isEditing && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-white border border-gray-200 shadow-lg rounded-md p-2">
            <textarea
              value={text}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              className="w-full h-32 p-2 border border-gray-300 rounded mb-2 text-sm"
              placeholder="Enter scene text..."
              autoFocus
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return manuallyRemoving ? null : (
    <div
      id={`scene-${scene.id}`}
      className={`relative rounded-lg border overflow-hidden shadow-sm bg-white 
      ${isDragging ? 'border-blue-500 shadow-lg bg-blue-50' : 'border-gray-300'}
      ${isRemoving ? 'opacity-50' : 'opacity-100'} transition-opacity duration-300`}
      style={{
        opacity: fadeOut ? 0.6 : 1,
        transition: 'opacity 0.5s ease-out',
        height: '340px' // Adjusted height to fit everything tightly
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
            {/* Source info */}
            <div className="flex flex-wrap items-center text-xs text-gray-500 mb-0.5">
              {scene.source.author && (
                <span className="mr-1 truncate">By: {scene.source.author}</span>
              )}
              {scene.source.subreddit && (
                <span className="truncate">r/{scene.source.subreddit}</span>
              )}
            </div>

            {/* Text content with overlay expansion */}
            {renderTextContent()}
            
            {/* Voice generation controls - packed tightly */}
            <div className="mt-auto pt-0.5 border-t border-gray-200">
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
              
              {/* Audio player - fixed size regardless of content */}
              <div className={`mt-0.5 ${audioSrc ? 'block' : 'hidden'} h-7`}>
                <audio ref={audioRef} controls src={audioSrc || ''} className="w-full h-7" />
              </div>
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
            <div className="flex flex-grow">
              {!scene.isLoading && !scene.error && (
                <div className="relative flex-grow flex">
                  <button
                    onClick={handleGenerateVoice}
                    disabled={generatingAudio || !voiceId}
                    className="flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
                    aria-label="Generate voice"
                  >
                    <Volume2Icon className="h-4 w-4 mr-1" />
                    <span className="font-medium">{generatingAudio ? "Generating..." : "Generate Voiceover"}</span>
                  </button>
                </div>
              )}
              <button
                onClick={handleRemoveScene}
                disabled={isRemoving}
                className={`w-12 py-2 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
                aria-label="Remove scene"
              >
                <TrashIcon className={`h-4 w-4 ${isRemoving ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Settings Panel Overlay */}
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
