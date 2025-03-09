'use client';

import { ProjectProvider } from '@/components/project/ProjectProvider';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';

export default function CreateProjectPage() {
  return (
    <div className="container mx-auto py-8">
      <ProjectProvider>
        <ProjectWorkspace />
      </ProjectProvider>
    </div>
  );
} 