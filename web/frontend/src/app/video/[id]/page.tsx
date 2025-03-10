'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download as DownloadIcon, Share2 as ShareIcon, Edit as EditIcon, ArrowLeft as ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';

interface VideoData {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  createdAt: number;
  duration: number;
}

export default function VideoPage({ params }: { params: { id: string } }) {
  const projectId = params.id;
  const router = useRouter();
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchVideoData = async () => {
      try {
        const response = await fetch(`/api/videos/${projectId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch video data');
        }
        
        const data = await response.json();
        setVideoData(data);
      } catch (err) {
        console.error('Error fetching video data:', err);
        setError('Failed to load video. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideoData();
  }, [projectId]);
  
  const handleDownload = () => {
    if (!videoData?.videoUrl) return;
    
    const link = document.createElement('a');
    link.href = videoData.videoUrl;
    link.download = `${videoData.title || 'video'}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleShare = () => {
    if (!videoData) return;
    
    if (navigator.share) {
      navigator.share({
        title: videoData.title,
        text: `Check out this video: ${videoData.title}`,
        url: window.location.href
      }).catch(err => {
        console.error('Error sharing:', err);
      });
    } else {
      // Fallback for browsers that don't support navigator.share
      navigator.clipboard.writeText(window.location.href);
      alert('Video link copied to clipboard!');
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link 
        href="/projects"
        className="inline-flex items-center text-blue-600 mb-6 hover:underline"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Back to Projects
      </Link>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => router.push(`/project/${projectId}`)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Return to Project
          </button>
        </div>
      ) : videoData ? (
        <>
          <h1 className="text-3xl font-bold mb-4">{videoData.title}</h1>
          
          <div className="bg-black rounded-lg overflow-hidden mb-6">
            <video 
              src={videoData.videoUrl} 
              poster={videoData.thumbnailUrl}
              controls
              className="w-full"
            ></video>
          </div>
          
          <div className="flex flex-wrap gap-4 mb-8">
            <button 
              onClick={handleDownload}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <DownloadIcon className="h-5 w-5 mr-2" />
              Download Video
            </button>
            
            <button 
              onClick={handleShare}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              <ShareIcon className="h-5 w-5 mr-2" />
              Share
            </button>
            
            <Link 
              href={`/project/${projectId}`}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              <EditIcon className="h-5 w-5 mr-2" />
              Edit Project
            </Link>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold mb-3">Video Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Created</p>
                <p>{new Date(videoData.createdAt).toLocaleDateString()}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p>{Math.floor(videoData.duration / 60)}:{(videoData.duration % 60).toString().padStart(2, '0')}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Video Not Found</h2>
          <p className="text-gray-500 mb-6">
            The video you're looking for doesn't exist or hasn't been processed yet.
          </p>
          <Link 
            href={`/project/${projectId}`}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            Return to Project
          </Link>
        </div>
      )}
    </div>
  );
} 