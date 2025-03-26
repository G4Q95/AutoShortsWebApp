/**
 * AspectRatioIcon - Visual representation of different aspect ratios
 * 
 * Displays a rectangle with the actual proportions of the aspect ratio
 * to give users a visual representation of how their content will appear.
 */

import React from 'react';

export type AspectRatioOption = '9:16' | '16:9' | '1:1' | '4:5';

interface AspectRatioIconProps {
  ratio: AspectRatioOption;
  className?: string;
  size?: number;
  showLabel?: boolean;
  isSelected?: boolean;
}

/**
 * Returns width and height values based on a standard size to maintain
 * proper aspect ratio visualization
 */
const getAspectRatioDimensions = (ratio: AspectRatioOption, baseSize: number = 40): { width: number; height: number } => {
  switch (ratio) {
    case '9:16':
      return { width: baseSize * (9/16), height: baseSize };
    case '16:9':
      return { width: baseSize, height: baseSize * (9/16) };
    case '1:1':
      return { width: baseSize * 0.75, height: baseSize * 0.75 };
    case '4:5':
      return { width: baseSize * (4/5) * 0.85, height: baseSize * 0.85 };
  }
};

const AspectRatioIcon: React.FC<AspectRatioIconProps> = ({
  ratio,
  className = '',
  size = 40,
  showLabel = true,
  isSelected = false,
}) => {
  const { width, height } = getAspectRatioDimensions(ratio, size);
  
  // Common labels for each aspect ratio
  const labels: Record<AspectRatioOption, string> = {
    '9:16': 'Vertical',
    '16:9': 'Landscape',
    '1:1': 'Square',
    '4:5': 'Instagram',
  };

  // Border styles based on selection state
  const borderStyle = isSelected 
    ? 'border-2 border-blue-500' 
    : 'border border-gray-300 dark:border-gray-600';

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div 
        className={`bg-white dark:bg-gray-800 ${borderStyle} flex items-center justify-center rounded-sm overflow-hidden`}
        style={{ 
          width: size, 
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div 
          className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40' : ''}`}
          style={{ 
            width: width, 
            height: height, 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: Math.min(width, height) * 0.4,
            fontWeight: 'bold',
            color: isSelected ? '#3b82f6' : '#6b7280',
          }}
        >
          {ratio}
        </div>
      </div>
      
      {showLabel && (
        <div className="text-xs mt-1 text-center">
          {labels[ratio]}
        </div>
      )}
    </div>
  );
};

export default AspectRatioIcon; 