import { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '@/components/project/ProjectTypes';
import { getWordCount, cleanPostText } from '@/utils/scene/event-handlers/text-handlers';

/**
 * Custom hook to manage text editing state and operations for a scene
 * 
 * @param scene - The scene object containing text information
 * @param currentProjectId - The ID of the current project
 * @param updateSceneText - Function to update scene text
 * @returns An object containing text editing state and functions
 */
export function useSceneEdit(
  scene: Scene,
  currentProjectId: string | undefined,
  updateSceneText: (sceneId: string, text: string) => void
) {
  // Text and editing state
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text || ''));
  const [wordCount, setWordCount] = useState(getWordCount(cleanPostText(scene.text || '')));
  const [isDirty, setIsDirty] = useState(false);
  
  // References for editing elements
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  
  // UI state
  const [isInfoVisible, setIsInfoVisible] = useState(false);
  
  /**
   * Initialize text on scene change
   */
  useEffect(() => {
    if (scene.text !== undefined && scene.text !== text) {
      const cleanedText = cleanPostText(scene.text);
      setText(cleanedText);
      setWordCount(getWordCount(cleanedText));
    }
  }, [scene.text, text]);
  
  /**
   * Handle text content change
   */
  const handleTextChange = useCallback((newText: string) => {
    setText(newText);
    setWordCount(getWordCount(newText));
    setIsDirty(true);
  }, []);
  
  /**
   * Save text content to scene
   */
  const handleSaveText = useCallback(() => {
    if (isDirty && currentProjectId) {
      updateSceneText(scene.id, text);
      setIsDirty(false);
    }
    setIsEditing(false);
  }, [isDirty, currentProjectId, scene.id, text, updateSceneText]);
  
  /**
   * Start editing text
   */
  const handleStartEditing = useCallback(() => {
    setIsEditing(true);
    
    // Focus the textarea after rendering
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
      } else if (contentEditableRef.current) {
        contentEditableRef.current.focus();
        // Move cursor to end of content editable div
        const range = document.createRange();
        const sel = window.getSelection();
        if (contentEditableRef.current.childNodes.length > 0) {
          const lastNode = contentEditableRef.current.childNodes[contentEditableRef.current.childNodes.length - 1];
          range.setStartAfter(lastNode);
        } else {
          range.selectNodeContents(contentEditableRef.current);
        }
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }, 0);
  }, []);
  
  /**
   * Cancel editing and revert changes
   */
  const handleCancelEdit = useCallback(() => {
    const cleanedText = cleanPostText(scene.text || '');
    setText(cleanedText);
    setWordCount(getWordCount(cleanedText));
    setIsEditing(false);
    setIsDirty(false);
  }, [scene.text]);
  
  /**
   * Handle keydown events during editing
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveText();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }, [handleSaveText, handleCancelEdit]);
  
  /**
   * Toggle info display
   */
  const toggleInfo = useCallback(() => {
    setIsInfoVisible(prev => !prev);
  }, []);
  
  return {
    // State
    isEditing,
    text,
    wordCount,
    isDirty,
    isInfoVisible,
    
    // Refs
    textareaRef,
    contentEditableRef,
    
    // Setters
    setIsEditing,
    setText,
    setWordCount,
    setIsDirty,
    setIsInfoVisible,
    
    // Actions
    handleTextChange,
    handleSaveText,
    handleStartEditing,
    handleCancelEdit,
    handleKeyDown,
    toggleInfo
  };
} 