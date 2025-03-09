'use client';

import React from 'react';
import { ProjectProvider } from '@/components/project/ProjectProvider';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';

export default function ProjectsPage() {
  return (
    <ProjectProvider>
      <div className="container mx-auto px-4 py-8">
        <ProjectWorkspace />
      </div>
    </ProjectProvider>
  );
} 