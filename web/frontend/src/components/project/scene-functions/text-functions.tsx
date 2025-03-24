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
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Update local text state when scene text changes
  useEffect(() => {
    // Clean post text to remove "Post by u/..." prefix
    const cleanedText = scene.text ? cleanPostText(scene.text) : '';
    setText(cleanedText);
    setWordCount(getWordCount(cleanedText));
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
    setIsExpanded(true);
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
  const handleTextBlur = useCallback((e: React.FocusEvent<Element>) => {
    // Don't collapse if clicking inside the textarea or on the info button
    if (e.relatedTarget && 
        (e.currentTarget.contains(e.relatedTarget as Node) || 
        (e.relatedTarget as HTMLElement).getAttribute('data-testid') === 'info-button')) {
      return;
    }
    
    setIsEditing(false);
    setIsExpanded(false);
    if (text !== cleanPostText(scene.text)) {
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
  
  // Clean Reddit post text by removing common artifacts
  const cleanPostText = (text: string): string => {
    if (!text) return '';
    
    // Remove common Reddit artifacts and source information
    const cleaned = text
      .replace(/\[removed\]/g, '')
      .replace(/\[deleted\]/g, '')
      // Remove "Post by u/username: " prefix
      .replace(/^Post by u\/[^:]+:\s*/i, '')
      .trim();
    
    return cleaned;
  };

  // Add handleClickOutside function for expanded text overlay
  const handleClickOutside = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsEditing(false);
    setIsExpanded(false);
    if (text !== cleanPostText(scene.text)) {
      updateSceneText(scene.id, text);
    }
  }, [text, scene.id, scene.text, updateSceneText]);

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
    handleKeyDown,
    isExpanded,
    setIsExpanded,
    handleClickOutside
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
    handleKeyDown,
    isExpanded,
    handleClickOutside
  } = textState;

  return (
    <div className="mt-1 text-sm relative" style={{ height: '3.6em' }}>
      {/* Info button and popup removed since they're now in voice controls */}
      
      {/* Fixed height container for text with exactly 3 lines visible */}
      <div className="h-full w-full">
        {/* Normal (collapsed) text display - always exactly 3 lines */}
        <div 
          className={`w-full h-full p-0.5 line-clamp-3 overflow-hidden cursor-text ${!isExpanded ? 'block' : 'hidden'}`}
          onClick={handleTextClick}
          data-testid="scene-text-display-collapsed"
        >
          {text || (
            <span className="text-gray-400 italic">
              Enter text content for this scene...
            </span>
          )}
        </div>
        
        {/* Expanded text area that pops out */}
        {isExpanded && (
          <>
            {/* Overlay to capture clicks outside */}
            <div 
              className="fixed inset-0 z-20" 
              onClick={handleClickOutside}
            ></div>
            
            {/* Expanded text container */}
            <div 
              className="absolute z-30 bg-white overflow-auto"
              style={{
                top: '0',
                left: '0',
                right: '0',
                bottom: '-70px', // Extend to bottom of scene card
                border: '1px solid #e5e7eb',
                borderRadius: '0 0 8px 8px', // Rounded corners at the bottom
                boxShadow: '0 1px 2px rgba(0,0,0,0.08)', // Lighter, less blurry shadow
                backfaceVisibility: 'hidden', // Helps with text sharpness
                WebkitFontSmoothing: 'antialiased', // Improves text rendering
                MozOsxFontSmoothing: 'grayscale' // Improves text rendering in Firefox
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isEditing ? (
                <textarea
                  ref={textareaRef}
                  className="w-full p-0.5 text-sm resize-none font-normal border-none focus:outline-none focus:ring-0 rounded-b-lg"
                  style={{ minHeight: '100%' }}
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
                  className="w-full h-full p-0.5 text-sm text-gray-800 whitespace-pre-wrap cursor-text rounded-b-lg"
                  onClick={handleTextClick}
                  data-testid="scene-text-display-expanded"
                >
                  {text || (
                    <span className="text-gray-400 italic">
                      Enter text content for this scene...
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
} 