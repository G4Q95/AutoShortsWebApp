/**
 * VideoContext - Manages video playback and state
 * Provides a clean interface for video operations with proper error handling
 */
export class VideoContext {
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private isInitialized: boolean = false;
  private _debugMode: boolean = false;

  constructor(debugMode: boolean = false) {
    this._debugMode = debugMode;
  }

  private log(...args: any[]) {
    if (this._debugMode) {
      console.log('[VideoContext]', ...args);
    }
  }

  private error(...args: any[]) {
    console.error('[VideoContext ERROR]', ...args);
  }

  /**
   * Initialize the video context with the given media URL
   */
  async initialize(directUrl?: string, localUrl?: string | null): Promise<void> {
    if (!this.video) {
      this.error('Video element not set before initialization');
      throw new Error('Video element not set');
    }

    // Ensure the video element is properly configured
    this.video.crossOrigin = 'anonymous';
    this.video.preload = 'auto';
    this.video.playsInline = true;
    
    // Reset state
    this.isInitialized = false;

    // If we have a URL, set it (prefer local URL if available)
    const effectiveUrl = localUrl || directUrl;
    if (effectiveUrl) {
      this.log(`Setting video.src to: ${effectiveUrl}`);
      
      // Handle Reddit and other problematic URLs by adding cache-busting
      const urlObj = this.processUrl(effectiveUrl);
      
      this.video.src = urlObj;
    } else {
      this.log('No URL provided for initialization, using existing video.src');
      // If no URL is provided, we'll use whatever is already in the video.src
      if (!this.video.src) {
        this.error('No source URL available for video');
        throw new Error('No source URL provided for video');
      }
    }

    // Wait for the video to be ready
    try {
      this.log('Waiting for video to load metadata...');
      await new Promise<void>((resolve, reject) => {
        if (!this.video) {
          this.error('Video element disappeared during initialization');
          return reject(new Error('Video element not set'));
        }

        // If metadata is already loaded, resolve immediately
        if (this.video.readyState >= 1) {
          this.log('Video metadata already loaded');
          resolve();
          return;
        }

        const onLoadedMetadata = () => {
          this.log('Video metadata loaded successfully');
          this.video?.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video?.removeEventListener('error', onError);
          clearTimeout(timeoutId);
          resolve();
        };

        const onError = (e: Event) => {
          const errorDetails = this.video?.error 
            ? `${this.video.error.code}: ${this.video.error.message}` 
            : 'Unknown error';
          
          this.error(`Video load error: ${errorDetails}`, e);
          
          // Add more context to the error message
          let detailedMessage = `Failed to load video: ${errorDetails}`;
          
          // Add source URL information (helpful for debugging)
          if (this.video?.src) {
            detailedMessage += ` (Source: ${this.video.src.split('?')[0]})`;
          }
          
          this.video?.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video?.removeEventListener('error', onError);
          clearTimeout(timeoutId);
          reject(new Error(detailedMessage));
        };

        this.video.addEventListener('loadedmetadata', onLoadedMetadata);
        this.video.addEventListener('error', onError);
        
        // Set a timeout to prevent hanging indefinitely
        const timeoutId = setTimeout(() => {
          this.error('Video metadata load timeout after 15 seconds');
          this.video?.removeEventListener('loadedmetadata', onLoadedMetadata);
          this.video?.removeEventListener('error', onError);
          
          // Instead of rejecting, try to continue if there's a valid video element
          if (this.video && this.video.src) {
            this.log('Continuing despite timeout - some videos might still play');
            resolve();
          } else {
            reject(new Error('Video load timeout'));
          }
        }, 15000);  // 15 second timeout
        
        // Force a load to trigger events
        this.video.load();
      });

      this.isInitialized = true;
      this.log('Initialization complete, ready state:', this.video.readyState);
      
      // Optional: Draw the first frame to canvas if it exists
      if (this.canvas && this.video.readyState >= 2) {
        this.drawFrameToCanvas();
      }
    } catch (error) {
      this.isInitialized = false;
      this.error('Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Process URL to handle special cases (Reddit, etc.)
   */
  private processUrl(url: string): string {
    if (!url) return url;
    
    try {
      // Check if it's a Reddit video URL
      if (url.includes('v.redd.it') || url.includes('reddit')) {
        this.log('Reddit video URL detected - adding cache-busting');
        
        // Add a timestamp parameter to prevent caching
        const delimiter = url.includes('?') ? '&' : '?';
        return `${url}${delimiter}_t=${Date.now()}`;
      }
      
      // Check if it's a blob URL (already local, no need to process)
      if (url.startsWith('blob:')) {
        return url;
      }
      
      // For other URLs, just return as is
      return url;
    } catch (e) {
      this.error('Error processing URL:', e);
      // Return original URL if anything goes wrong
      return url;
    }
  }

  /**
   * Draw current video frame to canvas
   */
  drawFrameToCanvas(): boolean {
    if (!this.canvas || !this.video || this.video.readyState < 2) {
      this.log('Cannot draw frame - canvas or video not ready');
      return false;
    }
    
    try {
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        this.error('Failed to get canvas context');
        return false;
      }
      
      // Set canvas dimensions to match video
      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;
      
      // Clear canvas
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Draw video frame
      ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      
      this.log('Frame drawn to canvas');
      return true;
    } catch (error) {
      this.error('Error drawing frame to canvas:', error);
      return false;
    }
  }

  /**
   * Set the video element reference
   */
  setVideo(video: HTMLVideoElement): void {
    this.log('Setting video element:', video);
    this.video = video;
  }

  /**
   * Set the canvas element reference
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.log('Setting canvas element:', canvas);
    this.canvas = canvas;
  }

  /**
   * Start video playback
   */
  async play(): Promise<void> {
    if (!this.isInitialized || !this.video) {
      this.error('Cannot play - video context not initialized');
      throw new Error('Video context not initialized');
    }

    try {
      this.log('Starting playback...');
      
      // Check video visibility and fix it if needed
      const isHidden = this.video.style.display === 'none' || 
                       this.video.style.visibility === 'hidden' ||
                       this.video.getBoundingClientRect().width === 0;
                       
      if (isHidden) {
        this.log('Video element is hidden, making it visible...');
        // Make video visible - this is critical for playback
        this.video.style.display = 'block';
        this.video.style.visibility = 'visible';
        
        // If using a canvas for first-frame display, hide it now
        if (this.canvas) {
          this.canvas.style.display = 'none';
        }
      }
      
      // Ensure video element is ready to play
      if (this.video.readyState < 2) {
        this.log('Video not ready to play (readyState < 2), waiting for canplay event...');
        await new Promise<void>((resolve, reject) => {
          const videoElement = this.video;
          if (!videoElement) {
            reject(new Error('Video element not available'));
            return;
          }
          
          // If already in ready state, resolve immediately
          if (videoElement.readyState >= 2) {
            resolve();
            return;
          }
          
          const onCanPlay = () => {
            videoElement.removeEventListener('canplay', onCanPlay);
            videoElement.removeEventListener('error', onError);
            clearTimeout(timeoutId);
            resolve();
          };
          
          const onError = (e: Event) => {
            videoElement.removeEventListener('canplay', onCanPlay);
            videoElement.removeEventListener('error', onError);
            clearTimeout(timeoutId);
            reject(new Error('Video playback error: ' + 
              (videoElement.error ? videoElement.error.message : 'Unknown error')));
          };
          
          videoElement.addEventListener('canplay', onCanPlay);
          videoElement.addEventListener('error', onError);
          
          // Add timeout to avoid hanging
          const timeoutId = setTimeout(() => {
            videoElement.removeEventListener('canplay', onCanPlay);
            videoElement.removeEventListener('error', onError);
            
            // Try to continue even if not fully ready
            if (videoElement.readyState >= 1) {
              this.log('Proceeding with play despite readyState < 2');
              resolve();
            } else {
              reject(new Error('Timeout waiting for video to be ready to play'));
            }
          }, 5000);
        });
      }
      
      // Start playback
      await this.video.play();
      
      this.log('Playback started successfully');
    } catch (error) {
      this.error('Failed to start playback:', error);
      throw error;
    }
  }

  /**
   * Pause video playback
   */
  async pause(): Promise<void> {
    if (!this.isInitialized || !this.video) {
      this.error('Cannot pause - video context not initialized');
      throw new Error('Video context not initialized');
    }

    try {
      this.log('Pausing playback...');
      this.video.pause();
      this.log('Playback paused successfully');
    } catch (error) {
      this.error('Playback pause failed:', error);
      throw new Error(`Failed to pause playback: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Seek to a specific time
   */
  async seek(time: number): Promise<void> {
    if (!this.isInitialized || !this.video) {
      this.error('Cannot seek - video context not initialized');
      throw new Error('Video context not initialized');
    }

    try {
      this.log(`Seeking to ${time}s...`);
      this.video.currentTime = time;
      
      // Optional: Update canvas frame if showing first frame
      if (this.canvas && this.canvas.style.display !== 'none') {
        this.drawFrameToCanvas();
      }
      
      this.log('Seek completed successfully');
    } catch (error) {
      this.error('Seek failed:', error);
      throw new Error(`Failed to seek: ${error instanceof Error ? error.message : String(error)}`);
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
   * Get current ready state
   */
  getReadyState(): number {
    if (!this.video) return 0;
    return this.video.readyState;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.log('Destroying VideoContext...');
    if (this.video) {
      this.video.pause();
      this.video.src = '';
      this.video.load();
    }
    this.video = null;
    this.canvas = null;
    this.isInitialized = false;
    this.log('VideoContext destroyed');
  }
} 