import React, { useState, useEffect, useRef, useCallback } from 'react';
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

/**
 * Represents the different states of video processing
 */
export type ProcessingStatus =
  | 'queued'           // Video is queued for processing
  | 'extracting_content' // Extracting content from source URL
  | 'rewriting_text'    // AI is rewriting the text content
  | 'generating_voice'  // Generating voiceover audio
  | 'creating_video'    // Assembling the final video
  | 'uploading'        // Uploading to storage
  | 'completed'        // Processing completed successfully
  | 'failed'           // Processing failed
  | 'unknown';         // Status cannot be determined

/**
 * Props for the VideoStatusIndicator component
 */
interface VideoStatusIndicatorProps {
  /** Task ID to check status for */
  taskId: string;
  /** Callback function called when processing completes successfully with the video URL */
  onComplete?: (url: string) => void;
  /** Additional CSS classes to apply to the component */
  className?: string;
  /** Whether to automatically refresh the status */
  autoRefresh?: boolean;
  /** Interval in milliseconds between status checks when auto-refreshing */
  refreshInterval?: number;
}

// Helper function to map API status to our ProcessingStatus type
const mapApiStatus = (apiStatus: string): ProcessingStatus => {
  switch (apiStatus) {
    case 'processing':
      return 'extracting_content'; // Default to first processing step
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'queued':
      return 'queued';
    default:
      return 'unknown';
  }
};

/**
 * A component that displays the current status of video processing with a step-by-step indicator.
 * 
 * Features:
 * - Real-time status updates
 * - Visual progress through processing steps
 * - Automatic status polling
 * - Error state handling
 * - Completion callback
 * 
 * The component shows the following steps:
 * 1. Queued
 * 2. Extracting Content
 * 3. Rewriting Text
 * 4. Generating Voice
 * 5. Creating Video
 * 6. Uploading
 * 
 * Each step can be in one of these states:
 * - Not started (empty circle)
 * - In progress (spinning blue circle)
 * - Completed (green checkmark)
 * - Failed (red X)
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <VideoStatusIndicator taskId="task_123" />
 * 
 * // With completion callback
 * <VideoStatusIndicator 
 *   taskId="task_123"
 *   onComplete={() => handleVideoComplete()}
 * />
 * 
 * // With custom refresh interval
 * <VideoStatusIndicator 
 *   taskId="task_123"
 *   autoRefresh={true}
 *   refreshInterval={10000}
 * />
 * ```
 */
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
  // TODO: Known linter warning - useRef without initial value is intentional here as we want undefined for cleanup
  const statusCheckRef = useRef<NodeJS.Timeout>();

  // Memoize onComplete to avoid unnecessary re-renders
  const handleComplete = useCallback(() => {
    if (onComplete && videoUrl) {
      onComplete(videoUrl);
    }
  }, [onComplete, videoUrl]);

  useEffect(() => {
    // Function to check status
    const checkStatus = async () => {
      try {
        const response = await getVideoStatus(taskId);
        
        if (response.error) {
          setError(response.error.message || 'Failed to get video status');
          return;
        }

        if (response.data) {
          const statusData = response.data;
          setStatus(mapApiStatus(statusData.status));
          
          if (statusData.error) {
            setError(statusData.error);
          } else {
            setError(null);
          }

          if (statusData.url) {
            setVideoUrl(statusData.url);
            if (statusData.status === 'completed') {
              handleComplete();
            }
          }
        }
      } catch (error) {
        console.error('Error checking video status:', error);
        setError('Failed to check video status');
      }
    };

    // Initial check
    checkStatus();

    // Set up polling if autoRefresh is enabled
    if (autoRefresh && status !== 'completed' && status !== 'failed') {
      statusCheckRef.current = setInterval(checkStatus, refreshInterval);
    }

    // Cleanup
    return () => {
      if (statusCheckRef.current) {
        clearInterval(statusCheckRef.current);
      }
    };
  }, [taskId, handleComplete, autoRefresh, refreshInterval, status]);

  // Manual refresh handler
  const handleRefresh = async () => {
    try {
      const response = await getVideoStatus(taskId);
      
      if (response.error) {
        setError(response.error.message || 'Failed to get video status');
        return;
      }

      if (response.data) {
        const statusData = response.data;
        setStatus(mapApiStatus(statusData.status));
        
        if (statusData.error) {
          setError(statusData.error);
        } else {
          setError(null);
        }

        if (statusData.url) {
          setVideoUrl(statusData.url);
          if (statusData.status === 'completed') {
            handleComplete();
          }
        }
      }
    } catch (error) {
      console.error('Error checking video status:', error);
      setError('Failed to check video status');
    }
  };

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
  const getStepStatus = (step: ProcessingStatus, currentStatus: ProcessingStatus) => {
    const statusOrder: ProcessingStatus[] = [
      'queued',
      'extracting_content',
      'rewriting_text',
      'generating_voice',
      'creating_video',
      'uploading',
      'completed',
    ];

    if (currentStatus === 'failed') {
      // If current step is the failed one, mark it as active
      const currentIndex = statusOrder.indexOf(currentStatus);
      const stepIndex = statusOrder.indexOf(step);

      if (stepIndex < currentIndex) {
        return 'completed';
      } else if (stepIndex === currentIndex) {
        return 'failed';
      } else {
        return 'pending';
      }
    }

    const currentIndex = statusOrder.indexOf(currentStatus);
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
  const getStepClasses = (step: ProcessingStatus, currentStatus: ProcessingStatus) => {
    const stepStatus = getStepStatus(step, currentStatus);

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
    <div 
      className={`rounded-lg border shadow-sm overflow-hidden ${className}`}
      data-testid="video-status-indicator"
    >
      <div className="p-4 bg-gray-50 border-b" data-testid="video-status-header">
        <h3 className="text-lg font-medium">
          Video Status 
          <button
            onClick={handleRefresh}
            className="ml-2 text-gray-500 hover:text-gray-700"
            data-testid="video-status-refresh-button"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </button>
        </h3>
        {error && (
          <div className="mt-2 text-red-600 text-sm" data-testid="video-status-error">
            {error}
          </div>
        )}
      </div>

      <div className="divide-y" data-testid="video-status-steps">
        {/* Queued */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('queued', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-queued"
        >
          <StatusIcon type={getStepStatus('queued', status)} />
          <span className="ml-3">{getStatusText('queued')}</span>
        </div>

        {/* Extracting Content */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('extracting_content', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-extracting"
        >
          <StatusIcon type={getStepStatus('extracting_content', status)} />
          <span className="ml-3">{getStatusText('extracting_content')}</span>
        </div>

        {/* Rewriting Text */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('rewriting_text', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-rewriting"
        >
          <StatusIcon type={getStepStatus('rewriting_text', status)} />
          <span className="ml-3">{getStatusText('rewriting_text')}</span>
        </div>

        {/* Generating Voice */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('generating_voice', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-voice"
        >
          <StatusIcon type={getStepStatus('generating_voice', status)} />
          <span className="ml-3">{getStatusText('generating_voice')}</span>
        </div>

        {/* Creating Video */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('creating_video', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-video"
        >
          <StatusIcon type={getStepStatus('creating_video', status)} />
          <span className="ml-3">{getStatusText('creating_video')}</span>
        </div>

        {/* Uploading */}
        <div 
          className={`p-3 flex items-center ${
            getStepStatus('uploading', status) === 'active' ? 'bg-blue-50' : ''
          }`}
          data-testid="video-status-step-uploading"
        >
          <StatusIcon type={getStepStatus('uploading', status)} />
          <span className="ml-3">{getStatusText('uploading')}</span>
        </div>
      </div>

      {/* Video Result */}
      {videoUrl && status === 'completed' && (
        <div className="p-4 bg-green-50 border-t" data-testid="video-status-result">
          <div className="flex items-center mb-2">
            <PlaySquareIcon className="h-5 w-5 text-green-500" />
            <span className="ml-2 font-medium">Video Ready</span>
          </div>
          <div className="flex space-x-2" data-testid="video-status-actions">
            <a 
              href={videoUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              data-testid="video-status-view-button"
            >
              View Video
            </a>
            <a 
              href={videoUrl} 
              download
              className="text-sm px-3 py-1 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              data-testid="video-status-download-button"
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// StatusIcon component
function StatusIcon({ type }: { type: 'pending' | 'active' | 'completed' | 'failed' }) {
  switch (type) {
    case 'active':
      return <div className="h-5 w-5 text-blue-500" data-testid="status-icon-active"><Loader2Icon className="animate-spin" /></div>;
    case 'completed':
      return <div className="h-5 w-5 text-green-500" data-testid="status-icon-completed"><CheckCircleIcon /></div>;
    case 'failed':
      return <div className="h-5 w-5 text-red-500" data-testid="status-icon-failed"><XCircleIcon /></div>;
    default:
      return <div className="h-5 w-5 rounded-full border-2 border-gray-300" data-testid="status-icon-pending"></div>;
  }
}

