'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Scene, useProject } from './ProjectProvider';
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
import { useProject as useProjectContext } from '@/contexts/ProjectContext';
import { getStoredAudio, generateVoice, persistVoiceAudio } from '@/lib/api-client';
import SceneAudioControls from '../audio/SceneAudioControls';
import SceneVideoPlayerWrapper from '../scene/SceneVideoPlayerWrapper';
import SceneVoiceControlsWrapper from '../scene/SceneVoiceControlsWrapper';
import { SceneMediaPlayer } from '../scene/SceneMediaPlayer';
import { SceneTextEditor } from '../scene/SceneTextEditor';

// Import extracted functions
import {
  useTextLogic,
  renderTextContent,
  useVoiceLogic,
  renderVoiceControls,
  useSceneUI,
  renderSceneHeader,
  renderSceneInfo,
  useMediaLogic,
  renderMediaSection
} from './scene-functions';

// Import utility functions
import { 
  formatDuration, 
  getSceneContainerClassName, 
  calculateMediaHeight,
  determineMediaType,
  constructStorageUrl
} from '@/utils/scene';
// Import event handlers
import {
  base64ToBlob,
  createAudioBlobUrl,
  togglePlayPause,
  handleVolumeChange,
  handlePlaybackSpeedChange,
  formatTimeDisplay,
  downloadAudio,
  cleanPostText,
  getWordCount,
  calculateSpeakingDuration,
  createSaveTextHandler,
  createTextChangeHandler,
  createToggleViewModeHandler,
  createToggleInfoHandler,
  handleRemoveScene,
  createRetryHandler
} from '@/utils/scene/event-handlers';
// Import VoiceContext
import { useVoiceContext } from '@/contexts/VoiceContext';
// Import DnD types for dragHandleProps
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { analyzeMedia } from '@/utils/media/mediaAnalysis';

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
  _onSceneMove: (id: string, newIndex: number) => void;
  /** Callback when a scene's position is finalized */
  onSceneReorder: (id: string, newIndex: number) => void;
  /** Whether the scene is in reorder mode */
  _reorderMode?: boolean;
  /** Whether the scene is read-only */
  _readOnly?: boolean;
  /** Reference to the text editor element */
  _editorRef?: React.RefObject<HTMLTextAreaElement>;
  /** Whether the scene is currently being dragged */
  isDragging?: boolean;
  /** Whether to display the scene at full width */
  isFullWidth?: boolean;
  /** Custom styles for the scene component */
  _customStyles?: React.CSSProperties;
  /** Feature flag to use the new SceneAudioControls component instead of built-in audio controls */
  useNewAudioControls?: boolean;
  /** Drag handle props from react-beautiful-dnd */
  dragHandleProps?: DraggableProvidedDragHandleProps;
  /** Project aspect ratio setting */
  projectAspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
  /** Whether to show letterboxing/pillarboxing */
  showLetterboxing?: boolean;
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
  _onSceneMove: onSceneMove,
  onSceneReorder,
  _reorderMode: reorderMode = false,
  _readOnly: readOnly = false,
  _editorRef: editorRef,
  isDragging = false,
  isFullWidth = false,
  _customStyles: customStyles = {},
  useNewAudioControls = false,
  dragHandleProps,
  projectAspectRatio = '9:16',
  showLetterboxing = true
}: SceneComponentProps) {
  // Use new controls for all scenes
  const useNewControls = useNewAudioControls;
  
  const { mode, updateSceneText, updateSceneAudio, currentProject, updateSceneMedia } = useProject();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isCompactView, setIsCompactView] = useState(false);
  const { project } = useProjectContext();

  // Use extracted hooks for different functionalities
  const textState = useTextLogic(scene, updateSceneText);
  const voiceState = useVoiceLogic(scene, updateSceneAudio, currentProject?.id || '');
  const uiState = useSceneUI(scene, onSceneRemove);
  const mediaState = useMediaLogic(scene, updateSceneMedia);
  
  // Keep these state variables here as they're related to the component's lifecycle
  const [isRemoving, setIsRemoving] = useState(false);
  const [manuallyRemoving, setManuallyRemoving] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const removingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localPreview = useRef<string | null>(null);
  const isRemovedRef = useRef<boolean>(false);
  
  // Progress bar state for media storage
  const [progress, setProgress] = useState(0);
  
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

  // Effect to animate progress bar when media is being stored
  useEffect(() => {
    if (scene.isStoringMedia) {
      // Reset progress when storage starts
      setProgress(0);
      
      // Create an interval to update the progress every 50ms
      const totalDuration = 5000; // 5 seconds in ms
      const interval = 50; // Update every 50ms
      const steps = totalDuration / interval;
      const increment = 100 / steps;
      
      const timer = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + increment;
          // When we reach 100%, clear the interval
          if (newProgress >= 100) {
            clearInterval(timer);
            return 100;
          }
          return newProgress;
        });
      }, interval);
      
      // Clean up the interval on unmount
      return () => clearInterval(timer);
    } else {
      // If not storing media anymore, reset progress
      setProgress(0);
    }
  }, [scene.isStoringMedia]);

  // Handler for removing a scene
  const handleRemoveScene = () => {
    setIsRemoving(true);
    setFadeOut(true);
    isRemovedRef.current = true;
    
    // Delay actual removal to allow for animation
    removingTimeoutRef.current = setTimeout(() => {
      if (isRemovedRef.current) {
        setManuallyRemoving(true);
        onSceneRemove(scene.id);
      }
    }, 300);
  };

  // Handler for retrying content load
  const handleRetryLoad = () => {
    setIsRetrying(true);
    createRetryHandler(
      scene.id,
      scene.url, 
      setIsRetrying, 
      onSceneReorder, 
      index
    )();
  };

  // Handler for media upload
  const handleMediaUpload = async (mediaUrl: string, mediaType: 'image' | 'video' | 'gallery') => {
    console.warn(`Scene ${scene.id}: Uploading media from ${mediaUrl}`);
    try {
      // Analyze the media to get dimensions and aspect ratio
      const mediaInfo = await analyzeMedia(mediaUrl, mediaType);
      console.warn(`Media analysis result for scene ${scene.id}:`, mediaInfo);
      
      // Update the scene with the new media data
      const updatedMedia = {
        ...scene.media,
        url: mediaUrl,
        type: mediaType,
        width: mediaInfo.width || 0,
        height: mediaInfo.height || 0,
        aspectRatio: mediaInfo.aspectRatio || '16:9'
      };
      
      // Update scene media in project context
      updateSceneMedia(scene.id, updatedMedia);
      console.warn(`Scene ${scene.id}: Media updated successfully`);
      return true;
    } catch (error) {
      console.warn(`Scene ${scene.id}: Failed to upload media:`, error);
      console.warn('Media upload error:', error);
      return false;
    }
  };

  return !manuallyRemoving ? (
    <div
      id={`scene-${scene.id}`}
      className={getSceneContainerClassName(
        isFullWidth, 
        !isDragging && scene.id === currentProject?.id, 
        textState.isEditing
      ) + (fadeOut ? ' opacity-50' : ' opacity-100')} 
      style={{
        maxWidth: '100%',
        minHeight: '200px'
      }}
      data-testid="scene-component"
      data-scene-id={scene.id}
      {...dragHandleProps}
    >
      {/* Hidden test-only audio element for more reliable test detection */}
      {typeof window !== 'undefined' && 
        (window.USE_MOCK_AUDIO === true || 
         process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true' ||
         process.env.NEXT_PUBLIC_TESTING_MODE === 'true') && voiceState.audioSrc && (
        <audio 
          controls 
          src={voiceState.audioSrc} 
          className="hidden" 
          data-testid="test-audio-element"
        />
      )}
      
      {/* Scene Number Badge */}
      <div
        data-testid={`scene-number-${index + 1}`}
        className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium z-10"
      >
        {index + 1}
      </div>

      {/* Content based on scene state */}
      {scene.isLoading ? (
        renderSceneInfo(scene, false)
      ) : scene.error ? (
        renderSceneInfo(scene, false)
      ) : (
        <div className="flex flex-col h-full">
          {/* Media section - fixed or dynamic height based on view mode */}
          <div className={isCompactView ? "h-[190px]" : ""} data-testid="scene-media">
            {/* NEWER IMPLEMENTATION - Video Player with trimming and expand features */}
            <SceneVideoPlayerWrapper
              scene={scene}
              projectId={currentProject?.id || ''}
              audioUrl={voiceState.audioSrc}
              className="w-full"
              onMediaTrimChange={(start, end) => {
                if (scene.media?.trim) {
                  updateSceneMedia(scene.id, {
                    ...scene.media,
                    trim: { start, end }
                  });
                }
              }}
              data-testid="scene-video-player-wrapper"
              projectAspectRatio={projectAspectRatio}
              showLetterboxing={showLetterboxing}
            />
            
            {/* OLD IMPLEMENTATION - Commenting out but keeping for reference 
            {renderMediaSection(mediaState)}
            */}
          </div>

          {/* Content section - with minimal spacing */}
          <div className={`p-1 ${isCompactView ? 'flex-1' : ''} flex flex-col`}>
            {/* Text content with overlay expansion */}
            <div data-testid="scene-text-section">
              {renderTextContent(textState, scene)}
            </div>
            
            {/* Voice generation controls with top padding */}
            <div 
              className="pt-0.5 border-t border-gray-200" 
              data-testid="scene-audio-section"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onDragStart={(e) => e.stopPropagation()}
              draggable={false}
            >
              {useNewControls ? (
                // New component (extracted)
                <div 
                  data-testid="new-audio-controls"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                >
                  <SceneVoiceControlsWrapper
                    scene={scene}
                    className="mt-4"
                  />
                </div>
              ) : (
                // Original implementation (now rendered using our function)
                <div 
                  data-testid="original-audio-controls"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                >
                  {renderVoiceControls(voiceState, scene, textState.text, useNewControls)}
                </div>
              )}
            </div>
          </div>

          {/* Controls - positioned at bottom without gap */}
          <div 
            className="border-t border-gray-200 flex justify-between items-stretch"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.stopPropagation()}
            draggable={false}
          >
            {/* Left side controls */}
            <div className="flex items-center">
            {scene.error && scene.url && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRetryLoad();
                }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isRetrying}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm flex items-center text-xs"
                aria-label="Retry loading content"
                data-testid="scene-retry-button"
                draggable={false}
              >
                <RefreshIcon className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                <span className="ml-1">Retry</span>
              </button>
            )}
            </div>
            
            {/* Right side controls */}
            <div 
              className="flex flex-grow" 
              style={{ gap: '0' }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            >
            {!scene.isLoading && !scene.error && (
                <div 
                  className="relative flex-grow flex pr-0" 
                  style={{ marginRight: '0', padding: '0', width: 'calc(100% - 40px)' }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  draggable={false}
                >
                  {/* This is the flipping container that will rotate */}
                  <div 
                    className={`flip-container flex-grow relative ${voiceState.audioSrc ? 'flipped' : ''}`}
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
                      transform: voiceState.audioSrc ? 'rotateX(180deg)' : 'rotateX(0deg)'
                    }}>
                      {/* Front face - Generate button */}
                      {!scene.audio && !useNewControls && (
                        <div className="relative w-full" style={{ width: '100%', height: '100%' }}>
                          <button
                            className={`w-full generate-button front absolute inset-0 flex-grow px-3 py-2.5 bg-green-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-green-700 disabled:opacity-50 shadow-sm ${process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true' || (typeof window !== 'undefined' && window.USE_MOCK_AUDIO) ? 'test-mode-button' : ''}`}
                            data-testid="generate-voice-button"
                            disabled={voiceState.generatingAudio && !(process.env.NEXT_PUBLIC_TESTING_MODE === 'true' || process.env.NEXT_PUBLIC_MOCK_AUDIO === 'true' || (typeof window !== 'undefined' && window.USE_MOCK_AUDIO))}
                            onClick={(e) => {
                              e.stopPropagation();
                              voiceState.handleGenerateVoice(textState.text);
                            }}
                          >
                            <MicIcon className="h-4 w-4 mr-3" />
                            Generate Voiceover
                          </button>
                        </div>
                      )}
                      
                      {/* Back face - Audio controls */}
                      {!useNewControls && voiceState.audioSrc && (
                        <div
                          className="back absolute inset-0 flex-grow px-2 py-2 bg-green-600 text-white text-sm rounded-bl-md flex items-center justify-between"
                          style={{
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateX(180deg)',
                            zIndex: voiceState.audioSrc ? '2' : '0',
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voiceState.handlePlayPauseToggle();
                                }}
                                className="text-white p-0.5 hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 mr-1"
                                style={{ width: '20px', height: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                                data-testid="audio-play-button"
                              >
                                {voiceState.isPlaying ? 
                                  <PauseIcon className="h-3.5 w-3.5" /> : 
                                  <PlayIcon className="h-3.5 w-3.5" />
                                }
                              </button>
                              
                              <div className="text-xs whitespace-nowrap font-semibold">
                                <span id={`time-display-${scene.id}`}>
                                  {voiceState.audioRef.current ? 
                                    formatDuration(voiceState.audioRef.current.currentTime || 0) : 
                                    "0:00"}
                                </span>
                                <span className="mx-0.5">/</span>
                                <span id={`duration-display-${scene.id}`}>
                                  {voiceState.audioRef.current ? 
                                    formatDuration(voiceState.audioRef.current.duration || 0) : 
                                    "0:00"}
                                </span>
                              </div>
                            </div>
                            
                            {/* Center - volume slider */}
                            <div className="px-2 flex items-center flex-grow">
                              {/* Volume slider */}
                              <input 
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={voiceState.volume}
                                className="volume-slider w-full h-2"
                                style={{
                                  width: "120%",
                                  accentColor: "white",
                                  WebkitAppearance: "none",
                                  appearance: "none",
                                  height: "4px",
                                  background: "rgba(255, 255, 255, 0.3)",
                                  borderRadius: "2px",
                                }}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  voiceState.handleVolumeChange(e);
                                }}
                                data-testid="audio-slider"
                              />
                            </div>
                            
                            {/* Right side - regenerate and options */}
                            <div className="flex items-center">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voiceState.handleGenerateVoice(textState.text);
                                }}
                                disabled={voiceState.generatingAudio}
                                className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center mr-1.5"
                                title="Regenerate voice"
                                aria-label="Regenerate voice"
                                style={{ width: '18px', height: '18px' }}
                                data-testid="regenerate-button"
                              >
                                <RegenerateIcon className="h-3 w-3" />
                              </button>
                              
                              <button 
                                className="text-white hover:bg-green-700 rounded-full bg-green-700 flex-shrink-0 flex items-center justify-center"
                                title="Audio options"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  voiceState.setShowAudioSettings(true);
                                }}
                                ref={voiceState.audioSettingsButtonRef}
                                style={{ width: '18px', height: '18px' }}
                                data-testid="audio-settings-button"
                              >
                                <MoreVerticalIcon className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveScene();
                }}
                disabled={isRemoving}
                className={`flex-shrink-0 w-10 py-2.5 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
                aria-label="Remove scene"
                data-testid="remove-scene-button"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {/* Audio Playback Settings Panel Overlay */}
          {voiceState.showAudioSettings && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) {
                  voiceState.setShowAudioSettings(false);
                }
              }}
            >
              <div className="bg-white rounded-lg shadow-xl border border-gray-300 w-80 max-w-[90vw] p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Audio Options</h3>
                  <button
                    onClick={() => voiceState.setShowAudioSettings(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-sm text-gray-600">Playback Speed: {voiceState.playbackSpeed.toFixed(2)}x</label>
                    <span className="text-xs text-gray-500">
                      {voiceState.playbackSpeed < 0.85 ? 'Slower' : voiceState.playbackSpeed > 1.1 ? 'Faster' : 'Normal'}
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.05" 
                    value={voiceState.playbackSpeed} 
                    onChange={(e) => {
                      e.stopPropagation();
                      voiceState.handlePlaybackSpeedChange(e);
                    }}
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>0.5x</span>
                    <span>2.0x</span>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={voiceState.handleDownloadAudio}
                    disabled={!voiceState.audioSrc}
                    className={`w-full py-2 rounded-md flex items-center justify-center space-x-2 ${
                      voiceState.audioSrc ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
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
          {voiceState.showSettings && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                if (e.target === e.currentTarget) {
                  voiceState.setShowSettings(false);
                }
              }}
            >
              <div
                className="bg-white rounded-lg shadow-xl border border-gray-300 w-80 max-w-[90vw] absolute"
                style={{
                  top: voiceState.settingsButtonRef.current 
                    ? voiceState.settingsButtonRef.current.getBoundingClientRect().top - 320 
                    : '10vh',
                  left: voiceState.settingsButtonRef.current 
                    ? voiceState.settingsButtonRef.current.getBoundingClientRect().left - 244
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
                      voiceState.setShowSettings(false);
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
                      <label className="text-xs text-gray-600">Speed: {voiceState.speed.toFixed(2)}x</label>
                      <span className="text-xs text-gray-500">
                        {voiceState.speed < 0.85 ? 'Slower' : voiceState.speed > 1.1 ? 'Faster' : 'Normal'}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.7" 
                      max="1.2" 
                      step="0.01" 
                      value={voiceState.speed} 
                      onChange={(e) => {
                        e.stopPropagation();
                        voiceState.setSpeed(parseFloat(e.target.value));
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
                      <label className="text-xs text-gray-600">Stability: {Math.round(voiceState.stability * 100)}%</label>
                      <span className="text-xs text-gray-500">{voiceState.stability < 0.3 ? 'Variable' : voiceState.stability > 0.7 ? 'Stable' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={voiceState.stability} 
                      onChange={(e) => {
                        e.stopPropagation();
                        voiceState.setStability(parseFloat(e.target.value));
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
                      <label className="text-xs text-gray-600">Similarity: {Math.round(voiceState.similarityBoost * 100)}%</label>
                      <span className="text-xs text-gray-500">{voiceState.similarityBoost < 0.3 ? 'Less Similar' : voiceState.similarityBoost > 0.7 ? 'More Similar' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={voiceState.similarityBoost} 
                      onChange={(e) => {
                        e.stopPropagation();
                        voiceState.setSimilarityBoost(parseFloat(e.target.value));
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
                      <label className="text-xs text-gray-600">Style: {Math.round(voiceState.style * 100)}%</label>
                      <span className="text-xs text-gray-500">{voiceState.style < 0.3 ? 'Natural' : voiceState.style > 0.7 ? 'Expressive' : 'Balanced'}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.01" 
                      value={voiceState.style} 
                      onChange={(e) => {
                        e.stopPropagation();
                        voiceState.setStyle(parseFloat(e.target.value));
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
                        voiceState.setSpeakerBoost(!voiceState.speakerBoost);
                      }}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full ${voiceState.speakerBoost ? 'bg-blue-600' : 'bg-gray-200'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${voiceState.speakerBoost ? 'translate-x-5' : 'translate-x-1'}`}
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
                        voiceState.setShowSettings(false);
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
  ) : null;
});
