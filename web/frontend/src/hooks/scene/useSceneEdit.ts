/**
 * Custom hook for scene text editing functionality
 */
import { useState, useEffect, useCallback } from 'react';
import { Scene } from '@/components/project/ProjectTypes';
import { getWordCount, cleanPostText } from '@/utils/scene/event-handlers/text-handlers';

/**
 * Props for the useSceneEdit hook
 */
interface UseSceneEditProps {
  /**
   * The text editing state
   */
  text: string;
  
  /**
   * Whether the scene is currently being edited
   */
  isEditing: boolean;
  
  /**
   * Whether the text has unsaved changes
   */
  isDirty: boolean;
  
  /**
   * The count of words in the current text
   */
  wordCount: number;
  
  /**
   * Whether the info section is visible
   */
  isInfoVisible: boolean;
  
  /**
   * Handler for text change events
   * @param newText The new text value
   */
  handleTextChange: (newText: string) => void;
  
  /**
   * Handler for saving text changes
   */
  handleSaveText: () => void;
  
  /**
   * Handler for canceling editing and reverting changes
   */
  handleCancelEdit: () => void;
  
  /**
   * Handler for keyboard events during editing
   * @param e The keyboard event
   */
  handleKeyDown: (e: React.KeyboardEvent) => void;
  
  /**
   * Toggle the visibility of the info section
   */
  toggleInfo: () => void;
  
  /**
   * Start editing the scene
   */
  startEditing: () => void;
}

/**
 * Custom hook for managing scene text editing
 * 
 * @param scene The scene being edited
 * @param projectId The ID of the project containing the scene
 * @param updateSceneText Function to update the scene text in the project context
 * @returns An object containing editing state and handlers
 */
export const useSceneEdit = (
  scene: Scene,
  projectId: string,
  updateSceneText: (sceneId: string, text: string) => void
): UseSceneEditProps => {
  // State for editing functionality
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [text, setText] = useState<string>(cleanPostText(scene.text));
  const [originalText, setOriginalText] = useState<string>(scene.text);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isInfoVisible, setIsInfoVisible] = useState<boolean>(false);
  
  // Compute word count from current text
  const wordCount = getWordCount(text);
  
  // Update text and original text when scene.text changes
  useEffect(() => {
    const cleanedText = cleanPostText(scene.text);
    setText(cleanedText);
    setOriginalText(scene.text);
    setIsDirty(false);
  }, [scene.text]);
  
  /**
   * Handle text changes
   */
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setIsDirty(true);
  }, []);
  
  /**
   * Save text changes to the scene
   */
  const handleSaveText = useCallback(() => {
    if (isDirty) {
      updateSceneText(scene.id, text);
    }
    setIsEditing(false);
    setIsDirty(false);
  }, [isDirty, scene.id, text, updateSceneText]);
  
  /**
   * Cancel editing and revert changes
   */
  const handleCancelEdit = useCallback(() => {
    setText(cleanPostText(originalText));
    setIsEditing(false);
    setIsDirty(false);
  }, [originalText]);
  
  /**
   * Toggle info visibility
   */
  const toggleInfo = useCallback(() => {
    setIsInfoVisible(prev => !prev);
  }, []);
  
  /**
   * Start editing
   */
  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);
  
  /**
   * Handle keyboard events during editing
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Save on Ctrl+Enter
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveText();
    }
    // Cancel on Escape
    else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveText, handleCancelEdit]);
  
  return {
    text,
    isEditing,
    isDirty,
    wordCount,
    isInfoVisible,
    handleTextChange,
    handleSaveText,
    handleCancelEdit,
    handleKeyDown,
    toggleInfo,
    startEditing
  };
}; 