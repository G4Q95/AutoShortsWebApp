'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAvailableVoices } from '@/lib/api-client';

/**
 * Interface describing a voice option
 */
interface VoiceOption {
  voice_id: string;
  name: string;
  category?: string;
  description?: string | null;
  preview_url?: string;
  labels?: Record<string, string>;
}

/**
 * Interface describing the VoiceContext API
 */
interface VoiceContextType {
  voices: VoiceOption[];
  isLoading: boolean;
  error: string | null;
  selectedVoiceId: string;
  setSelectedVoiceId: (voiceId: string) => void;
  refreshVoices: () => Promise<void>;
  lastFetchTime: number | null;
}

/**
 * VoiceContext provides global state management for voice selection.
 * This ensures consistency in voice preferences across the application.
 */
const VoiceContext = createContext<VoiceContextType>({
  voices: [],
  isLoading: false,
  error: null,
  selectedVoiceId: '',
  setSelectedVoiceId: () => {},
  refreshVoices: async () => {},
  lastFetchTime: null
});

// Cache time in milliseconds (5 minutes)
const CACHE_TIME = 5 * 60 * 1000;

/**
 * VoiceProvider component that wraps the application and provides voice selection state.
 * This component maintains the list of available voices and the currently selected voice.
 * 
 * @param children - React children to be wrapped by the provider
 */
export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  
  // Fetch voices from API on initial load
  useEffect(() => {
    fetchVoices();
  }, []);
  
  // Function to fetch voices from the API
  const fetchVoices = async () => {
    // Skip if we're already loading or if data was fetched recently
    if (isLoading || (lastFetchTime && Date.now() - lastFetchTime < CACHE_TIME && voices.length > 0)) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getAvailableVoices();
      
      if (response.error) {
        setError(`Error fetching voices: ${response.error.message}`);
      } else if (response.data && response.data.voices) {
        setVoices(response.data.voices);
        setLastFetchTime(Date.now());
        
        // Set default voice if none selected
        if (response.data.voices.length > 0 && !selectedVoiceId) {
          setSelectedVoiceId(response.data.voices[0].voice_id);
        }
      }
    } catch (err) {
      setError(`Error fetching voices: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the context value
  const contextValue: VoiceContextType = {
    voices,
    isLoading,
    error,
    selectedVoiceId,
    setSelectedVoiceId,
    refreshVoices: fetchVoices,
    lastFetchTime
  };

  return (
    <VoiceContext.Provider value={contextValue}>
      {children}
    </VoiceContext.Provider>
  );
};

/**
 * Custom hook to access the VoiceContext.
 * Use this hook to access and update voice selection state.
 * 
 * @returns VoiceContextType with voices array, loading state, selected voice, and methods
 * @example
 * const { voices, isLoading, selectedVoiceId, setSelectedVoiceId } = useVoiceContext();
 */
export const useVoiceContext = () => useContext(VoiceContext); 