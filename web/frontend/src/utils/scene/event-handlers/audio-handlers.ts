/**
 * Audio-related event handlers for Scene component
 */

/**
 * Convert base64 audio data to a Blob
 * @param base64 Base64-encoded audio data
 * @param contentType MIME type of the audio (default: 'audio/mp3')
 * @returns Blob object containing the audio data
 */
export const base64ToBlob = (base64: string, contentType: string = 'audio/mp3'): Blob => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);
    
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

/**
 * Create a blob URL from audio base64 data
 * @param audioBase64 Base64-encoded audio data
 * @param contentType MIME type of the audio
 * @returns Blob URL for the audio
 */
export const createAudioBlobUrl = (audioBase64: string, contentType: string): string => {
  try {
    const blob = new Blob(
      [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
      { type: contentType }
    );
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error creating audio blob URL:', error);
    return '';
  }
};

/**
 * Toggle audio playback between play and pause
 * @param audioElement Reference to the audio element
 * @param setIsPlaying State setter for tracking play state
 */
export const togglePlayPause = (
  audioElement: HTMLAudioElement | null,
  setIsPlaying: (isPlaying: boolean) => void
): void => {
  if (!audioElement) return;
  
  if (audioElement.paused) {
    audioElement.play().catch(e => console.error("Error playing audio:", e));
    setIsPlaying(true);
  } else {
    audioElement.pause();
    setIsPlaying(false);
  }
};

/**
 * Update audio volume
 * @param audioElement Reference to the audio element
 * @param newVolume Volume level (0.0 to 1.0)
 * @param setVolume State setter for tracking volume
 */
export const handleVolumeChange = (
  audioElement: HTMLAudioElement | null,
  newVolume: number,
  setVolume: (volume: number) => void
): void => {
  setVolume(newVolume);
  if (audioElement) {
    audioElement.volume = newVolume;
  }
};

/**
 * Update audio playback speed
 * @param audioElement Reference to the audio element
 * @param newSpeed New playback speed (e.g., 1.0 for normal, 1.5 for faster)
 */
export const handlePlaybackSpeedChange = (
  audioElement: HTMLAudioElement | null,
  newSpeed: number
): void => {
  if (audioElement) {
    audioElement.playbackRate = newSpeed;
  }
};

/**
 * Calculate and format duration display for audio
 * @param currentTime Current playback time in seconds
 * @param duration Total audio duration in seconds
 * @returns Formatted time string (MM:SS/MM:SS format)
 */
export const formatTimeDisplay = (currentTime: number, duration: number): string => {
  const formatTime = (timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const currentFormatted = formatTime(currentTime);
  const durationFormatted = formatTime(duration || 0);
  
  return `${currentFormatted}/${durationFormatted}`;
};

/**
 * Download audio file from a source URL
 * @param audioSrc URL of the audio to download
 * @param fileName Name to use for the downloaded file
 */
export const downloadAudio = (audioSrc: string, fileName: string = 'audio.mp3'): void => {
  if (!audioSrc) return;
  
  try {
    const a = document.createElement('a');
    a.href = audioSrc;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading audio:', error);
  }
}; 