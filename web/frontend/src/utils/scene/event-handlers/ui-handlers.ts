/**
 * UI-related event handlers for Scene component
 */

/**
 * Create a toggle view mode handler
 * @param setIsCompactView State setter for compact view
 * @returns Handler function for toggling view mode
 */
export const createToggleViewModeHandler = (
  setIsCompactView: React.Dispatch<React.SetStateAction<boolean>>
): (e: React.MouseEvent) => void => {
  return (e: React.MouseEvent) => {
    // Stop propagation to prevent triggering parent elements
    e.stopPropagation();
    
    // Toggle compact view state
    setIsCompactView(prev => {
      const newState = !prev;
      console.log(`[toggle-view-mode] Toggling view state from ${prev} to ${newState}`);
      return newState;
    });
  };
};

/**
 * Create a toggle info section handler
 * @param setShowInfo State setter for info section visibility
 * @returns Handler function for toggling info section
 */
export const createToggleInfoHandler = (
  setShowInfo: React.Dispatch<React.SetStateAction<boolean>>
): (e: React.MouseEvent) => void => {
  return (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(prev => !prev);
  };
};

/**
 * Handle scene removal with animation
 * @param sceneId ID of the scene to remove
 * @param isRemoving Current removing state
 * @param isRemovedRef Reference to track removed state
 * @param setIsRemoving State setter for removing state
 * @param setFadeOut State setter for fade animation
 * @param setManuallyRemoving State setter for manual removal
 * @param removingTimeoutRef Timeout reference for removal animation
 * @param onSceneRemove Callback to remove the scene
 */
export const handleRemoveScene = (
  sceneId: string,
  isRemoving: boolean,
  isRemovedRef: React.MutableRefObject<boolean>,
  setIsRemoving: (isRemoving: boolean) => void,
  setFadeOut: (fadeOut: boolean) => void,
  setManuallyRemoving: (manuallyRemoving: boolean) => void,
  removingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
  onSceneRemove: (id: string) => void
): void => {
  if (isRemoving || isRemovedRef.current) {
    console.log(`Already removing scene ${sceneId}, ignoring duplicate request`);
    return;
  }
  
  try {
    console.log(`Initiating removal for scene: ${sceneId}`);
    setIsRemoving(true);
    setFadeOut(true);
    
    // Start UI removal animation
    const sceneElement = document.getElementById(`scene-${sceneId}`);
    if (sceneElement) {
      sceneElement.style.transition = 'opacity 0.5s ease-out';
      sceneElement.style.opacity = '0.5';
    }
    
    // Call the actual removal function
    onSceneRemove(sceneId);
    
    // Set a backup timeout to forcibly remove component from UI
    removingTimeoutRef.current = setTimeout(() => {
      console.log(`Scene ${sceneId} removal timeout reached, forcing UI update`);
      setManuallyRemoving(true);
      isRemovedRef.current = true;
      
      // Fully hide the element
      if (sceneElement) {
        sceneElement.style.opacity = '0';
        sceneElement.style.height = '0';
        sceneElement.style.margin = '0';
        sceneElement.style.padding = '0';
        sceneElement.style.overflow = 'hidden';
      }
      
      // Check if component is still mounted after 3 seconds
      const checkMountTimeout = setTimeout(() => {
        const stillExists = document.getElementById(`scene-${sceneId}`);
        if (stillExists) {
          console.warn(`Scene ${sceneId} still in DOM after forced removal, resetting state`);
          setManuallyRemoving(false);
          setIsRemoving(false);
          setFadeOut(false);
          isRemovedRef.current = false;
          
          // Restore visibility
          if (stillExists) {
            stillExists.style.opacity = '1';
            stillExists.style.height = '';
            stillExists.style.margin = '';
            stillExists.style.padding = '';
            stillExists.style.overflow = '';
          }
        }
      }, 3000);

      return () => clearTimeout(checkMountTimeout);
    }, 2000);
  } catch (error) {
    console.error(`Error initiating scene removal for ${sceneId}:`, error);
    setIsRemoving(false);
    setFadeOut(false);
  }
};

/**
 * Create a function for retrying scene content loading
 * @param sceneId ID of the scene
 * @param sceneUrl URL of the scene content source
 * @param setIsRetrying State setter for retry state
 * @param onSceneReorder Function to trigger scene reordering/saving
 * @param index Scene index
 * @returns Function to handle retry
 */
export const createRetryHandler = (
  sceneId: string,
  sceneUrl: string | undefined,
  setIsRetrying: (isRetrying: boolean) => void,
  onSceneReorder: (sceneId: string, index: number) => void,
  index: number
): () => Promise<void> => {
  return async () => {
    if (!sceneUrl) return;

    setIsRetrying(true);
    try {
      await onSceneReorder(sceneId, index);
    } catch (error) {
      console.error('Failed to retry loading content:', error);
    } finally {
      setIsRetrying(false);
    }
  };
}; 