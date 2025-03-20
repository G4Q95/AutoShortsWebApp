/**
 * SceneTextContent component for displaying and editing scene text
 */
import React, { useRef, useEffect } from 'react';
import { Type as TypeIcon } from 'lucide-react';

interface SceneTextContentProps {
  /**
   * Current text content
   */
  text: string;
  
  /**
   * Original text from the scene (for comparison)
   */
  originalText: string;
  
  /**
   * Word count of the current text
   */
  wordCount: number;
  
  /**
   * Whether text is currently being edited
   */
  isEditing: boolean;
  
  /**
   * Whether text display is expanded
   */
  isTextExpanded: boolean;
  
  /**
   * Whether the scene is read-only
   */
  readOnly?: boolean;
  
  /**
   * Maximum height for text display in compact mode
   */
  maxCompactHeight?: number;
  
  /**
   * Handler for text change events
   */
  onTextChange: (text: string) => void;
  
  /**
   * Handler for starting edit mode
   */
  onStartEditing: () => void;
  
  /**
   * Handler for saving text
   */
  onSaveText: () => void;
  
  /**
   * Handler for canceling edit
   */
  onCancelEdit: () => void;
  
  /**
   * Handler for keyboard events during editing
   */
  onKeyDown: (e: React.KeyboardEvent) => void;
  
  /**
   * Toggle text expansion
   */
  onToggleTextExpand: () => void;
}

/**
 * Component for displaying and editing scene text content
 * Features:
 * - Text display with word count
 * - In-place editing with save/cancel
 * - Text expansion for long content
 * - Keyboard shortcuts (Ctrl+Enter to save, Esc to cancel)
 */
const SceneTextContentComponent: React.FC<SceneTextContentProps> = ({
  text,
  originalText,
  wordCount,
  isEditing,
  isTextExpanded,
  readOnly = false,
  maxCompactHeight = 60,
  onTextChange,
  onStartEditing,
  onSaveText,
  onCancelEdit,
  onKeyDown,
  onToggleTextExpand
}) => {
  // Reference to the textarea element for auto-focusing
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto-focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // Position cursor at the end of text
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);
  
  // Determine if text is long and needs expansion toggle
  const isLongText = text && text.length > 100;
  
  return (
    <div className="text-content-wrapper relative" data-testid="scene-text-content">
      {/* Text display (when not editing) */}
      {!isEditing && (
        <div 
          className={`relative ${isTextExpanded ? '' : 'max-h-[60px] overflow-hidden'}`}
          data-testid="text-display"
        >
          {/* Text content */}
          <div 
            className="text-sm text-gray-700 mb-1 whitespace-pre-wrap"
            onClick={() => !readOnly && onStartEditing()}
            data-testid="text-display-content"
          >
            {text || 'No text content'}
            
            {/* Word count */}
            <span className="text-xs text-gray-500 ml-1">
              ({wordCount} words)
            </span>
          </div>
          
          {/* Expansion toggle for long text */}
          {isLongText && !isTextExpanded && (
            <button
              onClick={onToggleTextExpand}
              className="absolute bottom-0 right-0 bg-gradient-to-l from-white via-white pl-4 pr-1 text-xs text-blue-600"
              aria-label="Show more"
              data-testid="expand-text-button"
            >
              Show more
            </button>
          )}
          
          {/* Collapse button for expanded text */}
          {isTextExpanded && (
            <button
              onClick={onToggleTextExpand}
              className="text-xs text-blue-600 mt-1"
              aria-label="Show less"
              data-testid="collapse-text-button"
            >
              Show less
            </button>
          )}
        </div>
      )}
      
      {/* Text editor (when editing) */}
      {isEditing && (
        <div className="text-editor-container" data-testid="text-editor">
          {/* Textarea for editing */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full p-1 text-sm border border-gray-300 rounded min-h-[100px] focus:border-blue-400 focus:ring-1 focus:ring-blue-400 focus:outline-none"
            data-testid="text-input"
          />
          
          {/* Action buttons */}
          <div className="flex justify-between items-center mt-1 text-xs">
            <div className="text-gray-500">
              {wordCount} words ({text.length} chars)
              <span className="ml-2 text-gray-400">Ctrl+Enter to save, Esc to cancel</span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                data-testid="cancel-edit-button"
              >
                Cancel
              </button>
              <button
                onClick={onSaveText}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                data-testid="save-text-button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Edit button for non-editing mode */}
      {!isEditing && !readOnly && (
        <button
          onClick={onStartEditing}
          className="absolute top-0 right-0 p-1 text-gray-400 hover:text-gray-600 rounded-full"
          aria-label="Edit text"
          data-testid="edit-text-button"
        >
          <TypeIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

/**
 * Custom comparison function for React.memo
 * Only re-render when essential props change
 */
function arePropsEqual(prevProps: SceneTextContentProps, nextProps: SceneTextContentProps): boolean {
  return (
    prevProps.text === nextProps.text &&
    prevProps.wordCount === nextProps.wordCount &&
    prevProps.isEditing === nextProps.isEditing &&
    prevProps.isTextExpanded === nextProps.isTextExpanded &&
    prevProps.readOnly === nextProps.readOnly &&
    prevProps.maxCompactHeight === nextProps.maxCompactHeight
    // We intentionally exclude function props from comparison
  );
}

/**
 * Memoized version of SceneTextContent to prevent unnecessary re-renders
 */
export const SceneTextContent = React.memo(SceneTextContentComponent, arePropsEqual); 