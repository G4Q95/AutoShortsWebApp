// Maintain all current exports from scene-utils.ts to ensure compatibility
export * from './scene/scene-utils';

// Now define the new storage URL function
export const constructStorageUrl = (
  storageKey: string,
  projectId: string,
  sceneId: string,
  userId: string = "default",
  fileType?: string
): string => {
  console.log(`[STORAGE-URL] Called with:`, {
    storageKey,
    projectId,
    sceneId,
    userId,
    fileType
  });
  
  if (!projectId || !sceneId) {
    console.error(`[STORAGE-URL] Missing required parameters: projectId=${projectId}, sceneId=${sceneId}`);
    return '';
  }
  
  // If no storage key is provided but we have other parameters, construct a basic path
  if (!storageKey && fileType) {
    const directUrl = `/api/v1/storage/users/${userId}/projects/${projectId}/scenes/${sceneId}/${fileType}/media`;
    console.log(`[STORAGE-URL] No storage key provided, using direct path: ${directUrl}`);
    return directUrl;
  }
  
  if (!storageKey) {
    console.error(`[STORAGE-URL] No storage key provided and no fileType to construct basic path`);
    return '';
  }
  
  // WORKAROUND: Handle case where storageKey is already a full URL
  if (storageKey.startsWith('http') || storageKey.startsWith('/api/')) {
    console.log(`[STORAGE-URL] Storage key is already a URL, returning as-is: ${storageKey}`);
    return storageKey;
  }
  
  // If the storage key already has the new structure (starts with "users/")
  if (storageKey.startsWith('users/')) {
    const url = `/api/v1/storage/${encodeURIComponent(storageKey)}`;
    console.log(`[STORAGE-URL] Using new path structure, returning: ${url}`);
    return url;
  }
  
  // If it's using the projects/ prefix from old format, convert to the new format with users/default prefix
  if (storageKey.startsWith('projects/')) {
    // Extract the parts after 'projects/'
    const pathParts = storageKey.split('/');
    if (pathParts.length >= 5) { // Should be at least ['projects', projectId, 'scenes', sceneId, 'media', filename]
      // Reconstruct with new path format
      const mediaPath = pathParts.slice(4).join('/'); // Extract parts after sceneId
      const newPath = `users/default/projects/${projectId}/scenes/${sceneId}/${mediaPath}`;
      const url = `/api/v1/storage/${encodeURIComponent(newPath)}`;
      console.log(`[STORAGE-URL] Converted old projects/ path to new format: ${url}`);
      return url;
    }
  }
  
  // If it's just a filename and we have file type, construct new path
  if (fileType && !storageKey.includes('/')) {
    const newPath = `users/${userId}/projects/${projectId}/scenes/${sceneId}/${fileType}/${storageKey}`;
    const url = `/api/v1/storage/${encodeURIComponent(newPath)}`;
    console.log(`[STORAGE-URL] Constructed new path from filename: ${url}`);
    return url;
  }
  
  // Handle the case where storageKey is just a filename without file type
  if (!storageKey.includes('/')) {
    const newPath = `users/${userId}/projects/${projectId}/scenes/${sceneId}/media/${storageKey}`;
    const url = `/api/v1/storage/${encodeURIComponent(newPath)}`;
    console.log(`[STORAGE-URL] Constructed new path with default media type: ${url}`);
    return url;
  }
  
  // Otherwise, use the old path format for backward compatibility
  const url = `/api/v1/storage/users/${userId}/projects/${projectId}/scenes/${sceneId}/media/${storageKey}`;
  console.log(`[STORAGE-URL] Using constructed path with storage key: ${url}`);
  return url;
}; 