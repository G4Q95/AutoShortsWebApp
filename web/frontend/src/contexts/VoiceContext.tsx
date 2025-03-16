'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

/**
 * Interface describing a voice option
 * @property id - Unique identifier for the voice
 * @property name - Display name of the voice
 */
interface Voice {
  id: string;
  name: string;
}

/**
 * Interface describing the VoiceContext API
 * @property voices - Array of available voice options
 * @property selectedVoice - Currently selected voice ID
 * @property setSelectedVoice - Function to update the selected voice
 */
interface VoiceContextType {
  voices: Voice[];
  selectedVoice: string;
  setSelectedVoice: (voiceId: string) => void;
}

/**
 * VoiceContext provides global state management for voice selection.
 * This ensures consistency in voice preferences across the application.
 */
const VoiceContext = createContext<VoiceContextType>({
  voices: [],
  selectedVoice: '',
  setSelectedVoice: () => {}
});

/**
 * VoiceProvider component that wraps the application and provides voice selection state.
 * This component maintains the list of available voices and the currently selected voice.
 * 
 * @param children - React children to be wrapped by the provider
 */
export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Sample voices - in a real app, these would come from an API
  const [voices, setVoices] = useState<Voice[]>([
    { id: 'aria', name: 'Aria' },
    { id: 'daniel', name: 'Daniel' },
    { id: 'sarah', name: 'Sarah' },
    { id: 'james', name: 'James' }
  ]);
  
  const [selectedVoice, setSelectedVoice] = useState<string>('aria');

  /**
   * In a production implementation, we would fetch voices from an API endpoint.
   * This commented code shows how that might be implemented.
   */
  // useEffect(() => {
  //   const fetchVoices = async () => {
  //     try {
  //       const response = await fetch('/api/voices');
  //       const data = await response.json();
  //       setVoices(data.voices);
  //       if (data.voices.length > 0 && !selectedVoice) {
  //         setSelectedVoice(data.voices[0].id);
  //       }
  //     } catch (error) {
  //       console.error('Error fetching voices:', error);
  //     }
  //   };
  //   
  //   fetchVoices();
  // }, []);

  return (
    <VoiceContext.Provider value={{ voices, selectedVoice, setSelectedVoice }}>
      {children}
    </VoiceContext.Provider>
  );
};

/**
 * Custom hook to access the VoiceContext.
 * Use this hook to access and update voice selection state.
 * 
 * @returns VoiceContextType with voices array, selected voice, and method to update selection
 * @example
 * const { voices, selectedVoice, setSelectedVoice } = useVoiceContext();
 */
export const useVoiceContext = () => useContext(VoiceContext); 