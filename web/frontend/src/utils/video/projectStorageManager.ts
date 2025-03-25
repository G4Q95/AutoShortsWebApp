/**
 * ProjectStorageManager.ts
 * 
 * This utility manages the organized storage structure for projects in Cloudflare R2,
 * implementing the strategy described in Video-Integration-Part2.md for keeping
 * media files organized in project-specific folders.
 * 
 * The storage structure follows:
 * projects/
 *   {projectId}/
 *     media/
 *       images/
 *       videos/
 *       thumbnails/
 *     audio/
 *       {sceneId}/
 *         base.mp3
 *         generated.mp3
 *     exports/
 *       segments/
 *       final/
 */

import { storeMediaContent } from '@/lib/api-client';
import { getMediaTypeFromUrl } from '@/lib/media-utils';
import { Scene } from '@/components/project/ProjectTypes';

// Define media categories
export enum MediaCategory {
  IMAGE = 'images',
  VIDEO = 'videos',
  AUDIO = 'audio',
  THUMBNAIL = 'thumbnails',
  EXPORT = 'exports',
}

interface StorageOptions {
  createThumbnail?: boolean;
  versionSuffix?: string;
  mediaTypeOverride?: string;
  metadata?: Record<string, string>;
}

class ProjectStorageManager {
  private static instance: ProjectStorageManager;
  
  private constructor() {
    // Private constructor for singleton
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ProjectStorageManager {
    if (!ProjectStorageManager.instance) {
      ProjectStorageManager.instance = new ProjectStorageManager();
    }
    return ProjectStorageManager.instance;
  }
  
  /**
   * Generate a storage path for a media file in a project
   * 
   * @param projectId Project ID
   * @param sceneId Scene ID
   * @param mediaType Type of media (image, video, etc.)
   * @param fileName Filename to use
   * @returns Formatted storage path
   */
  public generateStoragePath(
    projectId: string,
    sceneId: string,
    mediaType: string,
    fileName: string
  ): string {
    // Determine the media category based on type
    let category = MediaCategory.VIDEO;
    
    if (mediaType.includes('image')) {
      category = MediaCategory.IMAGE;
    } else if (mediaType.includes('audio')) {
      category = MediaCategory.AUDIO;
    }
    
    // Generate path with the format: projects/{projectId}/media/{category}/{sceneId}/{fileName}
    return `projects/${projectId}/media/${category}/${sceneId}/${fileName}`;
  }
  
  /**
   * Generate a timestamp-based filename
   * 
   * @param originalName Original filename or base name
   * @param extension File extension (with or without dot)
   * @param action Optional action name for versioning
   * @returns Formatted filename with timestamp
   */
  public generateFileName(
    originalName: string,
    extension: string,
    action?: string
  ): string {
    // Ensure extension has a dot
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    
    // Clean the original name (remove extension if present)
    const baseName = originalName.replace(/\.[^/.]+$/, '');
    
    // Generate timestamp
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
    
    // Format with action if provided
    if (action) {
      return `${baseName}_${action}_${timestamp}${ext}`;
    }
    
    return `${baseName}_${timestamp}${ext}`;
  }
  
  /**
   * Store a media file in the project structure
   * 
   * @param url URL of the media to store
   * @param projectId Project ID
   * @param sceneId Scene ID
   * @param options Storage options
   * @returns Promise with the stored media URL and storage key
   */
  public async storeMedia(
    url: string,
    projectId: string,
    sceneId: string,
    options: StorageOptions = {}
  ): Promise<{ url: string; storageKey: string } | null> {
    try {
      // Determine media type
      const mediaType = options.mediaTypeOverride || getMediaTypeFromUrl(url);
      if (!mediaType) {
        console.error(`[ProjectStorage] Cannot determine media type for URL: ${url}`);
        return null;
      }
      
      // Generate a filename with timestamp
      const extension = this.getExtensionFromMediaType(mediaType);
      const fileName = this.generateFileName(
        `media`,
        extension,
        options.versionSuffix
      );
      
      // Generate the storage path
      const storageKey = this.generateStoragePath(
        projectId,
        sceneId,
        mediaType,
        fileName
      );
      
      // Call the API to store media
      const result = await storeMediaContent({
        url,
        project_id: projectId,
        scene_id: sceneId,
        media_type: mediaType,
        create_thumbnail: options.createThumbnail ?? true,
      });
      
      if (result.error) {
        console.error(`[ProjectStorage] Failed to store media: ${result.error.message}`);
        return null;
      }
      
      if (!result.data?.url || !result.data?.storage_key) {
        console.error(`[ProjectStorage] Storage API returned invalid data:`, result.data);
        return null;
      }
      
      return {
        url: result.data.url,
        storageKey: result.data.storage_key,
      };
    } catch (error) {
      console.error(`[ProjectStorage] Error storing media:`, error);
      return null;
    }
  }
  
  /**
   * Store all media for a scene in the project structure
   * 
   * @param scene Scene to process
   * @param projectId Project ID
   * @returns Promise that resolves when all media is stored
   */
  public async storeSceneMedia(
    scene: Scene,
    projectId: string
  ): Promise<Partial<Scene> | null> {
    if (!scene.media?.url) {
      console.log(`[ProjectStorage] Scene ${scene.id} has no media URL to store`);
      return null;
    }
    
    // Skip if already stored
    if (scene.media.isStorageBacked || scene.media.storageKey) {
      console.log(`[ProjectStorage] Media for scene ${scene.id} already stored`);
      return null;
    }
    
    // Store media
    const mediaResult = await this.storeMedia(
      scene.media.url,
      projectId,
      scene.id
    );
    
    if (!mediaResult) {
      console.error(`[ProjectStorage] Failed to store media for scene ${scene.id}`);
      return null;
    }
    
    // Store audio if present
    let audioResult = null;
    if (scene.audio?.audio_url && !scene.audio.storageKey) {
      audioResult = await this.storeMedia(
        scene.audio.audio_url,
        projectId,
        scene.id,
        {
          mediaTypeOverride: 'audio/mpeg',
          versionSuffix: 'voice',
        }
      );
    }
    
    // Return updated scene data
    return {
      media: {
        ...scene.media,
        storedUrl: mediaResult.url,
        storageKey: mediaResult.storageKey,
        isStorageBacked: true,
      },
      ...(audioResult && {
        audio: {
          ...scene.audio,
          persistentUrl: audioResult.url,
          storageKey: audioResult.storageKey,
        },
      }),
    };
  }
  
  /**
   * Get extension from media type
   * 
   * @param mediaType MIME type of the media
   * @returns Appropriate file extension
   */
  private getExtensionFromMediaType(mediaType: string): string {
    if (mediaType.includes('video/mp4') || mediaType === 'video') {
      return '.mp4';
    } else if (mediaType.includes('image/jpeg') || mediaType === 'image') {
      return '.jpg';
    } else if (mediaType.includes('image/png')) {
      return '.png';
    } else if (mediaType.includes('image/gif')) {
      return '.gif';
    } else if (mediaType.includes('audio/mpeg')) {
      return '.mp3';
    } else if (mediaType.includes('audio/wav')) {
      return '.wav';
    }
    
    // Default based on general type
    if (mediaType.includes('video')) {
      return '.mp4';
    } else if (mediaType.includes('image')) {
      return '.jpg';
    } else if (mediaType.includes('audio')) {
      return '.mp3';
    }
    
    return '.bin'; // Default binary extension
  }
}

export default ProjectStorageManager; 