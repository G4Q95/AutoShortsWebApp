import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp, Type as TypeIcon } from 'lucide-react';

interface SceneTextEditorProps {
  /** Text content to display and edit */
  text: string;
  /** Whether the component is in read-only mode */
  readOnly?: boolean;
  /** Callback when text is changed and saved */
  onTextChange?: (newText: string) => void;
  /** Additional CSS classes for container */
  className?: string;
}

/**
 * A component for displaying and editing text content in scenes
 * 
 * Features:
 * - Text expansion for viewing long content
 * - Inline text editing
 * - Proper scrolling behavior in edit mode
 * - Responsive height adjustment
 * 
 * @param props - Component props
 * @returns JSX element
 */
export const SceneTextEditor: React.FC<SceneTextEditorProps> = ({
  text,
  readOnly = false,
  onTextChange,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedText, setEditedText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Update internal text when prop changes
  useEffect(() => {
    setEditedText(text);
  }, [text]);
  
  // Handle text change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedText(e.target.value);
  };
  
  // Save text when exiting edit mode
  const handleBlur = () => {
    if (isEditing && onTextChange) {
      onTextChange(editedText);
    }
    setIsEditing(false);
  };
  
  // Determine if text is long enough to need expansion
  const isLongText = text.length > 100;
  
  // Handle click on text container
  const handleTextClick = () => {
    if (!readOnly) {
      if (isEditing) return;
      if (isExpanded) {
        setIsExpanded(false);
      } else {
        setIsEditing(true);
      }
    } else if (isLongText) {
      setIsExpanded(!isExpanded);
    }
  };
  
  // Add textarea scroll behavior
  useEffect(() => {
    if (!isEditing) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Create style for scrollable textarea
    if (!document.getElementById('scene-text-editor-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'scene-text-editor-styles';
      styleSheet.textContent = `
        .scrollable-textarea {
          overflow-y: auto !important;
          overflow-x: hidden !important;
          scrollbar-width: thin;
        }
        
        .scrollable-textarea::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollable-textarea::-webkit-scrollbar-thumb {
          background-color: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
      `;
      document.head.appendChild(styleSheet);
    }
    
    // Wheel event handler for scrolling
    const handleWheel = (e: WheelEvent) => {
      // Prevent default behavior to stop page scrolling
      e.preventDefault();
      
      // Manually scroll the textarea
      textarea.scrollTop += e.deltaY;
      
      // Stop propagation to parent elements
      e.stopPropagation();
      return false;
    };
    
    // Attach wheel event handler
    textarea.addEventListener('wheel', handleWheel, { passive: false });
    
    // Focus the textarea
    textarea.focus();
    
    // Cleanup
    return () => {
      textarea.removeEventListener('wheel', handleWheel);
    };
  }, [isEditing]);
  
  return (
    <div className={`relative text-editor ${className}`}>
      {/* Base text container (collapsed view) */}
      <div
        className="h-16 overflow-hidden relative text-sm cursor-pointer hover:bg-gray-50 p-1 pt-0.5 pb-0.5 rounded"
        onClick={handleTextClick}
      >
        <p className="text-gray-800 line-clamp-3">{text}</p>
        
        {/* Indicator for expandable text */}
        {isLongText && !isExpanded && !isEditing && (
          <div className="absolute bottom-0 right-0 p-1">
            <ChevronDown className="h-3 w-3 text-blue-600" />
          </div>
        )}
      </div>
      
      {/* Expanded view (without editing) */}
      {isExpanded && !isEditing && (
        <div
          className="absolute top-0 left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-md z-20 p-2 max-h-64 overflow-y-auto"
          style={{ minHeight: '6rem' }}
          onClick={() => setIsExpanded(false)}
        >
          <p className="text-gray-800 mb-4">{text}</p>
          
          {/* Close indicator */}
          <div className="absolute bottom-1 right-1 p-1">
            <ChevronUp className="h-3 w-3 text-blue-600" />
          </div>
        </div>
      )}
      
      {/* Editing interface */}
      {isEditing && (
        <div
          className="absolute top-0 left-0 right-0 z-20 bg-white border border-gray-200 shadow-lg rounded-md p-2"
          style={{ minHeight: '145px' }}
        >
          <textarea
            ref={textareaRef}
            value={editedText}
            onChange={handleTextChange}
            onBlur={handleBlur}
            className="w-full h-full p-2 border border-gray-300 rounded text-sm resize-none scrollable-textarea"
            style={{ minHeight: '120px' }}
            placeholder="Enter scene text..."
            autoFocus
          />
        </div>
      )}
    </div>
  );
};

export default SceneTextEditor; 