'use client';

import { useState, useEffect } from 'react';
import { getVideoStatus } from '@/lib/api-client';
import Link from 'next/link';
import { Loader2Icon, VideoIcon, CheckCircleIcon, AlertTriangleIcon, ArrowLeftIcon, HomeIcon } from 'lucide-react';
import VideoStatusIndicator from '@/components/VideoStatusIndicator';

export default function StatusPage({ params }: { params: { taskId: string } }) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Load initial status
  useEffect(() => {
    const fetchInitialStatus = async () => {
      try {
        const response = await getVideoStatus(params.taskId);
        
        if (response.error) {
          setError(response.error.detail);
        } else {
          setStatus(response.data);
          if (response.data.storage_url) {
            setVideoUrl(response.data.storage_url);
          }
        }
      } catch (err) {
        setError('Failed to fetch video status. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchInitialStatus();
  }, [params.taskId]);
  
  // Handle video completion
  const handleVideoComplete = (url: string) => {
    setVideoUrl(url);
  };
  
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
          <div className="flex justify-center space-x-4">
            <Link 
              href="/create" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Create
            </Link>
            <Link 
              href="/" 
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors inline-flex items-center"
            >
              <HomeIcon className="h-4 w-4 mr-2" />
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Video Status</h1>
        <p className="text-gray-600 flex items-center">
          <span className="text-sm bg-gray-100 px-2 py-1 rounded font-mono mr-2">{params.taskId}</span>
          <span className="text-xs text-gray-500">Task ID</span>
        </p>
      </div>
      
      <div className="grid gap-6 md:grid-cols-5">
        {/* Status Indicator */}
        <div className="md:col-span-3">
          <VideoStatusIndicator 
            taskId={params.taskId} 
            onComplete={handleVideoComplete} 
            className="bg-white shadow-md"
          />
        </div>
        
        {/* Actions Panel */}
        <div className="md:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold mb-4">Actions</h2>
          
          <div className="space-y-4">
            <Link 
              href="/create" 
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Create Page
            </Link>
            
            <Link 
              href="/dashboard" 
              className="w-full py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center"
            >
              Dashboard
            </Link>
            
            {videoUrl && (
              <a 
                href={videoUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                <VideoIcon className="h-4 w-4 mr-2" />
                View Video
              </a>
            )}
          </div>
          
          {/* Status Summary */}
          {status && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Status Summary</h3>
              <div className="flex items-center">
                {status.status === 'completed' ? (
                  <div className="flex items-center text-green-600">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    <span>Video Successfully Created</span>
                  </div>
                ) : status.status === 'failed' ? (
                  <div className="flex items-center text-red-600">
                    <AlertTriangleIcon className="h-5 w-5 mr-2" />
                    <span>Processing Failed</span>
                  </div>
                ) : (
                  <div className="flex items-center text-blue-600">
                    <Loader2Icon className="h-5 w-5 mr-2 animate-spin" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
              
              {status.error && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                  {status.error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 