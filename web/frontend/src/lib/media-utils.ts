/**
 * Media utility functions for handling different types of media content
 */

/**
 * Determine the type of media from API response data
 */
export const determineMediaType = (url: string): 'image' | 'video' | 'gallery' | null => {
  if (!url) return null;

  // Handle Reddit video URLs
  if (url.includes('v.redd.it')) {
    return 'video';
  }

  // Handle other URLs
  const extension = url.split('.').pop()?.toLowerCase();
  if (!extension) return null;

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
    return 'image';
  }

  if (['mp4', 'webm', 'mov'].includes(extension)) {
    return 'video';
  }

  // Handle gallery type
  if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i) && url.match(/\.(mp4|webm|mov)$/i)) {
    return 'gallery';
  }

  return null;
};

/**
 * Check if a URL points to a media file
 */
export const isMediaUrl = (url: string): boolean => {
  const mediaExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp',  // Images
    '.mp4', '.webm', '.mov'                    // Videos
  ];
  return mediaExtensions.some(ext => url.toLowerCase().endsWith(ext));
};

/**
 * Get media type from URL
 */
export const getMediaTypeFromUrl = (url: string): 'image' | 'video' | null => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const videoExtensions = ['.mp4', '.webm', '.mov'];
  
  const urlLower = url.toLowerCase();
  
  if (imageExtensions.some(ext => urlLower.endsWith(ext))) {
    return 'image';
  }
  
  if (videoExtensions.some(ext => urlLower.endsWith(ext))) {
    return 'video';
  }
  
  return null;
};

/**
 * Extract dimensions from media metadata
 */
export const extractMediaDimensions = (metadata: any) => {
  return {
    width: metadata?.width || metadata?.source?.width || undefined,
    height: metadata?.height || metadata?.source?.height || undefined,
    duration: metadata?.duration || undefined
  };
};

/**
 * Transforms a Reddit video URL to be playable in the browser.
 * Handles CORS and audio track issues with v.redd.it URLs.
 * 
 * @param url - The original video URL from Reddit
 * @returns The transformed URL that can be played in the browser
 */
export const transformRedditVideoUrl = (url: string): string => {
  if (!url) return '';

  // Check if it's a Reddit video URL
  if (url.includes('v.redd.it')) {
    // Use our proxy endpoint to handle CORS
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    return `${apiUrl}/api/v1/content/proxy/reddit-video?url=${encodeURIComponent(url)}`;
  }

  return url;
}; 