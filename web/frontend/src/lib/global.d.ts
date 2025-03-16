/**
 * Global type declarations for the application
 */

// Extend the window interface for our mock audio testing
interface Window {
  USE_MOCK_AUDIO?: boolean;
  __MOCK_AUDIO_ENABLED?: boolean;
  NEXT_PUBLIC_MOCK_AUDIO?: string;
  __checkMockAudio?: () => {
    useMockAudio: boolean | undefined;
    mockAudioEnabled: boolean | undefined;
    envVar: string | undefined;
  };
}

// Add any other global type declarations here 