import React, { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import AspectRatioSelector from '@/components/ui/AspectRatioSelector';
import { useProject } from '@/components/project/ProjectProvider';
import SaveStatusIndicator from './SaveStatusIndicator';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

interface ProjectHeaderProps {
  onSave?: () => void;
  className?: string;
  isSaving?: boolean;
  lastSaved?: number | null;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({ 
  onSave,
  className = '',
  isSaving = false,
  lastSaved = null
}) => {
  const { currentProject: project, setProjectAspectRatio, toggleLetterboxing } = useProject();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  if (!project) return null;

  return (
    <div className={`p-2 md:p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 ${className}`}>
      <div className="flex items-center justify-between">
        {/* Flexible title container */}
        <div className="flex items-center overflow-hidden max-w-[70%]">
          <h1 className="text-base md:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
            {project.title || 'Untitled Project'}
          </h1>
          {/* StatusIndicator with responsive sizing and truncate */}
          <div className="ml-1 md:ml-2 hidden sm:block max-w-[80px] md:max-w-[120px] overflow-hidden">
            <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
          </div>
        </div>

        {/* Controls - scale down on smaller screens */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Aspect Ratio Selector - smaller on small screens */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className="flex items-center gap-1 md:gap-2 px-2 py-1 md:px-3 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span>Aspect Ratio</span>
              <ChevronDownIcon className="w-4 h-4 md:w-5 md:h-5 text-gray-400" aria-hidden="true" />
            </button>

            {isSettingsOpen && (
              <div className="absolute right-0 z-10 mt-2 origin-top-right bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <AspectRatioSelector
                  currentRatio={project?.aspectRatio || '9:16'}
                  showLetterboxing={project?.showLetterboxing || false}
                  onChange={async (ratio) => {
                    console.log('Changing aspect ratio to:', ratio);
                    try {
                      await setProjectAspectRatio(ratio);
                      console.log('Successfully updated aspect ratio');
                    } catch (error) {
                      console.error('Failed to update aspect ratio:', error);
                    }
                  }}
                  onToggleLetterboxing={(show) => {
                    console.log('Toggling letterboxing:', show);
                    toggleLetterboxing(show);
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Save Button - smaller on small screens */}
          <button
            onClick={onSave}
            className="flex items-center space-x-1 md:space-x-2 px-2 py-1 md:px-4 md:py-2 text-xs md:text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save className="w-3 h-3 md:w-4 md:h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectHeader; 