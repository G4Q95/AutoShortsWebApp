/**
 * File utility functions for handling media files and extensions
 */

/**
 * Get the file extension from a URL or file path
 */
export function getFileExtension(path: string): string {
  const match = path.match(/\.([^.]+)$/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Check if a file is a video based on its extension
 */
export function isVideoFile(path: string): boolean {
  const ext = getFileExtension(path);
  return ['mp4', 'webm', 'mov', 'avi'].includes(ext);
}

/**
 * Check if a file is an image based on its extension
 */
export function isImageFile(path: string): boolean {
  const ext = getFileExtension(path);
  return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
}

/**
 * Format bytes to human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Generate a safe filename from a string
 */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
} 