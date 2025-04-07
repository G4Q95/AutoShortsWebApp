import { useState, useCallback } from 'react';

/**
 * Configuration hook for VideoContextBridge
 * 
 * This allows us to toggle between implementations for testing
 */
export function useBridgeConfig() {
  // Feature flag for bridge implementation
  const [useNewBridge, setUseNewBridge] = useState<boolean>(false);
  
  // Toggle function
  const toggleBridgeImplementation = useCallback(() => {
    setUseNewBridge(prev => !prev);
  }, []);
  
  // Get current state as a string for debugging
  const currentImplementation = useNewBridge ? 'new' : 'legacy';
  
  return {
    useNewBridge,
    toggleBridgeImplementation,
    currentImplementation
  };
}

export default useBridgeConfig; 