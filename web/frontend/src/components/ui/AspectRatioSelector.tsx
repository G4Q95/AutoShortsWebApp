/**
 * AspectRatioSelector - UI component for selecting project aspect ratio
 * 
 * Allows users to choose from preset aspect ratios for their project
 * and toggle letterboxing/pillarboxing display.
 */

import React from 'react';
import AspectRatioIcon, { AspectRatioOption } from './AspectRatioIcon';

interface AspectRatioSelectorProps {
  currentRatio: AspectRatioOption;
  onChange: (ratio: AspectRatioOption) => void;
  showLetterboxing: boolean;
  onToggleLetterboxing: (show: boolean) => void;
  className?: string;
}

const AspectRatioSelector: React.FC<AspectRatioSelectorProps> = ({
  currentRatio,
  onChange,
  showLetterboxing,
  onToggleLetterboxing,
  className = ''
}) => {
  const ratioOptions: AspectRatioOption[] = ['9:16', '16:9', '1:1', '4:5'];

  return (
    <div className={`aspect-ratio-selector ${className}`}>
      <div className="flex flex-col space-y-4">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Aspect Ratio
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          {ratioOptions.map(ratio => (
            <button
              key={ratio}
              className={`
                flex flex-col items-center justify-center p-2 rounded-md transition-colors
                ${currentRatio === ratio 
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}
              `}
              onClick={() => onChange(ratio)}
              title={`Set aspect ratio to ${ratio}`}
            >
              <AspectRatioIcon 
                ratio={ratio} 
                isSelected={currentRatio === ratio}
                size={48}
              />
            </button>
          ))}
        </div>
        
        <div className="mt-2">
          <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showLetterboxing}
              onChange={(e) => onToggleLetterboxing(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
            />
            <span>Show letterboxing/pillarboxing</span>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-6">
            Preview how your content will look in the selected aspect ratio
          </p>
        </div>
      </div>
    </div>
  );
};

export default AspectRatioSelector; 