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
  Download as DownloadIcon
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
  const { mode, updateSceneText } = useProject();
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
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Voice settings states
  const [showSettings, setShowSettings] = useState(false);
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speakerBoost, setSpeakerBoost] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Add new state for audio playback settings
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const audioSettingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Add new state for text expansion
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
  // Add state for volume controls
  const [volume, setVolume] = useState(1); // 0-1 range
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
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
      // and to allow the flip animation to complete before playing
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(err => {
            console.error('Error auto-playing audio:', err);
          });
        }
      }, 800); // Slightly longer delay to allow for animation
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
      <div className="relative">
        {/* Base text container - always visible */}
        <div 
          className="h-16 overflow-hidden relative text-sm cursor-pointer hover:bg-gray-50 p-1 pt-0.5 pb-0.5 rounded"
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
        
        {/* Editing interface - now fills the entire card and saves on blur */}
        {isEditing && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-white border border-gray-200 shadow-lg rounded-md p-2 textarea-container" style={{ height: '100%', minHeight: '145px' }}>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              className="w-full h-full p-2 border border-gray-300 rounded text-sm resize-none scrollable-textarea"
              placeholder="Enter scene text..."
              autoFocus
            />
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
        height: '348px' // Increased from 345px to ensure the button is not cut off
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
                <div className="relative flex-grow flex pr-0" style={{ marginRight: '0', padding: '0' }}>
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
                      <button
                        onClick={handleGenerateVoice}
                        disabled={generatingAudio || !voiceId}
                        className="front absolute inset-0 flex-grow px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm"
                        aria-label="Generate voice"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          zIndex: audioSrc ? '0' : '2'
                        }}
                      >
                        <Volume2Icon className="h-4 w-4 mr-1" />
                        <span className="font-medium">{generatingAudio ? "Generating..." : "Generate Voiceover"}</span>
                      </button>
                      
                      {/* Back face - Audio controls */}
                      <div
                        className="back absolute inset-0 flex-grow px-2 py-2 bg-green-600 text-white text-sm rounded-bl-md flex items-center justify-between"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          transform: 'rotateX(180deg)',
                          zIndex: audioSrc ? '2' : '0',
                          right: '0', // Ensure right edge alignment
                          width: 'calc(100% - 1px)', // Adjusted to reduce gap
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
                          
                          {/* Middle - volume button with popup */}
                          <div className="relative mx-2 flex-grow max-w-[250px]">
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={volume}
                              className="volume-slider w-full h-2"
                              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
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
                      </div>
                    </div>
                  </div>
                </div>
            )}
            <button
              onClick={handleRemoveScene}
              disabled={isRemoving}
                className={`flex-shrink-0 w-10 py-2 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
              aria-label="Remove scene"
                style={{ marginLeft: '-2px' }} /* Increased negative margin to close the gap */
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
