'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Scene } from '../ProjectProvider';
import { TrashIcon, ExpandIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

/**
 * Custom hook for scene card UI functionality
 * 
 * @param scene The scene data
 * @param onDeleteScene Callback for scene deletion
 * @returns UI-related state and handlers
 */
export function useSceneUI(
  scene: Scene,
  onDeleteScene: (id: string) => void
) {
  // UI state for scene card
  const [isFlipped, setIsFlipped] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('Delete');
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Toggle between front and back of card (for audio controls)
  const toggleViewMode = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);
  
  // Toggle scene info panel
  const toggleInfo = useCallback(() => {
    setShowInfo(!showInfo);
  }, [showInfo]);
  
  // Handle delete button click
  const handleDelete = useCallback(() => {
    if (confirmDelete) {
      // Execute the delete
      onDeleteScene(scene.id);
      setConfirmDelete(false);
      setDeleteText('Delete');
      
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
        deleteTimeoutRef.current = null;
      }
    } else {
      // Initiate confirmation sequence
      setConfirmDelete(true);
      setDeleteText('Confirm');
      
      // Reset after 3 seconds if not confirmed
      deleteTimeoutRef.current = setTimeout(() => {
        setConfirmDelete(false);
        setDeleteText('Delete');
      }, 3000);
    }
  }, [confirmDelete, onDeleteScene, scene.id]);
  
  // Handle expanding/collapsing the scene card
  const toggleExpand = useCallback(() => {
    setIsExpanded(!isExpanded);
  }, [isExpanded]);
  
  // Clean up any timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    isFlipped,
    setIsFlipped,
    showInfo,
    setShowInfo,
    confirmDelete,
    setConfirmDelete,
    deleteText,
    setDeleteText,
    isExpanded,
    setIsExpanded,
    isDragging,
    setIsDragging,
    toggleViewMode,
    toggleInfo,
    handleDelete,
    toggleExpand
  };
}

/**
 * Renders the header controls for the scene card
 * 
 * @param uiState State and handlers from useSceneUI
 * @param scene The scene data
 * @param sceneIndex Index of the scene in the project
 * @param totalScenes Total number of scenes in the project
 * @returns JSX for scene card header controls
 */
export function renderSceneHeader(
  uiState: ReturnType<typeof useSceneUI>,
  scene: Scene,
  sceneIndex: number,
  totalScenes: number
) {
  const {
    isExpanded,
    toggleExpand,
    toggleInfo,
    handleDelete,
    deleteText,
    confirmDelete
  } = uiState;

  return (
    <div className="flex items-center justify-between bg-white border-b border-gray-200 px-3 py-2 rounded-t-md">
      <div className="flex items-center">
        <span className="text-sm font-medium text-gray-700 mr-2">
          Scene {sceneIndex + 1} of {totalScenes}
        </span>
        <button
          onClick={toggleInfo}
          className="text-xs text-blue-600 hover:text-blue-800"
          aria-label="Toggle scene info"
        >
          Info
        </button>
      </div>
      <div className="flex items-center space-x-1">
        <button
          onClick={toggleExpand}
          className="p-1 text-gray-500 hover:text-gray-700 rounded hover:bg-gray-100"
          aria-label={isExpanded ? "Collapse" : "Expand"}
          data-testid={`expand-button-${scene.id}`}
        >
          {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
        </button>
        <button
          onClick={handleDelete}
          className={`p-1 ${confirmDelete ? 'text-red-600 hover:text-red-800' : 'text-gray-500 hover:text-gray-700'} rounded hover:bg-gray-100`}
          aria-label={confirmDelete ? "Confirm delete" : "Delete scene"}
          data-testid={`delete-button-${scene.id}`}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Renders the info panel for the scene card
 * 
 * @param scene The scene data
 * @param showInfo Whether to show the info panel
 * @returns JSX for scene info panel
 */
export function renderSceneInfo(scene: Scene, showInfo: boolean) {
  if (!showInfo) return null;

  return (
    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs" data-testid="scene-info-panel">
      <div className="mb-1">
        <span className="font-semibold">ID:</span> {scene.id}
      </div>
      <div className="mb-1">
        <span className="font-semibold">Created:</span> {new Date(scene.createdAt).toLocaleString()}
      </div>
      {scene.updatedAt && (
        <div className="mb-1">
          <span className="font-semibold">Updated:</span> {new Date(scene.updatedAt).toLocaleString()}
        </div>
      )}
      {scene.voice_settings && (
        <div>
          <span className="font-semibold">Voice:</span> {scene.voice_settings.voice_id}
        </div>
      )}
    </div>
  );
}

// UI-related functions will go here
export const placeholder = true; 