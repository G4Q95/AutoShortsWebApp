import React, { useState } from 'react';
import { Scene } from '../project/ProjectProvider';
import { useProject } from '../project/ProjectProvider';
import { getSceneContainerClassName } from '@/utils/scene';
import { SceneMediaPlayer } from './SceneMediaPlayer';
import { SceneTextContent } from './SceneTextContent';
import { cleanPostText, getWordCount } from '@/utils/scene/event-handlers';

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
  const { currentProject, updateSceneText } = useProject();
  
  // Add state for view mode
  const [isCompactView, setIsCompactView] = useState(true);
  
  // Add state for text editing
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text));
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
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

  // Transform scene.media to match SceneMediaPlayer's expected format
  const mediaProps = scene.media ? {
    url: scene.media.url,
    storedUrl: scene.media.storedUrl,
    type: scene.media.type,
    trim: scene.media.trim,
    storageKey: scene.media.storageKey,
    isStorageBacked: scene.media.isStorageBacked
  } : null;

  return (
    <div
      id={`scene-${scene.id}`}
      className={`${getSceneContainerClassName(
        isFullWidth,
        !isDragging && scene.id === currentProject?.id,
        isEditing
      )}`}
      style={{
        maxWidth: '100%',
        minHeight: '200px',
        ...customStyles
      }}
      data-testid="scene-container"
      data-scene-id={scene.id}
    >
      {/* Scene Number Indicator */}
      <div 
        data-testid={`scene-number-${index + 1}`}
        className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium z-10"
      >
        {index + 1}
      </div>

      {/* Main content container */}
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
        
        {/* Other components will be added here */}
        {children}
      </div>
    </div>
  );
}; 