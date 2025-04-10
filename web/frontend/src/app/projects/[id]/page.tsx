'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';
import { Project, ProjectProvider } from '@/components/project/ProjectProvider';
import { Loader2 as LoaderIcon, AlertTriangle as AlertIcon } from 'lucide-react';
import { getProject, projectExists } from '@/lib/storage-utils';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
// import dynamic from 'next/dynamic';

interface ProjectPageProps {
  params: {
    id: string;
  };
}

// Temporarily remove dynamic error boundary
// const DynamicErrorBoundary = dynamic(
//   () => import('@/components/ui/ErrorBoundary'),
//   { ssr: false }
// );

function ProjectDetail({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);

  // Add refs to prevent duplicate loading attempts during React strict mode remounts
  const loadAttemptedRef = useRef(false);
  const mountCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const instanceIdRef = useRef(`instance-${Math.random().toString(36).substring(2, 9)}`);

  // Safe state setter that only updates if component is still mounted
  const safeSetLoading = (value: boolean) => {
    if (isMountedRef.current) {
      console.log(`[${instanceIdRef.current}] Setting loading state to:`, value);
      setLoading(value);
    }
  };

  const safeSetProject = (value: Project | null) => {
    if (isMountedRef.current) {
      console.log(
        `[${instanceIdRef.current}] Setting project state to:`,
        value ? value.id : 'null'
      );
      setProject(value);
    }
  };

  const safeSetError = (value: string | null) => {
    if (isMountedRef.current) {
      console.log(`[${instanceIdRef.current}] Setting error state to:`, value);
      setError(value);
    }
  };

  useEffect(() => {
    mountCountRef.current += 1;
    console.log(
      `[${instanceIdRef.current}] ProjectDetail mounted (count: ${mountCountRef.current}) with projectId:`,
      projectId
    );

    // Set this component as mounted
    isMountedRef.current = true;

    // Only attempt to load if we haven't already tried
    if (!loadAttemptedRef.current) {
      loadAttemptedRef.current = true;

      const loadProject = async () => {
        console.log(`[${instanceIdRef.current}] Starting project load for:`, projectId);

        if (!projectId) {
          safeSetError('No project ID provided');
          safeSetLoading(false);
          return;
        }

        try {
          // Check if project exists in localStorage
          const exists = await projectExists(projectId);
          console.log(`[${instanceIdRef.current}] Project exists check:`, exists);

          if (!exists) {
            safeSetError(`Project ${projectId} not found`);
            safeSetLoading(false);
            return;
          }

          // Get project from localStorage
          const loadedProject = await getProject(projectId);
          console.log(
            `[${instanceIdRef.current}] Project loaded:`,
            loadedProject ? loadedProject.id : 'null'
          );

          if (!loadedProject) {
            safeSetError(`Failed to load project ${projectId}`);
            safeSetLoading(false);
            return;
          }

          // Set project in state (this will be passed to ProjectWorkspace)
          safeSetProject(loadedProject);

          // Wait a short time before setting loading to false to ensure the project
          // state is fully updated and propagated to child components
          loadTimeoutRef.current = setTimeout(() => {
            safeSetLoading(false);
          }, 100);
        } catch (err) {
          console.error(`[${instanceIdRef.current}] Error loading project:`, err);
          safeSetError(
            `Error loading project: ${err instanceof Error ? err.message : String(err)}`
          );
          safeSetLoading(false);
        }
      };

      loadProject();
    }

    // Cleanup function to prevent memory leaks and state updates after unmount
    return () => {
      console.log(`[${instanceIdRef.current}] ProjectDetail unmounting`);
      isMountedRef.current = false;

      // Clear any pending timeouts
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [projectId]);

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="flex items-center space-x-2">
          <LoaderIcon className="w-6 h-6 animate-spin" />
          <span>Loading project...</span>
        </div>
        <div className="text-xs text-gray-500 mt-2">Project ID: {projectId}</div>
      </div>
    );
  }

  // Render error state
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="flex items-center space-x-2 text-red-500">
          <AlertIcon className="w-6 h-6" />
          <span>{error || 'Unknown error loading project'}</span>
        </div>
        <button
          onClick={() => router.push('/projects')}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  // Render project workspace with the loaded project
  return (
    <div key={`project-${project.id}`}>
      <ErrorBoundary>
        <ProjectWorkspace projectId={project.id} preloadedProject={project} />
      </ErrorBoundary>
    </div>
  );
}

export default function ProjectPage({ params }: ProjectPageProps) {
  return <ProjectDetail projectId={params.id} />;
}
