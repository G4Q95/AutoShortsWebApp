import React, { useState } from 'react';
import { Scene } from '../project/ProjectProvider';
import { useProject } from '../project/ProjectProvider';
import { getSceneContainerClassName } from '@/utils/scene';
import { SceneMediaPlayer } from './SceneMediaPlayer';
import { SceneTextContent } from './SceneTextContent';
import { SceneAudioControls } from '../audio/SceneAudioControls';
import { cleanPostText, getWordCount } from '@/utils/scene/event-handlers';
import { GripVertical } from 'lucide-react';

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
  children
}) => {
  const { currentProject, updateSceneText, updateSceneAudio } = useProject();
  
  // Add state for view mode
  const [isCompactView, setIsCompactView] = useState(true);
  
  // Add state for text editing
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text));
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
  // Add state for audio generation
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);

  // Add confirmation state for scene removal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Handle view mode toggle
  const handleViewModeToggle = () => {
    setIsCompactView(!isCompactView);
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
      {/* Scene Header with Number and Drag Handle */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div 
            data-testid={`scene-number-${index + 1}`}
            className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium"
          >
            {index + 1}
          </div>
          <button
            className="p-1 text-gray-500 hover:text-gray-700 cursor-grab active:cursor-grabbing"
            data-testid="drag-handle"
            title="Drag to reorder"
            aria-label="Drag to reorder scene"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          <SceneAudioControls
            sceneId={scene.id}
            audioSource={scene.audio?.persistentUrl || scene.audio?.audio_url}
            isGeneratingAudio={isGeneratingAudio}
            onGenerateClick={handleGenerateVoice}
            onRegenerateClick={handleGenerateVoice}
            onVoiceChange={handleVoiceChange}
          />
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
    </div>
  );
}; 