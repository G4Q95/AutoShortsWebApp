import { 
  getAvailableVoices, 
  getVoiceById, 
  generateVoice, 
  generateVoiceAudio,
  persistVoiceAudio,
  getStoredAudio
} from '../voice';
import { fetchAPI } from '../../api-client';
import { GenerateVoiceRequest } from '../../api-types';

// Mock fetchAPI to control its behavior in tests
jest.mock('../../api-client', () => ({
  fetchAPI: jest.fn()
}));

// Mock console.log to prevent logs during tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Voice API Module', () => {
  describe('getAvailableVoices', () => {
    it('should fetch available voices successfully', async () => {
      const mockVoices = { voices: [{ id: 'voice1', name: 'Voice 1' }] };
      
      // Mock successful response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: mockVoices,
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const result = await getAvailableVoices();
      
      expect(fetchAPI).toHaveBeenCalledWith('/voice/available', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 15000
      });
      
      expect(result).toEqual({
        data: mockVoices,
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
    });
    
    it('should handle error responses', async () => {
      const mockError = { status: 500, message: 'Server error' };
      
      // Mock error response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: mockError,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const result = await getAvailableVoices();
      
      expect(result.error).toEqual(mockError);
    });
  });
  
  describe('getVoiceById', () => {
    it('should fetch a voice by ID successfully', async () => {
      const mockVoice = { id: 'voice1', name: 'Voice 1' };
      
      // Mock successful response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: mockVoice,
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const result = await getVoiceById('voice1');
      
      expect(fetchAPI).toHaveBeenCalledWith('/voice/voice1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      expect(result.data).toEqual(mockVoice);
    });
  });
  
  describe('generateVoice', () => {
    it('should generate voice audio successfully', async () => {
      // Mock a base64 audio string
      const mockAudioData = 'base64AudioString';
      
      // Mock successful response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: { 
          audio_base64: mockAudioData,
          content_type: 'audio/mp3',
          character_count: 100,
          processing_time: 1.5
        },
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const mockParams: GenerateVoiceRequest = {
        text: 'Test text',
        voice_id: 'voice1',
        stability: 0.5,
        similarity_boost: 0.5
      };
      
      const result = await generateVoice(mockParams);
      
      expect(fetchAPI).toHaveBeenCalledWith('/voice/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockParams),
        timeout: 30000
      });
      
      expect(result.data.audio_base64).toEqual(mockAudioData);
    });
    
    it('should handle mock mode when NEXT_PUBLIC_MOCK_AUDIO is true', async () => {
      // Save original env
      const originalEnv = process.env.NEXT_PUBLIC_MOCK_AUDIO;
      
      try {
        // Set mock audio to true
        process.env.NEXT_PUBLIC_MOCK_AUDIO = 'true';
        
        const mockParams: GenerateVoiceRequest = {
          text: 'Test text',
          voice_id: 'voice1',
          stability: 0.5,
          similarity_boost: 0.5
        };
        
        const result = await generateVoice(mockParams);
        
        // Should not call fetchAPI in mock mode
        expect(fetchAPI).not.toHaveBeenCalled();
        
        // Should return mock audio
        expect(result.data.audio_base64).toBeTruthy();
        expect(result.error).toBeNull();
      } finally {
        // Restore original env
        process.env.NEXT_PUBLIC_MOCK_AUDIO = originalEnv;
      }
    });
  });
  
  describe('generateVoiceAudio', () => {
    it('should create an audio element from base64 data', async () => {
      // Mock the Audio constructor
      const mockAudio = {};
      global.Audio = jest.fn(() => mockAudio) as any;
      global.URL.createObjectURL = jest.fn(() => 'blob:url');
      
      const mockRequest: GenerateVoiceRequest = {
        text: 'Test text',
        voice_id: 'voice1',
        stability: 0.5,
        similarity_boost: 0.5
      };
      
      const result = await generateVoiceAudio(mockRequest);
      
      expect(result.audio).toBe(mockAudio);
      expect(result.error).toBeNull();
    });
  });
  
  describe('persistVoiceAudio', () => {
    it('should persist voice audio successfully', async () => {
      // Mock successful response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: { success: true, url: 'stored-audio-url' },
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const audioData = {
        audio_base64: 'base64AudioString',
        text: 'Test text',
        voice_id: 'voice1',
        settings: { stability: 0.5, similarity_boost: 0.5 }
      };
      
      const result = await persistVoiceAudio({
        project_id: 'project1',
        scene_id: 'scene1',
        audio_base64: audioData.audio_base64,
        content_type: 'audio/mp3',
        voice_id: audioData.voice_id
      });
      
      expect(fetchAPI).toHaveBeenCalledWith('/audio/persist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: 'project1',
          scene_id: 'scene1',
          audio_base64: audioData.audio_base64,
          content_type: 'audio/mp3',
          voice_id: audioData.voice_id
        })
      });
      
      expect(result.data.success).toBe(true);
    });
  });
  
  describe('getStoredAudio', () => {
    it('should retrieve stored audio successfully', async () => {
      // Mock successful response
      (fetchAPI as jest.Mock).mockResolvedValueOnce({
        data: { 
          url: 'stored-audio-url',
          voiceSettings: { voiceId: 'voice1', settings: { stability: 0.5 } }
        },
        error: null,
        timing: { duration: 100 },
        connectionInfo: { region: 'test' }
      });
      
      const result = await getStoredAudio('project1', 'scene1');
      
      expect(fetchAPI).toHaveBeenCalledWith('/audio/project1/scene1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      expect(result.data.url).toBe('stored-audio-url');
    });
  });
}); 