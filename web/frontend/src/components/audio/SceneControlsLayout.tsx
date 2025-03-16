import React from 'react';
import { Trash2 as TrashIcon } from 'lucide-react';

interface SceneControlsLayoutProps {
  /** The audio controls to render */
  children: React.ReactNode;
  /** Whether the scene is being removed */
  isRemoving: boolean;
  /** Handler for removing the scene */
  onRemoveScene: () => void;
  /** Custom CSS properties */
  customStyles?: React.CSSProperties;
}

/**
 * A layout wrapper component that maintains exact positioning between
 * audio controls and the trash button with fixed dimensions
 */
export const SceneControlsLayout: React.FC<SceneControlsLayoutProps> = ({
  children,
  isRemoving,
  onRemoveScene,
  customStyles = {}
}) => {
  return (
    <div className="border-t border-gray-200 flex justify-between items-stretch" style={customStyles}>
      {/* Content area for audio controls - maintains exact width calculation */}
      <div 
        className="relative flex-grow flex pr-0" 
        style={{ 
          marginRight: '0', 
          padding: '0', 
          width: 'calc(100% - 40px)' // Exact width calculation 
        }}
      >
        {children}
      </div>
      
      {/* Trash button with exact positioning and styling */}
      <button
        onClick={onRemoveScene}
        disabled={isRemoving}
        className={`flex-shrink-0 w-10 py-2 bg-red-600 text-white text-sm font-medium rounded-br-md flex items-center justify-center transition-colors hover:bg-red-700 ${isRemoving ? 'opacity-50' : ''} shadow-sm`}
        aria-label="Remove scene"
        style={{ marginLeft: '0' }} 
      >
        <TrashIcon className={`h-4 w-4 ${isRemoving ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

export default SceneControlsLayout; 