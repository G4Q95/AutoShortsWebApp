'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '../ProjectProvider';

/**
 * Get the word count from a text string
 * @param text The text to count words in
 * @returns The number of words in the text
 */
export function getWordCount(text: string): number {
  if (!text) return 0;
  // Split by whitespace and filter out empty strings
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

/**
 * Custom hook for text editing and content management logic
 * 
 * @param scene The scene data containing text content
 * @param updateSceneText Function to update scene text data
 * @returns Text-related state and handlers
 */
export function useTextLogic(
  scene: Scene,
  updateSceneText: (id: string, text: string) => void
) {
  // Text content state
  const [text, setText] = useState<string>(scene.text || '');
  const [isEditing, setIsEditing] = useState(false);
  const [wordCount, setWordCount] = useState<number>(getWordCount(scene.text || ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update local text state when scene text changes
  useEffect(() => {
    setText(scene.text || '');
    setWordCount(getWordCount(scene.text || ''));
  }, [scene.text]);
  
  // Automatically resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current && isEditing) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text, isEditing]);
  
  // Enable editing mode and focus on textarea
  const handleTextClick = useCallback(() => {
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.selectionStart = textareaRef.current.value.length;
        textareaRef.current.selectionEnd = textareaRef.current.value.length;
      }
    }, 0);
  }, []);
  
  // Handle text changes in the textarea
  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    setWordCount(getWordCount(newText));
  }, []);
  
  // Save text content when user is done editing
  const handleTextBlur = useCallback(() => {
    setIsEditing(false);
    if (text !== scene.text) {
      updateSceneText(scene.id, text);
    }
  }, [text, scene.id, scene.text, updateSceneText]);
  
  // Allow saving with Ctrl+Enter or Command+Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (textareaRef.current) {
        textareaRef.current.blur();
      }
    }
  }, []);

  return {
    text,
    setText,
    isEditing,
    setIsEditing,
    wordCount,
    textareaRef,
    handleTextClick,
    handleTextChange,
    handleTextBlur,
    handleKeyDown
  };
}

/**
 * Renders the text content section of the scene card
 * 
 * @param textState State and handlers from useTextLogic
 * @param scene The scene data
 * @returns JSX for text content section
 */
export function renderTextContent(
  textState: ReturnType<typeof useTextLogic>,
  scene: Scene
) {
  const {
    text,
    isEditing,
    wordCount,
    textareaRef,
    handleTextClick,
    handleTextChange,
    handleTextBlur,
    handleKeyDown
  } = textState;

  return (
    <div className="mt-1 text-sm flex flex-col flex-grow overflow-hidden">
      <div 
        className="flex-grow overflow-auto" 
        style={{ minHeight: '50px' }}
        data-testid="scene-text-container"
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full h-full min-h-[50px] p-0.5 text-sm resize-none font-normal border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={text}
            onChange={handleTextChange}
            onBlur={handleTextBlur}
            onKeyDown={handleKeyDown}
            data-testid="scene-text-textarea"
            placeholder="Enter text content for this scene..."
            autoFocus
          />
        ) : (
          <div
            className="w-full h-full p-0.5 text-sm text-gray-800 whitespace-pre-wrap cursor-text"
            onClick={handleTextClick}
            data-testid="scene-text-display"
          >
            {text || (
              <span className="text-gray-400 italic">
                Enter text content for this scene...
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 text-right mt-0.5">
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
} 