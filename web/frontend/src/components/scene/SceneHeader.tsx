/**
 * SceneHeader component for Scene cards
 * Displays scene number, view mode toggle, and info toggle
 */
import React from 'react';
import { 
  ChevronDown as ChevronDownIcon, 
  ChevronUp as ChevronUpIcon,
  Info as InfoIcon
} from 'lucide-react';

interface SceneHeaderProps {
  /**
   * Index of the scene (for numbering)
   */
  index: number;
  
  /**
   * Whether the scene is in compact view mode
   */
  isCompactView: boolean;
  
  /**
   * Whether the info section is visible
   */
  showInfo: boolean;
  
  /**
   * Handler for toggling compact/expanded view
   */
  onToggleViewMode: () => void;
  
  /**
   * Handler for toggling info section visibility
   */
  onToggleInfo: () => void;
}

/**
 * Header component for Scene cards
 * Displays scene number and controls for view mode and info visibility
 */
export const SceneHeader: React.FC<SceneHeaderProps> = ({
  index,
  isCompactView,
  showInfo,
  onToggleViewMode,
  onToggleInfo
}) => {
  return (
    <div 
      className="flex items-center justify-between p-1 bg-gray-50"
      data-testid="scene-header"
    >
      {/* Scene number */}
      <div 
        className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-medium"
        data-testid={`scene-number-${index + 1}`}
      >
        {index + 1}
      </div>
      
      {/* Controls */}
      <div className="flex items-center space-x-2">
        {/* View mode toggle */}
        <button
          onClick={onToggleViewMode}
          className="p-1 text-gray-600 hover:text-gray-900 rounded-full"
          aria-label={isCompactView ? "Expand view" : "Compact view"}
          title={isCompactView ? "Expand view" : "Compact view"}
          data-testid="view-mode-toggle"
        >
          {isCompactView ? (
            <ChevronDownIcon className="h-4 w-4" />
          ) : (
            <ChevronUpIcon className="h-4 w-4" />
          )}
        </button>
        
        {/* Info toggle */}
        <button
          onClick={onToggleInfo}
          className={`p-1 rounded-full ${
            showInfo ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-gray-900'
          }`}
          aria-label={showInfo ? "Hide info" : "Show info"}
          title={showInfo ? "Hide info" : "Show info"}
          data-testid="info-toggle"
        >
          <InfoIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}; 