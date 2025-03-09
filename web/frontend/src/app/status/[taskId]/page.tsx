'use client';

import { useState, useEffect } from 'react';
import { getVideoStatus } from '@/lib/api-client';
import Link from 'next/link';
import { Loader2Icon, VideoIcon, CheckCircleIcon, AlertTriangleIcon } from 'lucide-react';

// Status component mapping
const StatusDisplay = ({ status }: { status: string }) => {
  switch (status) {
    case 'queued':
      return (
        <div className="flex items-center space-x-2 text-yellow-600">
          <Loader2Icon className="h-5 w-5 animate-spin" />
          <span>Queued</span>
        </div>
      );
    case 'extracting_content':
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2Icon className="h-5 w-5 animate-spin" />
          <span>Extracting Content</span>
        </div>
      );
    case 'rewriting_text':
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2Icon className="h-5 w-5 animate-spin" />
          <span>Rewriting Text</span>
        </div>
      );
    case 'generating_voice':
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2Icon className="h-5 w-5 animate-spin" />
          <span>Generating Voice</span>
        </div>
      );
    case 'creating_video':
      return (
        <div className="flex items-center space-x-2 text-blue-600">
          <Loader2Icon className="h-5 w-5 animate-spin" />
          <span>Creating Video</span>
        </div>
      );
    case 'completed':
      return (
        <div className="flex items-center space-x-2 text-green-600">
          <CheckCircleIcon className="h-5 w-5" />
          <span>Completed</span>
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center space-x-2 text-red-600">
          <AlertTriangleIcon className="h-5 w-5" />
          <span>Failed</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center space-x-2 text-gray-600">
          <span>{status}</span>
        </div>
      );
  }
};

export default function StatusPage({ params }: { params: { taskId: string } }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Polling interval in ms
  const POLL_INTERVAL = 3000;
  
  useEffect(() => {
    let isMounted = true;
    let pollTimer: NodeJS.Timeout | null = null;
    
    const fetchStatus = async () => {
      try {
        const response = await getVideoStatus(params.taskId);
        
        if (!isMounted) return;
        
        if (response.error) {
          setError(response.error.detail);
          setLoading(false);
        } else {
          setStatus(response.data);
          setLoading(false);
          
          // Continue polling if status is not terminal
          const isTerminal = ['completed', 'failed'].includes(response.data.status);
          
          if (!isTerminal) {
            pollTimer = setTimeout(fetchStatus, POLL_INTERVAL);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setError('Failed to fetch video status. Please try again.');
        setLoading(false);
      }
    };
    
    fetchStatus();
    
    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [params.taskId]);
  
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto text-center py-12">
        <Loader2Icon className="h-10 w-10 mx-auto mb-4 text-blue-600 animate-spin" />
        <h1 className="text-2xl font-bold mb-2">Loading Status...</h1>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangleIcon className="h-10 w-10 mx-auto mb-4 text-red-600" />
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="mb-4 text-gray-600">{error}</p>
          <Link 
            href="/create" 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-block"
          >
            Create a New Video
          </Link>
        </div>
      </div>
    );
  }
  
  const isCompleted = status?.status === 'completed';
  const isFailed = status?.status === 'failed';
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Status</h1>
        <p className="text-gray-600">
          Task ID: {params.taskId}
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-500 mb-1">Status</div>
          <StatusDisplay status={status?.status || 'unknown'} />
        </div>
        
        {isFailed && status?.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md">
            {status.error}
          </div>
        )}
        
        {isCompleted && status?.storage_url && (
          <div className="mt-6">
            <h2 className="text-xl font-bold mb-4">Your Video is Ready!</h2>
            
            <div className="aspect-video bg-black rounded-lg mb-4 flex items-center justify-center">
              <VideoIcon className="h-16 w-16 text-gray-400" />
            </div>
            
            <div className="flex space-x-4 mt-4">
              <a 
                href={status.storage_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Download Video
              </a>
              <Link 
                href="/create" 
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Create Another Video
              </Link>
            </div>
          </div>
        )}
        
        {!isCompleted && !isFailed && (
          <div className="p-4 bg-blue-50 text-blue-700 rounded-md mt-4">
            <p>Your video is being processed. This page will automatically update when it's ready.</p>
          </div>
        )}
      </div>
    </div>
  );
} 