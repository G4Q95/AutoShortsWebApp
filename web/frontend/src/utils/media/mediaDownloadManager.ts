/**
 * MediaDownloadManager.ts
 * 
 * This utility downloads media from remote URLs (like Cloudflare R2) and creates
 * local Object URLs for improved compatibility with VideoContext, especially
 * for seeking/scrubbing operations that don't work well with remote storage.
 */

interface MediaMapping {
  originalUrl: string;
  localUrl: string;
  blob: Blob;
  mediaType: string;
  lastAccessed: number;
}

class MediaDownloadManager {
  private static instance: MediaDownloadManager;
  private mediaCache: Map<string, MediaMapping>;
  private pendingDownloads: Map<string, Promise<string>>;
  private maxCacheSize: number;
  
  /**
   * Create a new MediaDownloadManager
   * @param maxCacheSize Maximum number of media items to keep in cache
   */
  private constructor(maxCacheSize = 50) {
    this.mediaCache = new Map();
    this.pendingDownloads = new Map();
    this.maxCacheSize = maxCacheSize;
    console.log('MediaDownloadManager initialized');
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
   * Get a local URL for the given remote URL
   * If the media is already downloaded, returns the cached local URL
   * If not, downloads the media and creates a new local URL
   * 
   * @param remoteUrl The original remote URL (e.g., Cloudflare R2 URL)
   * @param mediaType The type of media ('video' or 'image')
   * @param priority Whether this download should be prioritized
   * @returns A promise resolving to the local Object URL
   */
  public async getLocalUrl(remoteUrl: string, mediaType: 'video' | 'image', priority = false): Promise<string> {
    console.log(`MediaDownloadManager: Getting local URL for ${mediaType} at ${remoteUrl}`);
    
    // If already cached, return the local URL immediately
    if (this.mediaCache.has(remoteUrl)) {
      const mapping = this.mediaCache.get(remoteUrl)!;
      mapping.lastAccessed = Date.now();
      console.log(`MediaDownloadManager: Using cached URL for ${remoteUrl}`);
      return mapping.localUrl;
    }
    
    // If already downloading, return the pending promise
    if (this.pendingDownloads.has(remoteUrl)) {
      console.log(`MediaDownloadManager: Download already in progress for ${remoteUrl}`);
      return this.pendingDownloads.get(remoteUrl)!;
    }
    
    // Start a new download
    console.log(`MediaDownloadManager: Starting download for ${remoteUrl}`);
    const downloadPromise = this._downloadMedia(remoteUrl, mediaType, priority);
    this.pendingDownloads.set(remoteUrl, downloadPromise);
    
    try {
      const localUrl = await downloadPromise;
      this.pendingDownloads.delete(remoteUrl);
      console.log(`MediaDownloadManager: Download complete, created local URL for ${remoteUrl}`);
      return localUrl;
    } catch (error) {
      this.pendingDownloads.delete(remoteUrl);
      console.error(`Failed to download media from ${remoteUrl}:`, error);
      // Return the original URL as fallback if download fails
      console.log(`MediaDownloadManager: Download failed, falling back to original URL ${remoteUrl}`);
      return remoteUrl;
    }
  }
  
  /**
   * Internal method to download media from a remote URL and create a local Object URL
   * 
   * @param remoteUrl The original remote URL
   * @param mediaType The type of media ('video' or 'image')
   * @param priority Whether this download should be prioritized
   * @returns A promise resolving to the local Object URL
   */
  private async _downloadMedia(remoteUrl: string, mediaType: 'video' | 'image', priority: boolean): Promise<string> {
    try {
      // Check cache size and clean up if needed
      if (this.mediaCache.size >= this.maxCacheSize) {
        console.log(`MediaDownloadManager: Cache limit reached (${this.mediaCache.size}), cleaning up`);
        this.cleanupCache();
      }
      
      // Handle Reddit URLs specifically
      let fetchUrl = remoteUrl;
      if (remoteUrl.includes('v.redd.it')) {
        // Use proxy URL for Reddit videos to avoid CORS issues
        const apiUrl = process.env.NEXT_PUBLIC_BROWSER_API_URL || 'http://localhost:8000';
        fetchUrl = `${apiUrl}/api/v1/content/proxy/reddit-video?url=${encodeURIComponent(remoteUrl)}`;
        console.log(`MediaDownloadManager: Using proxy for Reddit video: ${fetchUrl}`);
      }
      
      console.log(`MediaDownloadManager: Fetching ${mediaType} from ${fetchUrl}`);
      // Fetch the media as a blob
      const response = await fetch(fetchUrl, {
        headers: priority ? { 'Priority': 'high' } : undefined
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log(`MediaDownloadManager: Downloaded blob size: ${Math.round(blob.size / 1024)} KB`);
      const localUrl = URL.createObjectURL(blob);
      
      // Store in cache
      this.mediaCache.set(remoteUrl, {
        originalUrl: remoteUrl,
        localUrl,
        blob,
        mediaType,
        lastAccessed: Date.now()
      });
      
      console.log(`MediaDownloadManager: Created object URL: ${localUrl}`);
      return localUrl;
    } catch (error) {
      console.error(`Error downloading media from ${remoteUrl}:`, error);
      throw error;
    }
  }
  
  /**
   * Release resources for a specific URL
   * 
   * @param remoteUrl The original remote URL to release
   */
  public release(remoteUrl: string): void {
    if (this.mediaCache.has(remoteUrl)) {
      const mapping = this.mediaCache.get(remoteUrl)!;
      console.log(`MediaDownloadManager: Releasing resources for ${remoteUrl}`);
      URL.revokeObjectURL(mapping.localUrl);
      this.mediaCache.delete(remoteUrl);
    }
  }
  
  /**
   * Clean up the oldest or least recently used media items from cache
   */
  private cleanupCache(): void {
    // If cache is empty, nothing to do
    if (this.mediaCache.size === 0) return;
    
    // Find the least recently accessed items
    const entries = Array.from(this.mediaCache.entries());
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove the oldest 20% of items
    const itemsToRemove = Math.max(1, Math.floor(this.mediaCache.size * 0.2));
    console.log(`MediaDownloadManager: Cleaning up ${itemsToRemove} items from cache`);
    
    for (let i = 0; i < itemsToRemove; i++) {
      const [url, mapping] = entries[i];
      console.log(`MediaDownloadManager: Removing ${url} from cache (last accessed ${new Date(mapping.lastAccessed).toISOString()})`);
      URL.revokeObjectURL(mapping.localUrl);
      this.mediaCache.delete(url);
    }
  }
  
  /**
   * Check if media for a URL is already downloaded and cached
   * 
   * @param remoteUrl The original remote URL
   * @returns True if the media is already cached
   */
  public hasLocalUrl(remoteUrl: string): boolean {
    return this.mediaCache.has(remoteUrl);
  }
  
  /**
   * Download media and return the object URL
   * 
   * @param remoteUrl The remote URL to download
   * @param sceneId Scene identifier for cache tracking
   * @param projectId Project identifier for cache tracking
   * @param mediaType Type of media ('video', 'image', or 'gallery')
   * @param options Optional parameters like progress callback
   * @returns Promise resolving to the object URL
   */
  public async downloadMedia(
    remoteUrl: string,
    sceneId: string,
    projectId: string,
    mediaType: 'video' | 'image' | 'gallery',
    options?: { onProgress?: (progress: number) => void }
  ): Promise<string> {
    // Simplify to use existing method
    const simplifiedType = mediaType === 'gallery' ? 'image' : mediaType as 'video' | 'image';
    return this.getLocalUrl(remoteUrl, simplifiedType, true);
  }
  
  /**
   * Check if media is already downloaded for a given URL and scene
   * 
   * @param remoteUrl The remote URL
   * @param sceneId Scene identifier
   * @returns True if the media is already downloaded
   */
  public isMediaDownloaded(remoteUrl: string, sceneId: string): boolean {
    return this.hasLocalUrl(remoteUrl);
  }
  
  /**
   * Get the object URL for a downloaded media
   * 
   * @param remoteUrl The remote URL
   * @param sceneId Scene identifier
   * @returns The object URL or null if not downloaded
   */
  public getObjectUrl(remoteUrl: string, sceneId: string): string | null {
    if (this.mediaCache.has(remoteUrl)) {
      return this.mediaCache.get(remoteUrl)!.localUrl;
    }
    return null;
  }
  
  /**
   * Release media resources for a given URL and scene
   * 
   * @param remoteUrl The remote URL
   * @param sceneId Scene identifier
   */
  public releaseMedia(remoteUrl: string, sceneId: string): void {
    this.release(remoteUrl);
  }
  
  /**
   * Get download progress for a specific URL
   * Note: This is not currently implemented but could be added later
   * 
   * @param remoteUrl The original remote URL
   * @returns A number between 0 and 1 representing download progress, or -1 if not downloading
   */
  public getDownloadProgress(remoteUrl: string): number {
    // Currently not implemented - would require fetch with ReadableStream processing
    return this.pendingDownloads.has(remoteUrl) ? 0 : (this.mediaCache.has(remoteUrl) ? 1 : -1);
  }
  
  /**
   * Release all resources and clear the cache
   */
  public releaseAll(): void {
    console.log(`MediaDownloadManager: Releasing all resources (${this.mediaCache.size} items)`);
    for (const mapping of this.mediaCache.values()) {
      URL.revokeObjectURL(mapping.localUrl);
    }
    this.mediaCache.clear();
    this.pendingDownloads.clear();
  }
}

export default MediaDownloadManager; 