'use client';

import React, { useState } from 'react';
import { Scene } from './ProjectProvider';
import {
  Trash2 as TrashIcon,
  Edit as EditIcon,
  GripVertical as GripVerticalIcon,
  RefreshCw as RefreshIcon,
} from 'lucide-react';
import Image from 'next/image';
import ErrorDisplay from '../ErrorDisplay';

// Utility function to clean post text by removing "Post by u/Username:" prefix
const cleanPostText = (text: string): string => {
  return text.replace(/^Post by u\/[^:]+:\s*/i, '');
};

interface SceneComponentProps {
  scene: Scene;
  index: number;
  onRemove: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  onRetryLoad?: (url: string) => Promise<void>;
  isDragging?: boolean;
}

export default function SceneComponent({
  scene,
  index,
  onRemove,
  onTextChange,
  onRetryLoad,
  isDragging = false,
}: SceneComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(cleanPostText(scene.text));
  const [isRetrying, setIsRetrying] = useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const handleSave = () => {
    onTextChange(scene.id, text);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setText(cleanPostText(scene.text));
    setIsEditing(false);
  };

  const handleRetry = async () => {
    if (!onRetryLoad || !scene.url) return;

    setIsRetrying(true);
    try {
      await onRetryLoad(scene.url);
    } catch (error) {
      console.error('Failed to retry loading content:', error);
    } finally {
      setIsRetrying(false);
    }
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
        <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
          <p className="text-gray-500">No media available</p>
        </div>
      );
    }

    switch (scene.media.type) {
      case 'image':
        return (
          <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Scene image'}
                width={400}
                height={200}
                className="rounded-t-lg h-40 object-contain"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="relative w-full h-40 bg-black rounded-t-lg overflow-hidden">
            <video
              src={scene.media.url}
              controls
              className="w-full h-full object-contain rounded-t-lg"
            />
          </div>
        );

      case 'gallery':
        // For simplicity, just show the first image of the gallery
        return (
          <div className="relative w-full h-40 bg-gray-100 rounded-t-lg overflow-hidden">
            <div className="w-full h-full flex items-center justify-center">
              <Image
                src={scene.media.url}
                alt={scene.text || 'Gallery image'}
                width={400}
                height={200}
                className="rounded-t-lg h-40 object-contain"
                style={{ maxWidth: '100%' }}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-200 w-full h-40 flex items-center justify-center rounded-t-lg">
            <p className="text-gray-500">Unsupported media type</p>
          </div>
        );
    }
  };

  return (
    <div
      className={`relative rounded-lg border overflow-hidden shadow-sm bg-white 
      ${isDragging ? 'border-blue-500 shadow-lg bg-blue-50' : 'border-gray-300'}`}
    >
      {/* Scene number indicator */}
      <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium z-10">
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
          <div className="p-3">
            {/* Source info */}
            <div className="flex flex-wrap items-center text-xs text-gray-500 mb-1">
              {scene.source.author && (
                <span className="mr-1 truncate">By: {scene.source.author}</span>
              )}
              {scene.source.subreddit && (
                <span className="truncate">r/{scene.source.subreddit}</span>
              )}
            </div>

            {/* Text content */}
            {isEditing ? (
              <div>
                <textarea
                  value={text}
                  onChange={handleTextChange}
                  className="w-full h-20 p-2 border border-gray-300 rounded mb-2 text-sm"
                  placeholder="Enter scene text..."
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={handleCancel}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[3rem] max-h-24 overflow-y-auto text-sm">
                <p className="text-gray-800">{cleanPostText(scene.text) || '<No text provided>'}</p>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="border-t border-gray-200 p-2 flex justify-end space-x-1">
            {scene.error && onRetryLoad && (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm flex items-center text-xs"
                aria-label="Retry loading content"
              >
                <RefreshIcon className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                <span className="ml-1">Retry</span>
              </button>
            )}
            {!scene.isLoading && !scene.error && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm text-xs"
                aria-label="Edit scene"
              >
                <EditIcon className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={() => onRemove(scene.id)}
              className="p-1 text-red-600 hover:bg-red-50 rounded-sm text-xs"
              aria-label="Remove scene"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
