/**
 * Media Analysis Utilities
 * 
 * Functions for analyzing images and videos to determine their aspect ratio
 * and original dimensions, to be used for scene metadata.
 */

/**
 * Media analysis result containing dimensions and aspect ratio
 */
export interface MediaAnalysisResult {
  width: number;
  height: number;
  aspectRatio: number;
}

/**
 * Analyzes an image to determine its dimensions and aspect ratio
 * 
 * @param url URL of the image to analyze
 * @returns Promise resolving to MediaAnalysisResult
 */
export const analyzeImage = (url: string): Promise<MediaAnalysisResult> => {
  return new Promise((resolve, reject) => {
    // Create new image element
    const img = new Image();
    
    // Handle successful load
    img.onload = () => {
      const width = img.width;
      const height = img.height;
      const aspectRatio = width / height;
      
      console.log(`[MediaAnalysis] Image dimensions: ${width}x${height}, ratio: ${aspectRatio.toFixed(4)}`);
      
      resolve({
        width,
        height,
        aspectRatio
      });
    };
    
    // Handle load errors
    img.onerror = (error) => {
      console.error(`[MediaAnalysis] Failed to load image for analysis:`, error);
      reject(new Error('Failed to load image for analysis'));
    };
    
    // Set crossorigin attribute for CORS issues with external images
    img.crossOrigin = 'anonymous';
    
    // Start loading the image
    img.src = url;
  });
};

/**
 * Analyzes a video to determine its dimensions and aspect ratio
 * 
 * @param url URL of the video to analyze
 * @returns Promise resolving to MediaAnalysisResult
 */
export const analyzeVideo = (url: string): Promise<MediaAnalysisResult> => {
  return new Promise((resolve, reject) => {
    // Create video element
    const video = document.createElement('video');
    
    // Handle metadata load (dimensions are available at this point)
    video.onloadedmetadata = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      const aspectRatio = width / height;
      
      console.log(`[MediaAnalysis] Video dimensions: ${width}x${height}, ratio: ${aspectRatio.toFixed(4)}`);
      
      // Clean up
      video.src = '';
      
      resolve({
        width,
        height,
        aspectRatio
      });
    };
    
    // Handle load errors
    video.onerror = (error) => {
      console.error(`[MediaAnalysis] Failed to load video for analysis:`, error);
      reject(new Error('Failed to load video for analysis'));
    };
    
    // Make sure we don't try to play the video
    video.preload = 'metadata';
    video.muted = true;
    
    // Set crossorigin attribute for CORS issues with external videos
    video.crossOrigin = 'anonymous';
    
    // Start loading the video metadata
    video.src = url;
  });
};

/**
 * Analyzes any supported media type based on its type
 * 
 * @param url URL of the media to analyze
 * @param type Type of media ('image' or 'video')
 * @returns Promise resolving to MediaAnalysisResult
 */
export const analyzeMedia = (url: string, type: 'image' | 'video' | 'gallery'): Promise<MediaAnalysisResult> => {
  switch(type) {
    case 'image':
      return analyzeImage(url);
    case 'video':
      return analyzeVideo(url);
    case 'gallery':
      // For galleries, default to analyzing as an image
      // In a real implementation, this would need to handle multiple images
      return analyzeImage(url);
    default:
      return Promise.reject(new Error(`Unsupported media type: ${type}`));
  }
};

/**
 * Determines if a media aspect ratio is vertical (portrait)
 * 
 * @param aspectRatio The aspect ratio to check
 * @returns True if the aspect ratio is considered vertical (portrait)
 */
export const isVerticalAspectRatio = (aspectRatio: number): boolean => {
  return aspectRatio < 0.9;
};

/**
 * Determines if a media aspect ratio is square
 * 
 * @param aspectRatio The aspect ratio to check
 * @returns True if the aspect ratio is considered square (within margin of error)
 */
export const isSquareAspectRatio = (aspectRatio: number): boolean => {
  return aspectRatio >= 0.9 && aspectRatio <= 1.1;
};

/**
 * Gets the effective aspect ratio for a project setting
 * 
 * @param projectAspectRatio Project aspect ratio setting (e.g., "16:9")
 * @returns Numerical aspect ratio (e.g., 1.78)
 */
export const getProjectAspectRatioNumber = (projectAspectRatio: string): number => {
  const [width, height] = projectAspectRatio.split(':').map(Number);
  return width / height;
}; 