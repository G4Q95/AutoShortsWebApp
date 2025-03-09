'use client';

import React, { useState } from 'react';
import { Scene } from './ProjectProvider';
import { Trash2 as TrashIcon, Edit as EditIcon, GripVertical as GripVerticalIcon } from 'lucide-react';
import Image from 'next/image';

interface SceneComponentProps {
  scene: Scene;
  index: number;
  onRemove: (id: string) => void;
  onTextChange: (id: string, text: string) => void;
  isDragging?: boolean;
}

export default function SceneComponent({ 
  scene, 
  index, 
  onRemove, 
  onTextChange,
  isDragging = false
}: SceneComponentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(scene.text);
  
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
  
  // Function to render the appropriate media component
  const renderMedia = () => {
    if (!scene.media) {
      return (
        <div className="bg-gray-200 w-full h-48 flex items-center justify-center rounded-t-lg">
          <p className="text-gray-500">No media available</p>
        </div>
      );
    }
    
    switch (scene.media.type) {
      case 'image':
        return (
          <div className="relative w-full h-48 bg-gray-100 rounded-t-lg overflow-hidden">
            <Image
              src={scene.media.url}
              alt={scene.text || 'Scene image'}
              layout="fill"
              objectFit="cover"
              className="rounded-t-lg"
            />
          </div>
        );
        
      case 'video':
        return (
          <div className="relative w-full h-48 bg-black rounded-t-lg overflow-hidden">
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
          <div className="relative w-full h-48 bg-gray-100 rounded-t-lg overflow-hidden">
            <Image
              src={scene.media.url}
              alt={scene.text || 'Gallery image'}
              layout="fill"
              objectFit="cover"
              className="rounded-t-lg"
            />
            <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 text-xs rounded">
              Gallery
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
      className={`relative border rounded-lg mb-4 ${
        isDragging ? 'border-blue-500 shadow-lg' : 'border-gray-300'
      }`}
    >
      {/* Drag handle */}
      <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 cursor-grab p-2">
        <GripVerticalIcon className="h-6 w-6 text-gray-400" />
      </div>
      
      {/* Scene number indicator */}
      <div className="absolute top-2 left-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
        {index + 1}
      </div>
      
      {/* Media section */}
      {renderMedia()}
      
      {/* Content section */}
      <div className="p-4">
        {/* Source info */}
        <div className="flex items-center text-xs text-gray-500 mb-2">
          <span className="mr-2">Source: {scene.source.platform}</span>
          {scene.source.author && <span className="mr-2">Author: {scene.source.author}</span>}
          {scene.source.subreddit && <span>Subreddit: r/{scene.source.subreddit}</span>}
        </div>
        
        {/* Text content */}
        {isEditing ? (
          <div>
            <textarea
              value={text}
              onChange={handleTextChange}
              className="w-full h-24 p-2 border border-gray-300 rounded mb-2"
              placeholder="Enter scene text..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-[5rem]">
            <p className="text-gray-800">{scene.text || '<No text provided>'}</p>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="border-t border-gray-200 p-3 flex justify-end space-x-2">
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
          aria-label="Edit scene"
        >
          <EditIcon className="h-4 w-4" />
        </button>
        <button
          onClick={() => onRemove(scene.id)}
          className="p-2 text-red-600 hover:bg-red-50 rounded"
          aria-label="Remove scene"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 