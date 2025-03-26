/**
 * AspectRatioSelector - UI component for selecting project aspect ratio
 * 
 * Allows users to choose from preset aspect ratios for their project
 * and toggle letterboxing/pillarboxing display.
 */

import React from 'react';
import { Square, LayoutTemplate, Instagram, AlignVerticalJustifyCenter } from 'lucide-react';

export type AspectRatioOption = '9:16' | '16:9' | '1:1' | '4:5';

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
  const ratioOptions = [
    { value: '9:16', label: 'Vertical', icon: <AlignVerticalJustifyCenter className="w-4 h-4" /> },
    { value: '16:9', label: 'Landscape', icon: <LayoutTemplate className="w-4 h-4" /> },
    { value: '1:1', label: 'Square', icon: <Square className="w-4 h-4" /> },
    { value: '4:5', label: 'Instagram', icon: <Instagram className="w-4 h-4" /> }
  ];

  return (
    <div className={`aspect-ratio-selector ${className}`}>
      <div className="flex flex-col space-y-3">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Aspect Ratio
        </div>
        
        <div className="flex flex-wrap gap-2">
          {ratioOptions.map(option => (
            <button
              key={option.value}
              className={`
                flex flex-col items-center justify-center p-2 rounded-md border transition-colors
                ${currentRatio === option.value 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}
              `}
              onClick={() => onChange(option.value as AspectRatioOption)}
              title={`Set aspect ratio to ${option.value}`}
            >
              <div className="p-1">
                {option.icon}
              </div>
              <div className="text-xs mt-1">{option.label}</div>
              <div className="text-[10px] opacity-70">{option.value}</div>
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