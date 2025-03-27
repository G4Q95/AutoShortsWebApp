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
    <div className={`flex items-center p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10 ${className}`}>
      {/* Project Title */}
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mr-4">
          {project.title || 'Untitled Project'}
        </h1>
        <SaveStatusIndicator isSaving={isSaving} lastSaved={lastSaved} />
      </div>

      {/* Aspect Ratio Selector */}
      <div className="relative ml-4 mr-4" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <span>Aspect Ratio</span>
          <ChevronDownIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
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

      {/* Spacer */}
      <div className="flex-1"></div>
      
      {/* Save Button */}
      <button
        onClick={onSave}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
      >
        <Save className="w-4 h-4" />
        <span>Save</span>
      </button>
    </div>
  );
};

export default ProjectHeader; 