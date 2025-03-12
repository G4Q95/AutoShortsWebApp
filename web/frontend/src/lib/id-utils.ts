/**
 * Generates a unique random ID string.
 * Uses a combination of two random numbers converted to base 36 strings.
 * The resulting string is approximately 20-24 characters long.
 * 
 * @returns {string} A unique random ID string
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}; 