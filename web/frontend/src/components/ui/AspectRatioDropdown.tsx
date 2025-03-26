/**
 * AspectRatioDropdown - Compact dropdown for selecting aspect ratio in the project header
 * 
 * Features:
 * - Visual representation of aspect ratios
 * - Toggle for letterboxing display
 * - Designed to fit in project header
 */

import React, { useState, useRef, useEffect } from 'react';
import AspectRatioIcon, { AspectRatioOption } from './AspectRatioIcon';
import AspectRatioSelector from './AspectRatioSelector';

interface AspectRatioDropdownProps {
  currentRatio: AspectRatioOption;
  onChange: (ratio: AspectRatioOption) => void;
  showLetterboxing: boolean;
  onToggleLetterboxing: (show: boolean) => void;
  className?: string;
}

const AspectRatioDropdown: React.FC<AspectRatioDropdownProps> = ({
  currentRatio,
  onChange,
  showLetterboxing,
  onToggleLetterboxing,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        aria-expanded={isOpen}
        aria-controls="aspect-ratio-dropdown"
      >
        <AspectRatioIcon 
          ratio={currentRatio} 
          showLabel={false} 
          size={24} 
        />
        <span className="text-gray-800 dark:text-gray-200">{currentRatio}</span>
      </button>
      
      {/* Dropdown panel */}
      {isOpen && (
        <div 
          id="aspect-ratio-dropdown"
          className="absolute right-0 mt-1 z-50 min-w-[280px] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <div className="p-3">
            <AspectRatioSelector
              currentRatio={currentRatio}
              onChange={(ratio) => {
                onChange(ratio);
                setIsOpen(false);
              }}
              showLetterboxing={showLetterboxing}
              onToggleLetterboxing={onToggleLetterboxing}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AspectRatioDropdown; 