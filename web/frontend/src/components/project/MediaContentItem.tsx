'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { 
  Trash2 as TrashIcon, 
  Edit as EditIcon, 
  RefreshCw as RefreshIcon,
  Maximize as MaximizeIcon,
  Play as PlayIcon,
  GripVertical as GripVerticalIcon
} from 'lucide-react';
import { Scene } from './ProjectProvider';
import ErrorDisplay from '../ErrorDisplay';

// Utility function to clean post text by removing "Post by u/Username:" prefix
const cleanPostText = (text: string): string => {
  return text.replace(/^Post by u\/[^:]+:\s*/i, '');
};

interface MediaContentItemProps {
  scene: Scene;
  index: number;
  onRemove: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onRetryLoad?: (url: string) => Promise<void>;
  isDragging?: boolean;
}

export default function MediaContentItem({
  scene,
  index,
  onRemove,
  onTextChange,
  onRetryLoad,
  isDragging = false
}: MediaContentItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(scene.text);
  const [isRetrying, setIsRetrying] = useState(false);
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [expandedView, setExpandedView] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Update component state when scene changes
  useEffect(() => {
    setText(cleanPostText(scene.text));
  }, [scene.text]);
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };
  
  const handleSave = () => {
    onTextChange(scene.id, text);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setText(scene.text);
    setIsEditing(false);
  };

  const handleRetry = async () => {
    if (!onRetryLoad || !scene.url) return;
    
    setIsRetrying(true);
    try {
      await onRetryLoad(scene.url);
    } finally {
      setIsRetrying(false);
    }
  };
  
  const toggleVideoPlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play();
        setVideoIsPlaying(true);
      } else {
        videoRef.current.pause();
        setVideoIsPlaying(false);
      }
    }
  };
  
  const toggleExpandedView = () => {
    setExpandedView(!expandedView);
  };
  
  // Function to render loading state
  const renderLoadingState = () => {
    return (
      <div className="w-full">
        <div className="bg-gray-100 w-full h-48 flex items-center justify-center rounded-t-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700 mb-2"></div>
            <p className="text-gray-600 text-sm">Loading content...</p>
          </div>
        </div>
        <div className="p-4">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
        </div>
      </div>
    );
  };

  // Function to render error state
  const renderErrorState = () => {
    return (
      <div className="w-full">
        <div className="bg-red-50 w-full p-4 rounded-t-lg">
          <ErrorDisplay 
            error={scene.error || 'Failed to load content'} 
            type="extraction" 
            showRetry={!!onRetryLoad}
            onRetry={handleRetry}
          />
        </div>
        <div className="p-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">URL: {scene.url}</p>
        </div>
      </div>
    );
  };
  
  // Function to render the appropriate media component
  const renderMedia = () => {
    if (!scene.media) {
      return (
        <div className="bg-gray-200 w-full h-48 flex items-center justify-center rounded-t-lg">
          <p className="text-gray-500">No media available</p>
        </div>
      );
    }
    
    const mediaHeight = expandedView ? 'h-[300px]' : 'h-48';
    
    switch (scene.media.type) {
      case 'image':
        return (
          <div className={`relative w-full ${mediaHeight} bg-gray-100 rounded-t-lg overflow-hidden group`}>
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Scene image'}
                width={600}
                height={expandedView ? 300 : 200}
                className="rounded-t-lg object-contain h-full w-full"
              />
            </div>
            
            {/* Controls overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={toggleExpandedView}
                className="p-1.5 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full"
                aria-label={expandedView ? "Minimize" : "Maximize"}
              >
                <MaximizeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
        
      case 'video':
        return (
          <div className={`relative w-full ${mediaHeight} bg-black rounded-t-lg overflow-hidden group`}>
            <video
              ref={videoRef}
              src={scene.media.url}
              className="w-full h-full object-contain rounded-t-lg"
              poster={scene.media.thumbnailUrl}
              onPlay={() => setVideoIsPlaying(true)}
              onPause={() => setVideoIsPlaying(false)}
              onEnded={() => setVideoIsPlaying(false)}
            />
            
            {/* Play button overlay */}
            {!videoIsPlaying && (
              <div 
                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                onClick={toggleVideoPlay}
              >
                <div className="bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full p-3">
                  <PlayIcon className="h-6 w-6 text-white" />
                </div>
              </div>
            )}
            
            {/* Controls overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={toggleExpandedView}
                className="p-1.5 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full"
                aria-label={expandedView ? "Minimize" : "Maximize"}
              >
                <MaximizeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
        
      case 'gallery':
        return (
          <div className={`relative w-full ${mediaHeight} bg-gray-100 rounded-t-lg overflow-hidden group`}>
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Gallery image'}
                width={600}
                height={expandedView ? 300 : 200}
                className="rounded-t-lg object-contain h-full w-full"
              />
              <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 text-xs rounded">
                Gallery
              </div>
            </div>
            
            {/* Controls overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={toggleExpandedView}
                className="p-1.5 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full"
                aria-label={expandedView ? "Minimize" : "Maximize"}
              >
                <MaximizeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="bg-gray-200 w-full h-48 flex items-center justify-center rounded-t-lg">
            <p className="text-gray-500">Unknown media type</p>
          </div>
        );
    }
  };
  
  return (
    <div 
      className={`relative border rounded-lg ${
        isDragging ? 'border-blue-500 shadow-lg bg-blue-50' : 'border-gray-300'
      } ${expandedView ? 'shadow-md' : ''}`}
    >
      {/* Scene number indicator */}
      <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm z-10">
        {index + 1}
      </div>
      
      {/* Content based on scene state */}
      {scene.isLoading ? (
        renderLoadingState()
      ) : scene.error ? (
        renderErrorState()
      ) : (
        <>
          {/* Media section */}
          {renderMedia()}
          
          {/* Content section */}
          <div className="p-4">
            {/* Source info */}
            <div className="flex flex-wrap items-center text-xs text-gray-500 mb-2">
              <span className="mr-2">Source: {scene.source.platform}</span>
              {scene.source.author && <span className="mr-2">Author: {scene.source.author}</span>}
              {scene.source.subreddit && <span className="mr-2">Subreddit: r/{scene.source.subreddit}</span>}
              <span>URL: <a href={scene.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{scene.url.substring(0, 30)}...</a></span>
            </div>
            
            {/* Text content */}
            {isEditing ? (
              <div>
                <textarea
                  value={text}
                  onChange={handleTextChange}
                  className="w-full h-32 p-3 border border-gray-300 rounded mb-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter scene text..."
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={handleCancel}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[5rem]">
                <p className="text-gray-800">{cleanPostText(scene.text) || '<No text provided>'}</p>
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Controls */}
      <div className="border-t border-gray-200 p-3 flex justify-between">
        {/* Drag handle indicator */}
        <div className="flex items-center text-gray-400">
          <GripVerticalIcon className="h-4 w-4 mr-1" />
          <span className="text-xs">Drag to reorder</span>
        </div>
            
        {/* Actions */}
        <div className="flex space-x-2">
          {scene.error && onRetryLoad && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded flex items-center transition-colors"
              aria-label="Retry loading content"
            >
              <RefreshIcon className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
              <span className="ml-1 text-xs">Retry</span>
            </button>
          )}
          {!scene.isLoading && !scene.error && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                aria-label="Edit scene"
              >
                <EditIcon className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemove(scene.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                aria-label="Remove scene"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 