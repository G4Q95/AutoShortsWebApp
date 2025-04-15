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
 * Transforms a Reddit video URL to work with our proxy to solve CORS issues.
 * Handles CORS and audio track issues with v.redd.it URLs.
 * 
 * @param url - The original video URL from Reddit
 * @returns The transformed URL that can be played in the browser
 */
export const transformRedditVideoUrl = (url: string): string => {
  if (!url) return '';

  // Check if it's a Reddit video URL
  if (url.includes('v.redd.it')) {
    // Use browser API URL for client-side rendering
    const isBrowser = typeof window !== 'undefined';
    const apiUrl = isBrowser
      ? (process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:8000')
      : (process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000');
    
    console.log('Using proxy API URL:', apiUrl);
    return `${apiUrl}/api/v1/content/proxy/reddit-video?url=${encodeURIComponent(url)}`;
  }

  return url;
};

/**
 * Stores scene media content to R2 storage for better reliability and persistence.
 * 
 * This function takes a scene's media URL and stores it in R2 storage, updating 
 * the scene with storage-backed media information.
 * 
 * @param scene - The scene with media to store
 * @param project - The full project object
 * @param updateSceneMedia - Function to update the scene's media data
 * @returns Promise with boolean indicating success
 */
export const storeSceneMedia = async (
  scene: Scene, 
  project: Project,
  updateSceneMedia: (sceneId: string, mediaData: Partial<Scene['media']>) => void
): Promise<boolean> => {
  // --- TEMPORARY DEBUGGING: Throw error immediately --- 
  // throw new Error('[DEBUG THROW] storeSceneMedia was entered!'); // Removed temporary throw
  // --- END TEMPORARY DEBUGGING --- 

  const projectMongoId = project._id; // Get the MongoDB ObjectId

  console.log('[MEDIA-DEBUG] ========== Starting storeSceneMedia ==========');
  console.log(`[MEDIA-DEBUG] Processing Scene ID: ${scene.id}, Project ID: ${project.id}, Mongo ID: ${projectMongoId}`);
  console.log('[MEDIA-DEBUG] Scene Media URL:', scene.media?.url);
  console.log('[MEDIA-DEBUG] Scene Media Storage Key:', scene.media?.storageKey);

  // Basic checks
  if (!scene || !project || !updateSceneMedia) {
    console.error('[MEDIA-DEBUG] Error: Missing scene, project, or update function.');
    return false;
  }
  if (!projectMongoId) {
    console.error('[MEDIA-DEBUG] Error: Missing project MongoDB _id.');
    return false;
  }
  if (!scene.media?.url) {
    console.warn(`[MEDIA-DEBUG] Warning: Scene ${scene.id} has no media URL to store.`);
    return false; // Nothing to store
  }
  if (scene.media.storageKey) {
    console.log(`[MEDIA-DEBUG] Info: Scene ${scene.id} media already has storageKey: ${scene.media.storageKey}. Skipping.`);
    return true; // Already stored
  }

  const mediaUrl = scene.media.url;
  console.log(`[MEDIA-DEBUG] Proceeding to store media for URL: ${mediaUrl}`);

  try {
    console.log('[MEDIA-DEBUG] >>> Entering TRY block for dynamic import <<<');
    // Dynamically import storeMediaContent only when needed
    console.log('[MEDIA-DEBUG] Attempting dynamic import of storeMediaContent...');
    const { storeMediaContent } = await import('./api-client');
    console.log('[MEDIA-DEBUG] Dynamic import SUCCESSFUL.');

    if (typeof storeMediaContent !== 'function') {
      console.error('[MEDIA-DEBUG] Error: storeMediaContent is not a function after import.');
      return false;
    }
    console.log('[MEDIA-DEBUG] storeMediaContent function confirmed.');


    // Determine media type if not already set
    const mediaType = scene.media.type || determineMediaType(mediaUrl);
    if (!mediaType) {
      console.error(`[MEDIA-DEBUG] Error: Could not determine media type for URL: ${mediaUrl}`);
      return false; // Cannot proceed without media type
    }
    console.log(`[MEDIA-DEBUG] Determined/Confirmed Media Type: ${mediaType}`);

    // Prepare request data
    const requestData = {
      url: mediaUrl,
      project_id: project.id, // Use the custom project ID
      mongo_db_id: projectMongoId, // Pass the MongoDB _id
      scene_id: scene.id,
      media_type: mediaType,
      user_id: 'local_dev_user' // Added placeholder user_id
    };
    console.log('[MEDIA-DEBUG] Prepared requestData for API call:', requestData);


    console.log('[MEDIA-DEBUG] ===> ATTEMPTING storeMediaContent API call...');
    const response = await storeMediaContent(requestData);
    console.log('[MEDIA-DEBUG] <=== storeMediaContent API call FINISHED.');


    // Check response
    if (response.error || !response.data?.storage_key) {
      console.error('[MEDIA-DEBUG] Error storing media via API:', response.error || 'Missing storage key in response');
      // Optionally update scene state with error?
      return false;
    }
    console.log('[MEDIA-DEBUG] API call successful. Storage Key:', response.data.storage_key);

    // Update scene state with storage key and potentially other metadata
    updateSceneMedia(scene.id, {
      storageKey: response.data.storage_key,
      thumbnailUrl: scene.media.thumbnailUrl, // Corrected: Use existing thumb, API doesn't provide it here
      type: mediaType, // Ensure type is updated
      url: mediaUrl, // Keep original URL
      // Include width/height/duration if returned by API?
    });
    console.log(`[MEDIA-DEBUG] Dispatched updateSceneMedia for scene ${scene.id}`);

    console.log('[MEDIA-DEBUG] ========== storeSceneMedia SUCCESS ==========');
    return true; // Indicate success

  } catch (error) {
    console.error('[MEDIA-DEBUG] XXX CATCH BLOCK ERROR in storeSceneMedia XXX:', error);
    // Log specific details if it's an error object
    if (error instanceof Error) {
      console.error('[MEDIA-DEBUG] Error Name:', error.name);
      console.error('[MEDIA-DEBUG] Error Message:', error.message);
      console.error('[MEDIA-DEBUG] Error Stack:', error.stack);
    }
    console.log('[MEDIA-DEBUG] ========== storeSceneMedia FAILED (in catch) ==========');
    return false; // Indicate failure
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
      const success = await storeSceneMedia(scene, project, updateSceneMedia);
      
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