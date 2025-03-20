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

  // Add confirmation state for scene removal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Add state for voice settings
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    speaker_boost: true,
    speed: 1.0
  });

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

  // Audio handlers
  const handleGenerateVoice = async () => {
    setIsGeneratingAudio(true);
    try {
      // TODO: Implement voice generation
      // This will be connected to the voice generation API
      setIsGeneratingAudio(false);
    } catch (error) {
      console.error('Error generating voice:', error);
      setIsGeneratingAudio(false);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    if (scene.voice_settings) {
      updateSceneAudio(scene.id, scene.audio || {}, {
        ...scene.voice_settings,
        voice_id: voiceId
      });
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

  const handleToggleVoiceSettings = () => {
    setShowVoiceSettings(prev => !prev);
  };

  const handleVoiceSettingsChange = (settings: Partial<typeof voiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...settings }));
    // TODO: In the future, we might want to save these settings to the backend
  };

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
            audioUrl={scene.audio?.persistentUrl || scene.audio?.audio_url || null}
            isCompactView={isCompactView}
            onToggleViewMode={handleViewModeToggle}
            onTrimChange={(start, end) => {
              if (scene.media) {
                const updatedMedia = {
                  ...scene.media,
                  trim: { start, end }
                };
                // TODO: Implement media update handler
              }
            }}
          />
        </div>

        {/* Show info section if enabled */}
        {showInfo && (
          <div className="px-2 pt-1 text-xs text-gray-500 border-t border-gray-100">
            <p>Source: {scene.source ? `${scene.source.platform || 'Unknown'} ${scene.source.author ? `by ${scene.source.author}` : ''}` : 'Unknown'}</p>
            {scene.media && (
              <p>Media: {scene.media.type} - {scene.media.url.substring(0, 50)}...</p>
            )}
            {scene.audio && (
              <p>Audio: {scene.audio.persistentUrl || scene.audio.audio_url || 'None'}</p>
            )}
          </div>
        )}

        {/* Text content section */}
        <div className="p-2" data-testid="scene-text-section">
          <SceneTextContent
            text={text}
            originalText={scene.text}
            wordCount={getWordCount(text)}
            isEditing={isEditing}
            isTextExpanded={isTextExpanded}
            readOnly={readOnly}
            onTextChange={handleTextChange}
            onStartEditing={handleStartEditing}
            onSaveText={handleSaveText}
            onCancelEdit={handleCancelEdit}
            onKeyDown={handleKeyDown}
            onToggleTextExpand={handleToggleTextExpand}
          />
        </div>
        
        {/* Audio controls section */}
        <div className="border-t border-gray-200" data-testid="scene-audio-section">
          <div data-testid="original-audio-controls">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-gray-700">Voice Narration</div>
              <button 
                className="text-xs text-blue-600 hover:text-blue-700 p-0.5 rounded flex items-center" 
                aria-label="Voice settings"
                onClick={handleToggleVoiceSettings}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-settings h-3 w-3 mr-0.5"
                >
                  <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>Settings</span>
              </button>
            </div>
            
            {/* Voice settings modal (displayed conditionally) */}
            {showVoiceSettings && (
              <SceneVoiceSettings
                voiceId={scene.voice_settings?.voice_id || '9BWtsMINqrJLrRacOk9x'}
                voiceSettings={voiceSettings}
                isGenerating={isGeneratingAudio}
                audioError={null}
                onVoiceChange={handleVoiceChange}
                onSettingsChange={handleVoiceSettingsChange}
                onGenerateClick={handleGenerateVoice}
              />
            )}
            
            {/* Voice selector dropdown */}
            {!showVoiceSettings && (
              <select
                className="text-xs py-0.5 px-1 border border-gray-300 rounded w-full mt-0.5 mb-0.5"
                value={scene.voice_settings?.voice_id || '9BWtsMINqrJLrRacOk9x'}
                onChange={(e) => handleVoiceChange(e.target.value)}
                data-testid="voice-selector"
              >
                <option value="9BWtsMINqrJLrRacOk9x">Aria</option>
                <option value="CwhRBWXzGAHq8TQ4Fs17">Roger</option>
                <option value="EXAVITQu4vr4xnSDxMaL">Sarah</option>
                <option value="FGY2WhTYpPnrIDTdsKH5">Laura</option>
                <option value="IKne3meq5aSn9XLyUdCD">Charlie</option>
                <option value="JBFqnCBsd6RMkjVDRZzb">George</option>
                <option value="N2lVS1w4EtoT3dr4eOWO">Callum</option>
                <option value="SAz9YHcvj6GT2YYXdXww">River</option>
                <option value="TX3LPaxmHKxFdv7VOQHJ">Liam</option>
                <option value="XB0fDUnXU5powFXDhCwa">Charlotte</option>
                <option value="Xb7hH8MSUJpSbSDYk0k2">Alice</option>
                <option value="XrExE9yKIg1WjnnlVkGX">Matilda</option>
                <option value="bIHbv24MWmeRgasZH58o">Will</option>
                <option value="cgSgspJ2msm6clMCkdW9">Jessica</option>
                <option value="cjVigY5qzO86Huf0OWal">Eric</option>
                <option value="iP95p4xoKVk53GoZ742B">Chris</option>
                <option value="nPczCjzI2devNBz1zQrb">Brian</option>
                <option value="onwK4e9ZLuTAKqWW03F9">Daniel</option>
                <option value="pFZP5JQG7iQjIQuC4Bku">Lily</option>
                <option value="pqHfZKP75CvOlQylNhV4">Bill</option>
                <option value="2ThAKyuZyXACCyKT2Uks">Lloyd</option>
                <option value="KRzS7KO2TLlh1BRPgHnB">Dave - Male Deep Voice - for Media and AI</option>
                <option value="NYC9WEgkq1u4jiqBseQ9">Russell - Dramatic British TV</option>
                <option value="OHzg7CJflKQVgTfGO2FE">Michael - Deep, Resonant, Confident</option>
                <option value="YHSgh4k0SYcUeBa80k3j">Valentino</option>
                <option value="ZF6FPAbjXT4488VcRRnw">Amelia</option>
                <option value="c7R3SZn5vgoVpwrGa9W0">Marcus - authoritative and deep</option>
                <option value="i2TMQs8AnTGWix92bxez">Tom - trailer narrator</option>
                <option value="lxYfHSkYm1EzQzGhdbfc">Jessica - A VO Professional; now cloned!</option>
                <option value="pVnrL6sighQX7hVz89cp">Soothing Narrator</option>
                <option value="uju3wxzG5OhpWcoi3SMy">Michael C. Vincent</option>
              </select>
            )}
            
            <div className="audio-container hidden" data-testid="audio-container">
              <audio 
                src={scene.audio?.persistentUrl || scene.audio?.audio_url || ''}
                className="w-full h-7"
                data-testid="audio-element"
                preload="metadata"
              />
            </div>
          </div>
        </div>
        
        {/* Scene Actions Section */}
        <div className="border-t border-gray-200 flex justify-between items-stretch">
          <div className="flex items-center">
            {/* Additional actions can be added here */}
          </div>
          <div className="flex flex-grow" style={{ gap: 0 }}>
            {showDeleteConfirm ? (
              <>
                <button
                  className="flex-grow px-3 py-2.5 bg-gray-600 text-white text-sm font-medium rounded-bl-md flex items-center justify-center transition-colors hover:bg-gray-700"
                  onClick={handleCancelDelete}
                  data-testid="cancel-delete-button"
                >
                  Cancel
                </button>
                <button
                  className="flex-shrink-0 w-10 py-2.5 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700"
                  onClick={handleSceneRemove}
                  data-testid="confirm-delete-button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </>
            ) : (
              <button
                className="flex-shrink-0 w-10 py-2.5 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700"
                onClick={handleSceneRemove}
                aria-label="Remove scene"
                data-testid="delete-scene-button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 6h18" />
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  <line x1="10" x2="10" y1="11" y2="17" />
                  <line x1="14" x2="14" y1="11" y2="17" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {children}
      </div>
      <SceneActions onDelete={onDelete} />
    </div>
  );
}; 