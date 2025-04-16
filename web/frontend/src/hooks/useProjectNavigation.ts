import { useState, useCallback, useEffect, Dispatch } from 'react';

// Define the possible UI modes
export type UIMode = 'organization' | 'voice-enabled' | 'preview';

// Define the reducer action type for SET_MODE
export interface SetModeAction {
  type: 'SET_MODE';
  payload: { mode: UIMode };
}

// Define the shape of the hook's return value
export interface UseProjectNavigationReturn {
  uiMode: UIMode;
  setMode: (mode: UIMode) => void;
  nextMode: () => void;
  previousMode: () => void;
}

/**
 * Custom hook to manage the UI navigation state within the project editor.
 * Handles transitions between different stages like organization, voice editing, and preview.
 * Can optionally sync with a reducer state via dispatch function.
 *
 * @param {Dispatch<SetModeAction>} [dispatch] - Optional dispatch function to sync with reducer
 * @param {UIMode} [initialMode='organization'] - Initial UI mode
 * @returns {UseProjectNavigationReturn} An object containing the current UI mode and functions to change it.
 */
export function useProjectNavigation(
  dispatch?: Dispatch<SetModeAction>,
  initialMode: UIMode = 'organization'
): UseProjectNavigationReturn {
  // Initialize the UI mode state
  const [uiMode, setUiMode] = useState<UIMode>(initialMode);

  // Set the UI mode directly
  const setMode = useCallback((mode: UIMode) => {
    console.log(`Setting UI mode to: ${mode}`);
    setUiMode(mode);
    
    // If dispatch is provided, also update the reducer state
    if (dispatch) {
      dispatch({ type: 'SET_MODE', payload: { mode } });
    }
  }, [dispatch]);

  // Progress to the next UI mode
  const nextMode = useCallback(() => {
    setUiMode(currentMode => {
      const nextMode = currentMode === 'organization' 
        ? 'voice-enabled' 
        : currentMode === 'voice-enabled' 
          ? 'preview' 
          : 'organization';
          
      // If dispatch is provided, also update the reducer state
      if (dispatch) {
        dispatch({ type: 'SET_MODE', payload: { mode: nextMode } });
      }
      
      return nextMode;
    });
  }, [dispatch]);

  // Return to the previous UI mode
  const previousMode = useCallback(() => {
    setUiMode(currentMode => {
      const prevMode = currentMode === 'preview' 
        ? 'voice-enabled' 
        : currentMode === 'voice-enabled' 
          ? 'organization' 
          : 'preview';
          
      // If dispatch is provided, also update the reducer state
      if (dispatch) {
        dispatch({ type: 'SET_MODE', payload: { mode: prevMode } });
      }
      
      return prevMode;
    });
  }, [dispatch]);

  return {
    uiMode,
    setMode,
    nextMode,
    previousMode,
  };
} 