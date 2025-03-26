import React, { useState } from 'react';
import { Save, Settings } from 'lucide-react';
import AspectRatioSelector, { AspectRatioOption } from '@/components/ui/AspectRatioSelector';
import { useProject } from '@/contexts/ProjectContext';
import SaveStatusIndicator from './SaveStatusIndicator';

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
  const { project, setProjectAspectRatio, toggleLetterboxing } = useProject();
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
      
      {/* Spacer */}
      <div className="flex-1"></div>
      
      {/* Aspect Ratio Selector */}
      <div className="relative">
        <button 
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="flex items-center space-x-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 mr-4"
        >
          <Settings className="w-4 h-4" />
          <span>{project.aspectRatio}</span>
        </button>
        
        {isSettingsOpen && (
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 p-4 z-20">
            <AspectRatioSelector
              currentRatio={project.aspectRatio}
              onChange={(ratio) => {
                setProjectAspectRatio(ratio);
                // Optionally close settings after selection
                // setIsSettingsOpen(false);
              }}
              showLetterboxing={project.showLetterboxing}
              onToggleLetterboxing={toggleLetterboxing}
            />
          </div>
        )}
      </div>
      
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