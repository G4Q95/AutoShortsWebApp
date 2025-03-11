import React, { useState, useEffect } from 'react';
import {
  Loader2Icon,
  CheckCircleIcon,
  XCircleIcon,
  FileTextIcon,
  MicIcon,
  VideoIcon,
  UploadCloudIcon,
  RefreshCwIcon,
  PlaySquareIcon,
  TimerIcon,
} from 'lucide-react';

// API request function to get status
import { getVideoStatus } from '@/lib/api-client';

export type ProcessingStatus =
  | 'queued'
  | 'extracting_content'
  | 'rewriting_text'
  | 'generating_voice'
  | 'creating_video'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'unknown';

interface VideoStatusIndicatorProps {
  taskId: string;
  onComplete?: (videoUrl: string) => void;
  className?: string;
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

export default function VideoStatusIndicator({
  taskId,
  onComplete,
  className = '',
  autoRefresh = true,
  refreshInterval = 5000, // 5 seconds default
}: VideoStatusIndicatorProps) {
  const [status, setStatus] = useState<ProcessingStatus>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Function to fetch the current status
  const fetchStatus = async () => {
    if (!taskId) return;

    setIsLoading(true);
    try {
      const response = await getVideoStatus(taskId);

      if (response.error) {
        setError(response.error.detail || 'Failed to fetch status');
        return;
      }

      if (response.data) {
        const statusData = response.data;
        setStatus(statusData.status as ProcessingStatus);

        if (statusData.storage_url) {
          setVideoUrl(statusData.storage_url);
          if (onComplete && statusData.status === 'completed') {
            onComplete(statusData.storage_url);
          }
        }

        if (statusData.error) {
          setError(statusData.error);
        } else {
          setError(null);
        }

        setLastUpdated(new Date());
      }
    } catch (err) {
      setError('Failed to connect to the server');
      console.error('Error fetching status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Initially fetch status
  useEffect(() => {
    fetchStatus();

    // Set up auto-refresh if enabled
    if (autoRefresh) {
      const intervalId = setInterval(() => {
        // Don't auto-refresh if already completed or failed
        if (status !== 'completed' && status !== 'failed') {
          fetchStatus();
        }
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [taskId, autoRefresh, refreshInterval, status]);

  // Get the appropriate icon for each status
  const getStatusIcon = (statusType: ProcessingStatus) => {
    switch (statusType) {
      case 'queued':
        return <TimerIcon className="h-5 w-5" />;
      case 'extracting_content':
        return <FileTextIcon className="h-5 w-5" />;
      case 'rewriting_text':
        return <FileTextIcon className="h-5 w-5" />;
      case 'generating_voice':
        return <MicIcon className="h-5 w-5" />;
      case 'creating_video':
        return <VideoIcon className="h-5 w-5" />;
      case 'uploading':
        return <UploadCloudIcon className="h-5 w-5" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5" />;
      case 'failed':
        return <XCircleIcon className="h-5 w-5" />;
      default:
        return <Loader2Icon className="h-5 w-5 animate-spin" />;
    }
  };

  // Get user-friendly status text
  const getStatusText = (statusType: ProcessingStatus): string => {
    switch (statusType) {
      case 'queued':
        return 'Queued';
      case 'extracting_content':
        return 'Extracting Content';
      case 'rewriting_text':
        return 'Rewriting Text';
      case 'generating_voice':
        return 'Generating Voice Audio';
      case 'creating_video':
        return 'Creating Video';
      case 'uploading':
        return 'Uploading Video';
      case 'completed':
        return 'Video Completed';
      case 'failed':
        return 'Processing Failed';
      default:
        return 'Loading Status...';
    }
  };

  // Determine if a step is active, completed, or pending
  const getStepStatus = (step: ProcessingStatus) => {
    const statusOrder: ProcessingStatus[] = [
      'queued',
      'extracting_content',
      'rewriting_text',
      'generating_voice',
      'creating_video',
      'uploading',
      'completed',
    ];

    if (status === 'failed') {
      // If current step is the failed one, mark it as active
      const currentIndex = statusOrder.indexOf(status);
      const stepIndex = statusOrder.indexOf(step);

      if (stepIndex < currentIndex) {
        return 'completed';
      } else if (stepIndex === currentIndex) {
        return 'failed';
      } else {
        return 'pending';
      }
    }

    const currentIndex = statusOrder.indexOf(status);
    const stepIndex = statusOrder.indexOf(step);

    if (currentIndex === -1 || stepIndex === -1) {
      return 'pending';
    }

    if (stepIndex < currentIndex) {
      return 'completed';
    } else if (stepIndex === currentIndex) {
      return 'active';
    } else {
      return 'pending';
    }
  };

  // Get CSS classes for each step based on its status
  const getStepClasses = (step: ProcessingStatus) => {
    const stepStatus = getStepStatus(step);

    const baseClasses = 'flex items-center';

    if (stepStatus === 'completed') {
      return `${baseClasses} text-green-600`;
    } else if (stepStatus === 'active') {
      return `${baseClasses} text-blue-600 font-medium`;
    } else if (stepStatus === 'failed') {
      return `${baseClasses} text-red-600 font-medium`;
    } else {
      return `${baseClasses} text-gray-400`;
    }
  };

  return (
    <div className={`border rounded-lg p-5 ${className}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium">Video Processing Status</h3>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="p-1 hover:bg-gray-100 rounded-full"
            title="Refresh status"
          >
            <RefreshCwIcon className={`h-4 w-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4 text-red-700 text-sm">
          <div className="flex items-start">
            <XCircleIcon className="h-5 w-5 mr-2 flex-shrink-0" />
            <div>
              <p className="font-medium">Error processing video</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* Queued */}
        <div className={getStepClasses('queued')}>
          <div className="mr-3">
            {getStepStatus('queued') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('queued') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('queued') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('queued')}</span>
        </div>

        {/* Extracting Content */}
        <div className={getStepClasses('extracting_content')}>
          <div className="mr-3">
            {getStepStatus('extracting_content') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('extracting_content') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('extracting_content') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('extracting_content')}</span>
        </div>

        {/* Rewriting Text */}
        <div className={getStepClasses('rewriting_text')}>
          <div className="mr-3">
            {getStepStatus('rewriting_text') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('rewriting_text') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('rewriting_text') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('rewriting_text')}</span>
        </div>

        {/* Generating Voice */}
        <div className={getStepClasses('generating_voice')}>
          <div className="mr-3">
            {getStepStatus('generating_voice') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('generating_voice') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('generating_voice') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('generating_voice')}</span>
        </div>

        {/* Creating Video */}
        <div className={getStepClasses('creating_video')}>
          <div className="mr-3">
            {getStepStatus('creating_video') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('creating_video') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('creating_video') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('creating_video')}</span>
        </div>

        {/* Uploading */}
        <div className={getStepClasses('uploading')}>
          <div className="mr-3">
            {getStepStatus('uploading') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('uploading') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('uploading') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('uploading')}</span>
        </div>

        {/* Completed */}
        <div className={getStepClasses('completed')}>
          <div className="mr-3">
            {getStepStatus('completed') === 'completed' ? (
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
            ) : getStepStatus('completed') === 'active' ? (
              <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" />
            ) : getStepStatus('completed') === 'failed' ? (
              <XCircleIcon className="h-5 w-5 text-red-600" />
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
            )}
          </div>
          <span>{getStatusText('completed')}</span>
        </div>
      </div>

      {/* Video preview when available */}
      {videoUrl && status === 'completed' && (
        <div className="mt-6 p-4 border border-green-200 bg-green-50 rounded-md">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-green-800">Video Ready!</h4>
            <a
              href={videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-green-600 hover:text-green-800"
            >
              <PlaySquareIcon className="h-4 w-4 mr-1" />
              View Video
            </a>
          </div>
          <p className="text-sm text-green-700">
            Your video has been successfully created and is ready to view.
          </p>
        </div>
      )}
    </div>
  );
}
