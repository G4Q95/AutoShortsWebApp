import React, { useState, useEffect } from 'react';
import { LinkIcon, CheckCircleIcon, XCircleIcon, LoaderIcon } from 'lucide-react';

interface UrlMetadata {
  title: string;
  description?: string;
  image?: string;
  domain: string;
  supportedType: boolean;
}

interface UrlPreviewProps {
  url: string;
  className?: string;
}

export default function UrlPreview({ url, className = '' }: UrlPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset state when URL changes
    if (!url) {
      setMetadata(null);
      setError(null);
      return;
    }
    
    // Only fetch metadata for valid URLs
    try {
      // Basic URL validation
      new URL(url);
      
      // Debounce the metadata fetch to avoid too many requests
      const handler = setTimeout(() => {
        fetchUrlMetadata(url);
      }, 800);
      
      return () => {
        clearTimeout(handler);
      };
    } catch (e) {
      // Invalid URL, don't fetch metadata
      setMetadata(null);
      return;
    }
  }, [url]);
  
  const fetchUrlMetadata = async (url: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, this is a mock implementation
      // In production, this would call an actual API endpoint
      
      // Detect domain from URL
      const domain = new URL(url).hostname;
      
      // Simulate network delay (remove in production)
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock metadata based on URL patterns
      if (url.includes('reddit.com')) {
        const isPostUrl = url.includes('/comments/');
        if (isPostUrl) {
          // Extract subreddit from URL
          const matches = url.match(/\/r\/([^\/]+)/);
          const subreddit = matches ? matches[1] : 'unknown';
          
          setMetadata({
            title: `Reddit post from r/${subreddit}`,
            description: 'Content will be extracted from this Reddit post.',
            domain: 'reddit.com',
            supportedType: true
          });
        } else {
          setError('Please use a direct link to a Reddit post.');
          setMetadata({
            title: 'Invalid Reddit URL',
            domain: 'reddit.com',
            supportedType: false
          });
        }
      } else if (url.includes('medium.com')) {
        setMetadata({
          title: 'Medium article',
          description: 'Content will be extracted from this Medium article.',
          domain: 'medium.com',
          supportedType: true
        });
      } else {
        // Generic preview for other URLs
        setMetadata({
          title: `Content from ${domain}`,
          domain,
          supportedType: [
            'medium.com', 'dev.to', 'github.com', 'substack.com',
            'nytimes.com', 'bbc.com', 'cnn.com', 'theguardian.com', 
            'washingtonpost.com'
          ].some(d => domain.includes(d))
        });
      }
    } catch (e) {
      setError('Failed to preview URL. Please ensure it is valid.');
      setMetadata(null);
    } finally {
      setLoading(false);
    }
  };
  
  if (!url || !url.trim()) {
    return null;
  }
  
  if (loading) {
    return (
      <div className={`mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md flex items-center ${className}`}>
        <LoaderIcon className="w-5 h-5 text-blue-500 animate-spin mr-2" />
        <span className="text-sm text-gray-600">Loading preview...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`mt-3 p-3 bg-red-50 border border-red-200 rounded-md flex items-center ${className}`}>
        <XCircleIcon className="w-5 h-5 text-red-500 mr-2" />
        <span className="text-sm text-red-700">{error}</span>
      </div>
    );
  }
  
  if (!metadata) {
    return null;
  }
  
  return (
    <div className={`mt-3 p-3 border rounded-md ${metadata.supportedType ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} ${className}`}>
      <div className="flex items-start">
        {metadata.supportedType ? (
          <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
        ) : (
          <XCircleIcon className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
        )}
        
        <div>
          <h4 className="font-medium text-gray-900">{metadata.title}</h4>
          
          {metadata.description && (
            <p className="text-sm text-gray-600 mt-1">{metadata.description}</p>
          )}
          
          <div className="flex items-center mt-2 text-xs text-gray-500">
            <LinkIcon className="w-3 h-3 mr-1" />
            <span>{metadata.domain}</span>
            {metadata.supportedType && (
              <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
                Supported
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 