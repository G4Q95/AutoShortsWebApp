'use client';

import React, { useEffect } from 'react';
import { ProjectProvider, useProject } from '@/components/project/ProjectProvider';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';
import { useRouter } from 'next/navigation';
import { Loader2 as LoaderIcon } from 'lucide-react';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

function ProjectDetail({ projectId }: { projectId: string }) {
  const { currentProject, setCurrentProject, isLoading, error } = useProject();
  const router = useRouter();
  
  useEffect(() => {
    if (projectId) {
      setCurrentProject(projectId);
    }
  }, [projectId, setCurrentProject]);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoaderIcon className="h-8 w-8 text-blue-600 animate-spin" />
      </div>
    );
  }
  
  if (error && !currentProject) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Project Not Found</h2>
        <p className="text-gray-600 mb-6">
          The project you're looking for doesn't exist or has been deleted.
        </p>
        <button
          onClick={() => router.push('/projects')}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    );
  }
  
  return <ProjectWorkspace projectId={projectId} />;
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return (
    <ProjectProvider>
      <ProjectDetail projectId={params.id} />
    </ProjectProvider>
  );
} 