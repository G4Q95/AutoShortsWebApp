/**
 * Text-related event handlers for Scene component
 */

/**
 * Clean Reddit post text by removing common artifacts
 * @param text Original post text from Reddit
 * @returns Cleaned text
 */
export const cleanPostText = (text: string): string => {
  if (!text) return '';
  
  // Remove common Reddit artifacts and source information
  const cleaned = text
    .replace(/\[removed\]/g, '')
    .replace(/\[deleted\]/g, '')
    // Remove "Post by u/username: " prefix that's added by the backend
    .replace(/^Post by u\/[^:]+:\s*/i, '')
    .trim();
  
  return cleaned;
};

/**
 * Count the number of words in a text string
 * @param text Text to count words in
 * @returns Number of words
 */
export const getWordCount = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

/**
 * Calculate the speaking duration based on word count
 * Uses an average speaking rate of 150 words per minute
 * @param text Text to calculate duration for
 * @returns Estimated duration in seconds
 */
export const calculateSpeakingDuration = (text: string): number => {
  const wordCount = getWordCount(text);
  const wordsPerMinute = 150; // Average speaking rate
  const durationInMinutes = wordCount / wordsPerMinute;
  return durationInMinutes * 60; // Convert to seconds
};

/**
 * Create save text handler function
 * @param sceneId ID of the scene being edited
 * @param text Current text value
 * @param originalText Original text from the scene
 * @param updateSceneText Function to update text in the scene
 * @param onSceneReorder Function to trigger scene reordering/saving
 * @param index Scene index
 * @param setIsEditing State setter for editing mode
 * @returns Function to save the text
 */
export const createSaveTextHandler = (
  sceneId: string,
  text: string,
  originalText: string,
  updateSceneText: (sceneId: string, text: string) => void,
  onSceneReorder: (sceneId: string, index: number) => void,
  index: number,
  setIsEditing: (isEditing: boolean) => void
): () => void => {
  return () => {
    // Clean the original text for comparison
    const cleanedOriginal = cleanPostText(originalText);
    
    // Only save if text has changed
    if (text !== cleanedOriginal) {
      // Update the scene text in the project provider
      updateSceneText(sceneId, text);
      
      // Trigger a reorder (save) of the project
      onSceneReorder(sceneId, index);
    }
    
    // Exit editing mode
    setIsEditing(false);
  };
};

/**
 * Generate text change handler function
 * @param setText State setter for text value
 * @returns Function to handle text change events
 */
export const createTextChangeHandler = (
  setText: (text: string) => void
): (e: React.ChangeEvent<HTMLTextAreaElement>) => void => {
  return (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };
}; 