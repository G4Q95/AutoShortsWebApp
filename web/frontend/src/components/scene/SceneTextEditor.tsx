/**
 * SceneTextEditor component using useSceneEdit hook
 */
import React, { useState } from 'react';
import { Scene } from '@/components/project/ProjectTypes';
import { SceneTextContent } from './SceneTextContent';
import { useSceneEdit } from '@/hooks/scene/useSceneEdit';

interface SceneTextEditorProps {
  /**
   * Scene data object
   */
  scene: Scene;
  
  /**
   * Project ID
   */
  projectId: string;
  
  /**
   * Function to update scene text in the project context
   */
  updateSceneText: (sceneId: string, text: string) => void;
  
  /**
   * Whether the scene is in read-only mode
   */
  readOnly?: boolean;
}

/**
 * Connector component that combines useSceneEdit hook with SceneTextContent UI
 * Manages state and behavior for text editing in a scene
 */
export const SceneTextEditor: React.FC<SceneTextEditorProps> = ({
  scene,
  projectId,
  updateSceneText,
  readOnly = false
}) => {
  // Text expansion state (separate from edit state)
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  
  // Use the edit hook for state and event handlers
  const {
    text,
    isEditing,
    wordCount,
    isInfoVisible,
    handleTextChange,
    handleSaveText,
    handleCancelEdit,
    handleKeyDown,
    startEditing
  } = useSceneEdit(scene, projectId, updateSceneText);
  
  // Handler for toggling text expansion
  const toggleTextExpand = () => {
    setIsTextExpanded(prev => !prev);
  };
  
  return (
    <SceneTextContent
      text={text}
      originalText={scene.text}
      wordCount={wordCount}
      isEditing={isEditing}
      isTextExpanded={isTextExpanded}
      readOnly={readOnly}
      onTextChange={handleTextChange}
      onStartEditing={startEditing}
      onSaveText={handleSaveText}
      onCancelEdit={handleCancelEdit}
      onKeyDown={handleKeyDown}
      onToggleTextExpand={toggleTextExpand}
    />
  );
}; 