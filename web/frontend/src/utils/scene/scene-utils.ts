/**
 * Utility functions for the Scene component
 * These functions are pure and don't depend on component state
 */

/**
 * Formats a time duration in seconds to a MM:SS format
 * @param seconds - The duration in seconds
 * @returns Formatted time string in MM:SS format
 */
export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Determines the media type from a URL
 * @param url - The media URL to check
 * @returns The media type (image, video, etc.)
 */
export const determineMediaType = (url: string): 'image' | 'video' | 'unknown' => {
  if (!url) return 'unknown';
  
  const lowerUrl = url.toLowerCase();
  
  // Check for image extensions
  if (
    lowerUrl.endsWith('.jpg') || 
    lowerUrl.endsWith('.jpeg') || 
    lowerUrl.endsWith('.png') || 
    lowerUrl.endsWith('.gif') || 
    lowerUrl.endsWith('.webp')
  ) {
    return 'image';
  }
  
  // Check for video extensions
  if (
    lowerUrl.endsWith('.mp4') || 
    lowerUrl.endsWith('.webm') || 
    lowerUrl.endsWith('.mov') || 
    lowerUrl.endsWith('.avi') || 
    lowerUrl.includes('/video')
  ) {
    return 'video';
  }
  
  return 'unknown';
};

/**
 * Generates a class name for the scene container based on its state
 * @param isExpanded - Whether the scene is expanded
 * @param isSelected - Whether the scene is selected
 * @param isEditMode - Whether the scene is in edit mode
 * @returns The CSS class name string
 */
export const getSceneContainerClassName = (
  isExpanded: boolean, 
  isSelected: boolean, 
  isEditMode: boolean
): string => {
  const baseClass = 'scene-component relative mb-4 bg-white rounded-md border';
  const opacityClass = 'opacity-100 transition-opacity duration-500';
  const shadowClass = isSelected ? 'shadow-md' : 'shadow-sm';
  const expandedClass = isExpanded ? 'expanded' : '';
  const editClass = isEditMode ? 'edit-mode' : '';
  
  return `${baseClass} ${opacityClass} ${shadowClass} ${expandedClass} ${editClass}`.trim();
};

/**
 * Calculate an appropriate media height based on the container width and aspect ratio
 * @param containerWidth - Width of the container
 * @param aspectRatio - Aspect ratio of the media (width/height)
 * @param maxHeight - Maximum allowed height
 * @param minHeight - Minimum allowed height
 * @returns The calculated height in pixels
 */
export const calculateMediaHeight = (
  containerWidth: number,
  aspectRatio: number,
  maxHeight: number = 500,
  minHeight: number = 190
): number => {
  if (!containerWidth || !aspectRatio || aspectRatio <= 0) {
    return minHeight;
  }
  
  // Calculate height based on aspect ratio
  let height = containerWidth / aspectRatio;
  
  // Constrain to min/max
  height = Math.min(Math.max(height, minHeight), maxHeight);
  
  return height;
};

/**
 * Creates a URL for the R2 storage based on the project and scene IDs
 * @param projectId - The project ID
 * @param sceneId - The scene ID
 * @param fileName - The file name
 * @returns The constructed R2 URL
 */
export const constructStorageUrl = (
  projectId: string,
  sceneId: string,
  fileName: string
): string => {
  if (!projectId || !sceneId || !fileName) return '';
  return `/api/v1/media/${projectId}/${sceneId}/${fileName}`;
}; 