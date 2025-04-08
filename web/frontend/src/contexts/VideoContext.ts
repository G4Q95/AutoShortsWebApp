/**
 * VideoContext - Manages video playback and state
 * Provides a clean interface for video operations with proper error handling
 */
export class VideoContext {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the video context with the given media URL
   */
  async initialize(mediaUrl: string, localMediaUrl?: string | null): Promise<void> {
    if (!this.video) {
      throw new Error('Video element not set');
    }

    // Set the video source
    this.video.src = localMediaUrl || mediaUrl;

    // Wait for the video to be ready
    try {
      await new Promise<void>((resolve, reject) => {
        if (!this.video) return reject(new Error('Video element not set'));

        const onLoadedMetadata = () => {
          this.video?.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video?.removeEventListener('error', onError);
          resolve();
        };

        const onError = (e: Event) => {
          this.video?.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video?.removeEventListener('error', onError);
          reject(new Error('Failed to load video'));
        };

        this.video.addEventListener('loadedmetadata', onLoadedMetadata);
        this.video.addEventListener('error', onError);
      });

      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Set the video element reference
   */
  setVideo(video: HTMLVideoElement): void {
    this.video = video;
  }

  /**
   * Set the canvas element reference
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
  }

  /**
   * Start video playback
   */
  async play(): Promise<void> {
    if (!this.isInitialized || !this.video) {
      throw new Error('Video context not initialized');
    }

    try {
      await this.video.play();
    } catch (error) {
      throw new Error('Failed to start playback');
    }
  }

  /**
   * Pause video playback
   */
  async pause(): Promise<void> {
    if (!this.isInitialized || !this.video) {
      throw new Error('Video context not initialized');
    }

    try {
      this.video.pause();
    } catch (error) {
      throw new Error('Failed to pause playback');
    }
  }

  /**
   * Seek to a specific time
   */
  async seek(time: number): Promise<void> {
    if (!this.isInitialized || !this.video) {
      throw new Error('Video context not initialized');
    }

    try {
      this.video.currentTime = time;
    } catch (error) {
      throw new Error('Failed to seek');
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.isInitialized || !this.video) {
      return 0;
    }
    return this.video.currentTime;
  }

  /**
   * Get video duration
   */
  getDuration(): number {
    if (!this.isInitialized || !this.video) {
      return 0;
    }
    return this.video.duration;
  }

  /**
   * Check if video is currently playing
   */
  isPlaying(): boolean {
    if (!this.isInitialized || !this.video) {
      return false;
    }
    return !this.video.paused;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
    this.video = null;
    this.canvas = null;
    this.isInitialized = false;
  }
} 