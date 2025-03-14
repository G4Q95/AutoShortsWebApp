import { ProjectProvider } from '@/contexts/ProjectContext';
import { Suspense } from 'react';
import ProjectWorkspace from '@/components/ProjectWorkspace';
import LoadingState from '@/components/LoadingState';
import { ProjectParams } from '@/lib/types';
import StorageDebugger from './StorageDebugger';

export default function ProjectPage({ searchParams }: { searchParams: ProjectParams }) {
  const projectId = searchParams.id;

  return (
    <Suspense fallback={<LoadingState />}>
      <div className="container mx-auto p-4">
        <ProjectProvider projectId={projectId}>
          <h1 className="text-2xl font-bold mb-4">Project Workspace</h1>
          <ProjectWorkspace />
        </ProjectProvider>
        
        {/* Add the debugging component */}
        <details className="mt-8 border border-gray-200 rounded-md">
          <summary className="bg-gray-100 p-2 cursor-pointer">
            Show Storage Debugging Information
          </summary>
          <div className="p-2">
            <StorageDebugger projectId={projectId} />
          </div>
        </details>
      </div>
    </Suspense>
  );
} 