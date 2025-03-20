/**
 * SceneActions component
 * Provides action buttons for scene operations like delete
 */
import React from 'react';
import { Trash2 as TrashIcon } from 'lucide-react';

interface SceneActionsProps {
  /**
   * Handler for scene deletion
   */
  onDelete: () => void;
  
  /**
   * Whether the scene is currently being removed
   */
  isRemoving?: boolean;
  
  /**
   * Additional className to apply to the component
   */
  className?: string;
}

/**
 * Component for scene action buttons (delete, duplicate, etc.)
 */
export const SceneActions: React.FC<SceneActionsProps> = ({
  onDelete,
  isRemoving = false,
  className = '',
}) => {
  return (
    <div className={`scene-actions flex ${className}`}>
      <button
        onClick={onDelete}
        disabled={isRemoving}
        className={`flex-shrink-0 w-10 py-2.5 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
        aria-label="Remove scene"
        data-testid="delete-scene-button"
      >
        <TrashIcon className={`h-4 w-4 ${isRemoving ? 'animate-spin' : ''}`} />
      </button>
      
      {/* Additional action buttons can be added here in the future */}
      {/* For example: duplicate, move up/down, etc. */}
    </div>
  );
}; 