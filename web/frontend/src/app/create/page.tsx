'use client';

/**
 * SIMPLE VIDEO CREATION FLOW
 *
 * This is the simple video creation page that allows users to:
 * 1. Enter a single video title
 * 2. Enter a single URL to extract content from
 * 3. Create a video with minimal configuration
 *
 * Route: /create
 *
 * Note: This is different from the COMPLEX flow at /projects/create
 * which offers more advanced features like multiple scenes and drag-and-drop.
 */

import { useVideoCreationForm } from '@/lib/form-handlers';
import Link from 'next/link';
import {
  VideoIcon,
  Loader2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  WifiIcon,
  WifiOffIcon,
  TimerIcon,
} from 'lucide-react';
import ErrorDisplay, { ErrorType } from '@/components/ErrorDisplay';
import UrlPreview from '@/components/UrlPreview';

export default function SimpleVideoCreationPage() {
  const {
    state,
    setUrl,
    setTitle,
    handleTitleBlur,
    handleUrlBlur,
    handleSubmit,
    retrySubmit,
    checkApiConnection,
  } = useVideoCreationForm();

  const { url, title, errors, submitError, loading, taskId, touched, apiStatus } = state;

  // Determine error type for better error display
  const getErrorType = (): ErrorType => {
    if (!submitError) return 'general';

    const errorLower = submitError.toLowerCase();

    if (
      errorLower.includes('network') ||
      errorLower.includes('connect') ||
      errorLower.includes('server') ||
      errorLower.includes('timed out')
    ) {
      return 'network';
    }

    if (
      errorLower.includes('reddit') ||
      errorLower.includes('redirect') ||
      errorLower.includes('extraction') ||
      errorLower.includes('content')
    ) {
      return 'extraction';
    }

    if (
      errorLower.includes('invalid') ||
      errorLower.includes('required') ||
      errorLower.includes('format')
    ) {
      return 'validation';
    }

    return 'general';
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create a New Video</h1>
        <p className="text-gray-600">
          Turn any online content into an engaging short-form video in minutes.
        </p>
      </div>

      {taskId ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <VideoIcon className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold mb-2">Video Creation Started!</h2>
          <p className="mb-4 text-gray-600">
            Your video is being processed. You can check its status or view it when it&apos;s ready.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              href={`/status/${taskId}`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Check Status
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          {/* API Status Indicator */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center">
              {apiStatus.connected ? (
                <div className="flex items-center text-green-600">
                  <WifiIcon className="h-4 w-4 mr-1" />
                  <span className="text-xs font-medium">Backend Connected</span>
                </div>
              ) : (
                <div className="flex items-center text-red-600">
                  <WifiOffIcon className="h-4 w-4 mr-1" />
                  <span className="text-xs font-medium">Backend Disconnected</span>
                </div>
              )}

              {apiStatus.responseTime && (
                <div className="flex items-center text-gray-500 ml-3">
                  <TimerIcon className="h-3 w-3 mr-1" />
                  <span className="text-xs">{Math.round(apiStatus.responseTime)}ms</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={checkApiConnection}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
              disabled={loading}
            >
              <RefreshCwIcon className="h-3 w-3 mr-1" />
              Check Connection
            </button>
          </div>

          {/* Enhanced Error Display */}
          {submitError && (
            <ErrorDisplay
              error={submitError}
              type={getErrorType()}
              onRetry={retrySubmit}
              showRetry={getErrorType() === 'network' || getErrorType() === 'extraction'}
            />
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Video Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Enter a title for your video"
              className={`w-full p-3 border ${errors.title ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 ${errors.title ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
              disabled={loading}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircleIcon className="h-4 w-4 mr-1" />
                {errors.title}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
              Content URL
            </label>
            <input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://example.com/your-content"
              className={`w-full p-3 border ${errors.url ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 ${errors.url ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Enter a URL containing the content you want to convert to a video.
            </p>
            {errors.url && (
              <p className="mt-1 text-sm text-red-600 flex items-center">
                <AlertCircleIcon className="h-4 w-4 mr-1" />
                {errors.url}
              </p>
            )}

            {/* URL Preview */}
            {url && !errors.url && <UrlPreview url={url} />}
          </div>

          <button
            type="submit"
            disabled={loading || !apiStatus.connected}
            className={`w-full py-3 ${apiStatus.connected ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md transition-colors flex items-center justify-center`}
          >
            {loading ? (
              <>
                <Loader2Icon className="w-5 h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : !apiStatus.connected ? (
              <>
                <WifiOffIcon className="w-5 h-5 mr-2" />
                Backend Unavailable
              </>
            ) : (
              'Create Video'
            )}
          </button>

          {!apiStatus.connected && !submitError && (
            <p className="mt-2 text-sm text-center text-red-600">
              Cannot connect to the backend server.
              <button
                type="button"
                onClick={checkApiConnection}
                className="ml-1 text-blue-600 hover:text-blue-800 underline"
              >
                Retry connection
              </button>
            </p>
          )}
        </form>
      )}
    </div>
  );
}
