/**
 * Media utility functions for handling different types of media content
 */

import { Scene, Project } from '../components/project/ProjectTypes';

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
 * Transforms a Reddit video URL to a more reliable format
 * @param url Original video URL
 * @returns Transformed URL that works better with the video player
 */
export function transformRedditVideoUrl(url: string): string {
  console.log('Original URL:', url);
  
  // Check if it's a Reddit video
  if (!url || !url.includes('v.redd.it')) {
    console.log('Not a Reddit video URL:', url);
    return url;
  }

  // Extract the video ID
  const videoIdMatch = url.match(/v\.redd\.it\/([^/?]+)/);
  if (!videoIdMatch || !videoIdMatch[1]) {
    console.log('No video ID match found in URL:', url);
    return url;
  }

  const videoId = videoIdMatch[1];
  console.log('Extracted video ID:', videoId);
  
  // For client-side rendering, use the proxy API to avoid CORS issues
  if (typeof window !== 'undefined') {
    const apiUrl = process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:8000';
    const proxyUrl = `${apiUrl}/api/v1/content/proxy/reddit-video?url=${encodeURIComponent(url)}`;
    console.log('Using client-side proxy URL:', proxyUrl);
    return proxyUrl;
  }
  
  // For server-side rendering
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const proxyUrl = `${apiUrl}/api/v1/content/proxy/reddit-video?url=${encodeURIComponent(url)}`;
  console.log('Using server-side proxy URL:', proxyUrl);
  return proxyUrl;
}

/**
 * Stores scene media content to R2 storage for better reliability and persistence.
 * 
 * This function takes a scene's media URL and stores it in R2 storage, updating 
 * the scene with storage-backed media information.
 * 
 * @param scene - The scene with media to store
 * @param projectId - ID of the project that contains the scene
 * @param updateSceneMedia - Function to update the scene's media data
 * @returns Promise with boolean indicating success
 */
export const storeSceneMedia = async (
  scene: Scene, 
  projectId: string,
  updateSceneMedia: (sceneId: string, mediaData: Partial<Scene['media']>) => void
): Promise<boolean> => {
  try {
    console.log(`[MEDIA-DEBUG] ========== Starting media storage for scene ${scene.id} ==========`);
    
    if (!scene || !scene.id || !scene.media || !scene.media.url) {
      console.error('[MEDIA-DEBUG] Cannot store media: Missing scene data, ID, or media URL');
      return false;
    }

    // Skip if already stored
    if (scene.media.isStorageBacked || scene.media.storageKey) {
      console.log(`[MEDIA-DEBUG] Media already stored in R2 (isStorageBacked: ${!!scene.media.isStorageBacked}, storageKey: ${scene.media.storageKey}), skipping storage operation`);
      return true;
    }

    const mediaUrl = scene.media.url;
    console.log(`[MEDIA-DEBUG] Storing media for scene ${scene.id} from URL: ${mediaUrl}`);
    console.log(`[MEDIA-DEBUG] Current media state:`, JSON.stringify({
      type: scene.media.type,
      isStorageBacked: scene.media.isStorageBacked,
      storageKey: scene.media.storageKey,
      storedUrl: scene.media.storedUrl,
    }));

    // Determine media type
    const mediaType = scene.media.type || getMediaTypeFromUrl(mediaUrl);
    if (!mediaType) {
      console.error(`[MEDIA-DEBUG] Cannot determine media type for URL: ${mediaUrl}`);
      return false;
    }
    console.log(`[MEDIA-DEBUG] Determined media type: ${mediaType}`);

    // Import dynamically to avoid circular dependencies
    const { storeMediaContent } = await import('./api-client');
    console.log(`[MEDIA-DEBUG] Imported storeMediaContent function`);

    // Call API to store media
    console.log(`[MEDIA-DEBUG] Calling API to store media with params:`, JSON.stringify({
      url: mediaUrl,
      project_id: projectId,
      scene_id: scene.id,
      media_type: mediaType,
      create_thumbnail: true
    }));
    
    const result = await storeMediaContent({
      url: mediaUrl,
      project_id: projectId,
      scene_id: scene.id,
      media_type: mediaType,
      create_thumbnail: true
    });

    if (result.error || !result.data) {
      console.error('[MEDIA-DEBUG] Failed to store media content:', result.error);
      return false;
    }

    const storageData = result.data;
    console.log('[MEDIA-DEBUG] Media stored successfully. Response:', JSON.stringify(storageData));
    console.log('[MEDIA-DEBUG] Storage URL received:', storageData.url);

    // Update scene with storage information
    const updatedMediaData: Partial<Scene['media']> = {
      ...scene.media,
      storageKey: storageData.storage_key,
      storedUrl: storageData.url,
      originalUrl: storageData.original_url || mediaUrl,
      contentType: storageData.content_type,
      fileSize: storageData.file_size,
      isStorageBacked: true,
      storedAt: Date.now(),
      // Actually use the stored URL instead of keeping the original URL
      url: storageData.url
    };

    console.log('[MEDIA-DEBUG] Updating scene with media data:', JSON.stringify(updatedMediaData));
    console.log('[MEDIA-DEBUG] New URL to be used for media:', updatedMediaData.url);

    // Update the scene with new media data
    updateSceneMedia(scene.id, updatedMediaData);
    console.log(`[MEDIA-DEBUG] ========== Media storage completed for scene ${scene.id} ==========`);
    return true;
  } catch (error) {
    console.error('[MEDIA-DEBUG] Error storing scene media:', error);
    return false;
  }
};

/**
 * Stores all unstored media in a project to R2 storage.
 * 
 * This function is useful for migrating existing projects to use R2 storage
 * for all their media assets.
 * 
 * @param project - The project containing scenes to process
 * @param updateSceneMedia - Function to update scene media data
 * @returns Promise with count of successfully stored media items
 */
export const storeAllProjectMedia = async (
  project: Project,
  updateSceneMedia: (sceneId: string, mediaData: Partial<Scene['media']>) => void
): Promise<{ total: number; success: number; failed: number }> => {
  if (!project || !project.id || !project.scenes || !Array.isArray(project.scenes)) {
    console.error('Invalid project data for media storage');
    return { total: 0, success: 0, failed: 0 };
  }

  const projectId = project.id;
  const mediaScenes = project.scenes.filter(scene => 
    scene && scene.id && scene.media && scene.media.url && 
    !scene.media.isStorageBacked && !scene.media.storageKey
  );

  console.log(`Processing ${mediaScenes.length} scenes with unstored media in project ${projectId}`);
  
  if (mediaScenes.length === 0) {
    return { total: 0, success: 0, failed: 0 };
  }

  let successCount = 0;
  let failedCount = 0;

  // Process each scene sequentially to avoid overwhelming the server
  for (const scene of mediaScenes) {
    try {
      console.log(`Processing scene ${scene.id} with media URL: ${scene.media!.url}`);
      const success = await storeSceneMedia(scene, projectId, updateSceneMedia);
      
      if (success) {
        successCount++;
        console.log(`Successfully stored media for scene ${scene.id} (${successCount}/${mediaScenes.length})`);
      } else {
        failedCount++;
        console.warn(`Failed to store media for scene ${scene.id}`);
      }

      // Add a slight delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      failedCount++;
      console.error(`Error processing scene ${scene.id}:`, error);
    }
  }

  const result = {
    total: mediaScenes.length,
    success: successCount,
    failed: failedCount
  };

  console.log(`Completed media storage process. Results:`, result);
  return result;
};

/**
 * Generates a thumbnail from a video element
 * This function creates a thumbnail directly from the video using HTML5 Canvas
 * 
 * @param videoUrl URL of the video to generate thumbnail from
 * @returns Promise resolving to a data URL containing the thumbnail image
 */
export const generateVideoThumbnail = async (videoUrl: string): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      
      // Set up event listeners
      let hasResolved = false;
      
      // Set a timeout to handle videos that might not load correctly
      const timeoutId = setTimeout(() => {
        if (!hasResolved) {
          console.warn(`Thumbnail generation timed out for video: ${videoUrl}`);
          hasResolved = true;
          resolve(null);
        }
      }, 10000); // 10 second timeout
      
      // Handle loading errors
      video.onerror = () => {
        if (!hasResolved) {
          console.error(`Error loading video for thumbnail generation: ${videoUrl}`);
          clearTimeout(timeoutId);
          hasResolved = true;
          resolve(null);
        }
      };
      
      // When the video metadata is loaded, capture a frame
      video.onloadedmetadata = () => {
        // Jump to the 1 second mark or the middle of the video for thumbnail
        video.currentTime = video.duration < 2 ? 0 : Math.min(1, video.duration / 2);
      };
      
      // When seeking completes, capture the frame
      video.onseeked = () => {
        if (hasResolved) return;
        
        try {
          // Create a canvas element
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          // Draw the video frame to the canvas
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            throw new Error('Could not get canvas context');
          }
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to data URL
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Clean up
          clearTimeout(timeoutId);
          hasResolved = true;
          
          console.log(`Generated thumbnail for video: ${videoUrl}`);
          resolve(thumbnailUrl);
        } catch (error) {
          console.error('Error generating thumbnail:', error);
          if (!hasResolved) {
            clearTimeout(timeoutId);
            hasResolved = true;
            resolve(null);
          }
        } finally {
          // Clean up video element
          video.pause();
          video.src = '';
          video.load();
        }
      };
      
      // Enable CORS for the video
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      
      // Set the source - this will start loading the video
      video.src = videoUrl;
      video.load();
      
      // Try to play the video to trigger the seeking
      video.play().catch(err => {
        console.warn('Could not play video for thumbnail generation:', err);
        // Still try to seek even if play fails
        if (video.readyState >= 2) {
          video.currentTime = video.duration < 2 ? 0 : Math.min(1, video.duration / 2);
        }
      });
    } catch (error) {
      console.error('Error in thumbnail generation:', error);
      resolve(null);
    }
  });
}; 