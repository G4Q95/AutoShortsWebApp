'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '../ProjectProvider';
import { ChevronUp as ChevronUpIcon, ChevronDown as ChevronDownIcon } from 'lucide-react';

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
  const [isExpanded, setIsExpanded] = useState(false);
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
  
  // Handle text click to toggle expand/edit modes
  const handleTextClick = useCallback(() => {
    if (isEditing) return;
    setIsExpanded(!isExpanded);
  }, [isEditing, isExpanded]);
  
  // Start editing mode
  const startEditing = useCallback(() => {
    setIsExpanded(false);
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
    isExpanded,
    setIsExpanded,
    wordCount,
    textareaRef,
    handleTextClick,
    startEditing,
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
    isExpanded,
    wordCount,
    textareaRef,
    handleTextClick,
    startEditing,
    handleTextChange,
    handleTextBlur,
    handleKeyDown
  } = textState;

  return (
    <div className="mt-1 text-sm flex flex-col flex-grow overflow-visible relative" style={{ minHeight: '75px' }}>
      {/* Normal text container with fixed height */}
      <div 
        className={`flex-grow overflow-hidden ${isExpanded ? 'invisible' : 'visible'}`}
        style={{ height: '55px', position: 'relative' }}
        data-testid="scene-text-container"
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="w-full h-full p-0.5 text-sm resize-none font-normal border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="w-full h-full p-0.5 text-sm text-gray-800 whitespace-pre-wrap cursor-pointer"
            onClick={handleTextClick}
            onDoubleClick={startEditing}
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
      
      {/* Expanded text overlay */}
      {isExpanded && (
        <div 
          className="absolute left-0 right-0 bg-white overflow-auto shadow-md"
          style={{
            top: '0',
            bottom: '-50px',
            height: '165px',
            minHeight: '165px',
            zIndex: 100,
            padding: '0.5rem',
            borderRadius: '0.25rem',
            border: '1px solid #e2e8f0'
          }}
          data-testid="scene-text-expanded"
        >
          <div className="h-full">
            <div 
              className="text-sm text-gray-800 whitespace-pre-wrap cursor-pointer"
              onClick={handleTextClick}
              onDoubleClick={startEditing}
            >
              {text}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 