'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { getProcessingStatus, cancelProcessing } from '@/lib/project-utils';

export default function ProcessingPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [status, setStatus] = useState('queued');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isCancelling, setIsCancelling] = useState(false);

  const statusSteps = [
    { key: 'queued', label: 'Queued' },
    { key: 'extracting', label: 'Extracting Content' },
    { key: 'rewriting', label: 'Rewriting Text' },
    { key: 'generating_audio', label: 'Generating Voice Audio' },
    { key: 'creating_video', label: 'Creating Video' },
    { key: 'uploading', label: 'Uploading Video' },
    { key: 'completed', label: 'Video Completed' },
  ];

  useEffect(() => {
    let isMounted = true;
    let redirectTimeout: NodeJS.Timeout | null = null;

    // Set up polling to check processing status
    const interval = setInterval(async () => {
      if (!isMounted) return;

      try {
        const data = await getProcessingStatus(projectId);

        if (!isMounted) return;

        setStatus(data.status);
        setProgress(data.progress || 0);

        if (data.status === 'completed') {
          clearInterval(interval);
          // After a delay, redirect to the video page
          redirectTimeout = setTimeout(() => {
            if (isMounted) {
              router.push(`/video/${projectId}`);
            }
          }, 3000);
        }

        if (data.status === 'error') {
          clearInterval(interval);
          setError(data.errorMessage || 'An error occurred during processing');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error checking status:', err);
        setError('Failed to connect to server. Please try again.');
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [projectId, router]);

  const handleCancelProcessing = async () => {
    if (!confirm('Are you sure you want to cancel processing? This cannot be undone.')) {
      return;
    }

    setIsCancelling(true);

    try {
      await cancelProcessing(projectId);
      router.push(`/project/${projectId}`);
    } catch (error) {
      console.error('Failed to cancel processing:', error);
      setError('Failed to cancel processing. Please try again.');
      setIsCancelling(false);
    }
  };

  const currentStepIndex = statusSteps.findIndex((step) => step.key === status);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">Processing Your Video</h1>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-center mb-3">
            <AlertCircle className="text-red-500 mr-2" />
            <h2 className="text-lg font-medium text-red-800">Processing Error</h2>
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Return to Project
          </button>
        </div>
      ) : (
        <div>
          <div className="mb-8">
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div>
                  <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full bg-blue-200 text-blue-800">
                    Progress
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold inline-block text-blue-800">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>
              <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-100">
                <div
                  style={{ width: `${progress}%` }}
                  className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500"
                ></div>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {statusSteps.map((step, index) => {
              let statusDisplay;
              if (index < currentStepIndex) {
                // Completed step
                statusDisplay = <CheckCircle className="text-green-500" />;
              } else if (index === currentStepIndex) {
                // Current step
                statusDisplay = <Loader className="text-blue-500 animate-spin" />;
              } else {
                // Future step
                statusDisplay = <div className="w-6 h-6 rounded-full border border-gray-300"></div>;
              }

              return (
                <div key={step.key} className="flex items-center">
                  <div className="mr-4">{statusDisplay}</div>
                  <div
                    className={`${
                      index === currentStepIndex
                        ? 'font-medium text-blue-800'
                        : index < currentStepIndex
                          ? 'text-green-700'
                          : 'text-gray-500'
                    }`}
                  >
                    {step.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleCancelProcessing}
              disabled={isCancelling}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Processing'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
