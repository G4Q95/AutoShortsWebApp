'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronUp as ChevronUpIcon,
  X as XIcon,
  Info as InfoIcon
} from 'lucide-react';
import { 
  cleanPostText,
  createTextChangeHandler,
  createSaveTextHandler
} from '@/utils/scene/event-handlers/text-handlers';

interface SceneTextEditorWrapperProps {
  sceneId: string;
  text: string;
  originalText: string;
  url?: string;
  sourceInfo?: {
    author?: string;
    subreddit?: string;
  };
  readOnly?: boolean;
  index: number;
  onTextChange: (text: string) => void;
  onUpdateSceneText: (sceneId: string, text: string) => void;
  onSceneReorder: (sceneId: string, index: number) => void;
}

export const SceneTextEditorWrapper: React.FC<SceneTextEditorWrapperProps> = ({
  sceneId,
  text: propText,
  originalText,
  url,
  sourceInfo,
  readOnly = false,
  index,
  onTextChange,
  onUpdateSceneText,
  onSceneReorder
}) => {
  // Local state
  const [text, setText] = useState(cleanPostText(propText));
  const [isEditing, setIsEditing] = useState(false);
  const [isTextExpanded, setIsTextExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  
  // Update text state when prop changes
  useEffect(() => {
    setText(cleanPostText(propText));
  }, [propText]);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Handlers
  const handleTextChange = createTextChangeHandler(setText);
  
  const saveTextHandler = createSaveTextHandler(
    sceneId,
    text,
    originalText,
    onUpdateSceneText,
    onSceneReorder,
    index,
    setIsEditing
  );
  
  const handleTextBlur = () => {
    saveTextHandler();
    // Propagate the change to parent
    onTextChange(text);
  };
  
  // Function to render text content with overlay expansion
  const renderTextContent = () => {
    const displayText = text || '<No text provided>';
    const isLongText = displayText.length > 100;
    
    return (
      <div className="relative" style={{ height: '85px' }} data-test-layout="text-content-container">
        {/* Base text container - always visible when not editing */}
        <div 
          className="h-24 overflow-hidden relative text-sm cursor-pointer hover:bg-gray-50 p-1 pt-0.5 pb-1 rounded"
          onClick={() => !readOnly && setIsEditing(true)}
          data-test-layout="text-display"
          data-test-dimensions={`height:24px;overflow:hidden`}
          data-testid="scene-text"
        >
          <p className="text-gray-800 line-clamp-3">{displayText}</p>
          
          {/* Info button in the top-right corner of text box */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(!showInfo);
            }}
            className="absolute top-0 right-0 p-0.5 text-blue-500 hover:text-blue-700 z-10 transition-colors"
            title="Show source information"
            aria-label="Show source information"
            data-testid="info-button"
            style={{
              top: "-2px",
              right: "-2px",
              padding: "2px",
              backgroundColor: "transparent",
              borderRadius: "0 0 0 4px"
            }}
          >
            <InfoIcon size={12} />
          </button>
        </div>
        
        {/* Expanded overlay - shown when user expands without editing */}
        {isTextExpanded && !isEditing && (
          <div 
            className="absolute top-0 left-0 right-0 bg-white border border-gray-200 shadow-lg rounded-md z-40 p-2 max-h-64 overflow-y-auto"
            style={{ minHeight: '6rem' }}
            onClick={() => setIsTextExpanded(false)}
            data-test-layout="text-expanded-overlay"
            data-test-dimensions={`min-height:6rem;max-height:16rem`}
          >
            <p className="text-gray-800 mb-2">{displayText}</p>
            
            {/* Close indicator */}
            <div className="absolute bottom-1 right-1 p-1">
              <ChevronUpIcon className="h-3 w-3 text-blue-600" />
            </div>
          </div>
        )}
        
        {/* Info overlay - shown when info button is clicked */}
        {showInfo && !isEditing && (
          <div 
            className="absolute top-0 right-0 bg-white border border-gray-200 shadow-lg rounded-md z-50 p-2 mt-6 mr-1 w-64 text-xs"
            style={{ maxWidth: 'calc(100% - 8px)' }}
          >
            <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-200">
              <span className="font-semibold text-gray-700">Source Information</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowInfo(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
            
            {/* Username/Author */}
            {sourceInfo && sourceInfo.author && (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-semibold">By:</span>
                <span>{sourceInfo.author}</span>
              </div>
            )}
            
            {/* Subreddit */}
            {sourceInfo && sourceInfo.subreddit && (
              <div className="flex items-center gap-1 mb-0.5">
                <span className="font-semibold">Subreddit:</span>
                <span>r/{sourceInfo.subreddit}</span>
              </div>
            )}
            
            {/* Full URL */}
            {url && (
              <div className="flex flex-col gap-0.5">
                <a 
                  href={url} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline truncate"
                >
                  {url}
                </a>
              </div>
            )}
          </div>
        )}
        
        {/* Editing interface - absolute overlay that covers everything below */}
        {isEditing && (
          <div 
            className="absolute left-0 right-0 z-50 bg-white border border-gray-300 shadow-md rounded-md overflow-hidden"
            style={{ 
              top: '0',
              bottom: '-85px', 
              height: 'auto',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}
            data-test-layout="text-editor-overlay"
            data-test-dimensions={`position:absolute;top:0;bottom:-85px`}
          >
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onBlur={handleTextBlur}
              className="w-full h-full p-2 text-sm resize-none scrollable-textarea"
              style={{ 
                height: 'calc(100% - 26px)',
                minHeight: '160px',
                borderBottom: '2px solid #e5e7eb',
                paddingBottom: '8px'
              }}
              placeholder="Enter scene text..."
              autoFocus
              data-test-layout="text-editor-textarea"
              data-test-dimensions={`min-height:160px;height:calc(100% - 26px)`}
              data-testid="scene-text-textarea"
            />
            {/* Footer with save hint - with proper rounded corners to match top */}
            <div className="bg-gray-100 py-1.5 px-2 text-xs text-gray-500 flex justify-end border-t border-gray-300"
                style={{borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px'}}
                data-test-layout="text-editor-footer">
              <span>Click outside to save</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-testid="scene-text-section">
      {renderTextContent()}
    </div>
  );
}; 