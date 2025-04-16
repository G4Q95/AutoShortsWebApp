import { useState } from 'react';
import { Project } from '@/contexts/ProjectContext'; // Assuming Project type is exported from ProjectContext

export function useProjectState() {
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Set project aspect ratio
  const setProjectAspectRatio = (aspectRatio: '9:16' | '16:9' | '1:1' | '4:5') => {
    setProject(prev =>
      prev ? { ...prev, aspectRatio, updatedAt: new Date().toISOString() } : null
    );
  };

  // Toggle letterboxing display
  const toggleLetterboxing = (show: boolean) => {
    setProject(prev =>
      prev ? { ...prev, showLetterboxing: show, updatedAt: new Date().toISOString() } : null
    );
  };

  return {
    project,
    isLoading,
    error,
    setProject, // Export setters for other hooks/functions
    setIsLoading,
    setError,
    setProjectAspectRatio,
    toggleLetterboxing,
  };
} 