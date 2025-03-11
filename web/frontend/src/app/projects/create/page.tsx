'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ProjectProvider } from '@/components/project/ProjectProvider';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';
import { projectExists } from '@/lib/storage-utils';

export default function CreateProjectPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if we have a project ID in the query params
    const id = searchParams.get('id');
    if (id) {
      // Verify the project exists
      if (projectExists(id)) {
        setProjectId(id);
      } else {
        console.error('Project not found:', id);
        // If the project doesn't exist, redirect to the create page without ID
        router.replace('/projects/create');
      }
    }
  }, [searchParams, router]);

  return (
    <div className="container mx-auto py-8">
      <ProjectProvider>
        <ProjectWorkspace projectId={projectId || undefined} />
      </ProjectProvider>
    </div>
  );
} 