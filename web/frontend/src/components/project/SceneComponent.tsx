'use client';

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { useProject } from './ProjectProvider';
import { Scene } from './ProjectProvider';
import ErrorDisplay from '../ErrorDisplay';
import { GripVertical as GripVerticalIcon } from 'lucide-react';

// Import extracted function hooks
import { useTextLogic, renderTextContent, getWordCount } from './scene-functions/text-functions';
import { useMediaLogic, renderMediaSection, MediaType } from './scene-functions/media-functions';
import { useVoiceLogic, renderVoiceControls } from './scene-functions/voice-functions';
import { useSceneUI, renderSceneHeader, renderSceneInfo } from './scene-functions/ui-functions';

/**
 * Props for the SceneComponent
 */
interface SceneComponentProps {
  /** Scene data containing content and media information */
  scene: Scene;
  /** Preview URL for the scene's media content */
  preview: string | null;
  /** Index of the scene in the project */
  index: number;
  /** Callback to remove a scene */
  onSceneRemove: (id: string) => void;
  /** Callback when a scene is being moved (during drag) */
  onSceneMove: (id: string, newIndex: number) => void;
  /** Callback when a scene's position is finalized */
  onSceneReorder: (id: string, newIndex: number) => void;
  /** Whether the scene is in reorder mode */
  reorderMode?: boolean;
  /** Whether the scene is read-only */
  readOnly?: boolean;
  /** Reference to the text editor element */
  editorRef?: React.RefObject<HTMLTextAreaElement>;
  /** Whether the scene is currently being dragged */
  isDragging?: boolean;
  /** Whether to display the scene at full width */
  isFullWidth?: boolean;
  /** Custom styles for the scene component */
  customStyles?: React.CSSProperties;
  /** Feature flag to use the new voice controls */
  useNewVoiceControls?: boolean;
}

/**
 * A component that displays and manages a single scene in a project.
 * Handles media display, text content, drag-and-drop reordering, and scene actions.
 */
export const SceneComponent: React.FC<SceneComponentProps> = memo(function SceneComponent({
  scene,
  preview,
  index,
  onSceneRemove,
  onSceneMove,
  onSceneReorder,
  reorderMode = false,
  readOnly = false,
  editorRef,
  isDragging = false,
  isFullWidth = false,
  customStyles = {},
  useNewVoiceControls = false
}: SceneComponentProps) {
  // Access project context
  const { updateScene, scenes, currentProjectId } = useProject();

  // State for error handling
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Ref for the drag handle
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // Helper functions for updating scene data
  const updateSceneText = useCallback((id: string, text: string) => {
    updateScene(id, { text });
  }, [updateScene]);

  const updateSceneMedia = useCallback((id: string, mediaData: any) => {
    updateScene(id, { media: mediaData });
  }, [updateScene]);

  const updateSceneAudio = useCallback((id: string, audioData: any, voiceSettings: any) => {
    updateScene(id, { audio: audioData, voice_settings: voiceSettings });
  }, [updateScene]);

  // Use extracted function hooks
  const mediaState = useMediaLogic(scene, updateSceneMedia);
  const textState = useTextLogic(scene, updateSceneText);
  const voiceState = useVoiceLogic(scene, updateSceneAudio, currentProjectId || '');
  const uiState = useSceneUI(scene, onSceneRemove);

  // Handle scene position during drag-and-drop
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!reorderMode || readOnly) return;
    
    e.dataTransfer.setData('scene_id', scene.id);
    e.dataTransfer.effectAllowed = 'move';
    
    if (dragHandleRef.current) {
      const rect = dragHandleRef.current.getBoundingClientRect();
      e.dataTransfer.setDragImage(
        dragHandleRef.current,
        e.clientX - rect.left,
        e.clientY - rect.top
      );
    }
    
    onSceneMove(scene.id, index);
  }, [scene.id, index, onSceneMove, reorderMode, readOnly]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!reorderMode || readOnly) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [reorderMode, readOnly]);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!reorderMode || readOnly) return;
    
    e.preventDefault();
    const draggedSceneId = e.dataTransfer.getData('scene_id');
    
    if (draggedSceneId && draggedSceneId !== scene.id) {
      onSceneReorder(draggedSceneId, index);
    }
  }, [scene.id, index, onSceneReorder, reorderMode, readOnly]);

  // Compute container class name based on component state
  const containerClassName = useMemo(() => {
    const baseClass = "bg-white rounded-lg shadow-md mb-4 flex flex-col relative transition-all";
    const widthClass = isFullWidth ? "w-full max-w-full" : "max-w-2xl mx-auto";
    const stateClass = isDragging 
      ? "border-2 border-blue-500 opacity-50" 
      : "border border-gray-200";
    
    return `${baseClass} ${widthClass} ${stateClass} ${uiState.isExpanded ? 'expanded' : ''}`;
  }, [isFullWidth, isDragging, uiState.isExpanded]);

  // Render loading state
  const renderLoadingState = () => {
    if (!isLoading) return null;
    
    return (
      <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  };

  // Render error state
  const renderErrorState = () => {
    if (!loadError) return null;
    
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md my-2">
        <ErrorDisplay error={loadError} />
        <button 
          onClick={() => setLoadError(null)}
          className="mt-2 text-sm text-red-600 hover:text-red-800"
        >
          Dismiss
        </button>
      </div>
    );
  };

  return (
    <div
      className={containerClassName}
      style={customStyles}
      draggable={reorderMode && !readOnly}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      data-testid={`scene-${scene.id}`}
    >
      {/* Render Scene Header */}
      {renderSceneHeader(uiState, scene, index, scenes?.length || 0)}
      
      {/* Render Scene Info Panel */}
      {renderSceneInfo(scene, uiState.showInfo)}
      
      {/* Drag Handle (visible in reorder mode) */}
      {reorderMode && !readOnly && (
        <div 
          ref={dragHandleRef}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-move"
          data-testid={`drag-handle-${scene.id}`}
        >
          <GripVerticalIcon className="w-4 h-4 text-gray-400" />
        </div>
      )}
      
      {/* Main Content Area */}
      <div className="p-3 flex-1 flex flex-col">
        {/* Media Section */}
        {renderMediaSection(mediaState)}
        
        {/* Error Display */}
        {renderErrorState()}
        
        {/* Text Content */}
        {renderTextContent(textState, scene)}
        
        {/* Voice Controls */}
        {renderVoiceControls(voiceState, scene, textState.text, useNewVoiceControls)}
      </div>
      
      {/* Loading Overlay */}
      {renderLoadingState()}
    </div>
  );
});
