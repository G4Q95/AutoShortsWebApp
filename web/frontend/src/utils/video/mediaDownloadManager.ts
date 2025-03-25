/**
 * MediaDownloadManager.ts
 * 
 * This utility handles downloading media files from Cloudflare R2 to the browser
 * and managing local object URLs for editing with VideoContext.
 * 
 * It implements the browser-local editing approach described in Video-Integration-Part2.md,
 * which solves the issue of seeking/scrubbing with R2-hosted videos.
 */

import { Scene } from '@/components/project/ProjectTypes';

interface MediaDownloadOptions {
  timeout?: number;
  priority?: 'high' | 'medium' | 'low';
  onProgress?: (progress: number) => void;
}

interface DownloadedMedia {
  objectUrl: string;
  originalUrl: string;
  blob: Blob;
  type: string;
  sceneId: string;
  projectId: string;
  downloadTime: Date;
}

class MediaDownloadManager {
  private static instance: MediaDownloadManager;
  private downloadedMedia: Map<string, DownloadedMedia>;
  private activeDownloads: Map<string, Promise<string>>;
  private defaultOptions: MediaDownloadOptions = {
    timeout: 30000,
    priority: 'medium',
  };

  private constructor() {
    this.downloadedMedia = new Map();
    this.activeDownloads = new Map();
    // Add event listener for page unload to clean up object URLs
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.cleanup.bind(this));
    }
  }

  /**
   * Get the singleton instance of MediaDownloadManager
   */
  public static getInstance(): MediaDownloadManager {
    if (!MediaDownloadManager.instance) {
      MediaDownloadManager.instance = new MediaDownloadManager();
    }
    return MediaDownloadManager.instance;
  }

  /**
   * Download media and create an object URL
   * 
   * @param url URL of the media to download
   * @param sceneId ID of the scene containing the media
   * @param projectId ID of the project
   * @param mediaType Type of media (image, video, etc.)
   * @param options Download options (timeout, priority, progress callback)
   * @returns Promise that resolves to an object URL
   */
  public async downloadMedia(
    url: string,
    sceneId: string,
    projectId: string,
    mediaType: string,
    options: MediaDownloadOptions = {}
  ): Promise<string> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const key = this.getMediaKey(url, sceneId);

    // Check if media is already downloaded
    if (this.downloadedMedia.has(key)) {
      console.log(`[MediaDownloadManager] Using cached media for ${key}`);
      return this.downloadedMedia.get(key)!.objectUrl;
    }

    // Check if download is already in progress
    if (this.activeDownloads.has(key)) {
      console.log(`[MediaDownloadManager] Reusing active download for ${key}`);
      return this.activeDownloads.get(key)!;
    }

    // Start new download
    console.log(`[MediaDownloadManager] Starting download for ${url}`);
    const downloadPromise = this.fetchMedia(url, mergedOptions)
      .then(blob => {
        // Create object URL and store in cache
        const objectUrl = URL.createObjectURL(blob);
        this.downloadedMedia.set(key, {
          objectUrl,
          originalUrl: url,
          blob,
          type: mediaType,
          sceneId,
          projectId,
          downloadTime: new Date()
        });
        
        // Remove from active downloads
        this.activeDownloads.delete(key);
        console.log(`[MediaDownloadManager] Download completed for ${key}`);
        return objectUrl;
      })
      .catch(error => {
        // Remove from active downloads on error
        this.activeDownloads.delete(key);
        console.error(`[MediaDownloadManager] Download failed for ${key}:`, error);
        throw error;
      });

    // Store the promise for potential reuse
    this.activeDownloads.set(key, downloadPromise);
    return downloadPromise;
  }

  /**
   * Download media for all scenes in a project
   * 
   * @param scenes Array of scenes
   * @param projectId Project ID
   * @param options Download options
   * @returns Promise that resolves when all downloads are complete
   */
  public async downloadProjectMedia(
    scenes: Scene[],
    projectId: string,
    options: MediaDownloadOptions = {}
  ): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();
    const downloadPromises = scenes
      .filter(scene => scene.media && scene.media.url)
      .map(async (scene) => {
        try {
          const mediaUrl = scene.media!.storedUrl || scene.media!.url;
          const mediaType = scene.media!.type;
          const objectUrl = await this.downloadMedia(
            mediaUrl,
            scene.id,
            projectId,
            mediaType,
            options
          );
          urlMap.set(scene.id, objectUrl);
        } catch (error) {
          console.error(`[MediaDownloadManager] Failed to download media for scene ${scene.id}:`, error);
        }
      });

    await Promise.all(downloadPromises);
    return urlMap;
  }

  /**
   * Check if media is already downloaded
   * 
   * @param url Original URL
   * @param sceneId Scene ID
   * @returns Boolean indicating if media is cached
   */
  public isMediaDownloaded(url: string, sceneId: string): boolean {
    const key = this.getMediaKey(url, sceneId);
    return this.downloadedMedia.has(key);
  }

  /**
   * Get object URL for a media item if it exists
   * 
   * @param url Original URL
   * @param sceneId Scene ID
   * @returns Object URL or undefined if not downloaded
   */
  public getObjectUrl(url: string, sceneId: string): string | undefined {
    const key = this.getMediaKey(url, sceneId);
    return this.downloadedMedia.get(key)?.objectUrl;
  }

  /**
   * Release an object URL and remove from cache
   * 
   * @param url Original URL or object URL
   * @param sceneId Scene ID
   */
  public releaseMedia(url: string, sceneId: string): void {
    const key = this.getMediaKey(url, sceneId);
    const media = this.downloadedMedia.get(key);
    
    if (media) {
      URL.revokeObjectURL(media.objectUrl);
      this.downloadedMedia.delete(key);
      console.log(`[MediaDownloadManager] Released media for ${key}`);
    }
  }

  /**
   * Clean up all object URLs
   */
  public cleanup(): void {
    console.log(`[MediaDownloadManager] Cleaning up ${this.downloadedMedia.size} media items`);
    this.downloadedMedia.forEach(media => {
      URL.revokeObjectURL(media.objectUrl);
    });
    this.downloadedMedia.clear();
    this.activeDownloads.clear();
  }

  /**
   * Fetch media with progress tracking
   * 
   * @param url URL to fetch
   * @param options Download options
   * @returns Promise that resolves to a Blob
   */
  private async fetchMedia(
    url: string,
    options: MediaDownloadOptions
  ): Promise<Blob> {
    const { timeout, onProgress } = options;
    
    try {
      // Use fetch with timeout
      const controller = new AbortController();
      const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : null;
      
      const response = await fetch(url, { 
        signal: controller.signal,
        cache: 'force-cache' 
      });
      
      if (timeoutId) clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch media: ${response.status} ${response.statusText}`);
      }
      
      // If we have a progress callback and can get content length, track progress
      if (onProgress && response.body) {
        const contentLength = Number(response.headers.get('content-length') || 0);
        let loaded = 0;
        
        // Create a stream to track download progress
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          loaded += value.length;
          
          if (contentLength > 0) {
            onProgress(Math.min(loaded / contentLength, 1));
          }
        }
        
        // Combine chunks into a single Uint8Array
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        
        let position = 0;
        for (const chunk of chunks) {
          result.set(chunk, position);
          position += chunk.length;
        }
        
        return new Blob([result], { type: response.headers.get('content-type') || 'application/octet-stream' });
      } else {
        // Simpler path if we don't need progress tracking
        return await response.blob();
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error(`Fetch timeout after ${timeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Create a unique key for a media item
   * 
   * @param url URL of the media
   * @param sceneId Scene ID
   * @returns Unique key
   */
  private getMediaKey(url: string, sceneId: string): string {
    // Create a unique key using the URL and scene ID
    return `${sceneId}:${url}`;
  }
}

export default MediaDownloadManager; 