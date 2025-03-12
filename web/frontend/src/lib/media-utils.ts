/**
 * Media utility functions for handling different types of media content
 */

/**
 * Determine the type of media from API response data
 */
export const determineMediaType = (data: any): 'image' | 'video' | 'gallery' => {
  // If media_type is directly provided (from backend API response)
  if (data.media_type) {
    if (data.media_type === 'video') return 'video';
    if (data.media_type === 'image') return 'image';
    if (data.media_type === 'gallery') return 'gallery';
  }

  // Check URL patterns as fallback
  const mediaUrl = data.media_url || '';
  if (mediaUrl.match(/\.(mp4|webm|mov)$/i)) return 'video';
  if (mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return 'image';

  // Handle gallery type
  if (data.preview_images && data.preview_images.length > 1) {
    return 'gallery';
  }

  // Default to image for safety
  return 'image';
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