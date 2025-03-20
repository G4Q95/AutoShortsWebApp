import { renderHook, act } from '@testing-library/react-hooks';
import { useSceneAudio } from '../useSceneAudio';
import { Scene } from '@/components/project/ProjectTypes';
import { getAvailableVoices, generateVoice, persistVoiceAudio } from '@/lib/api-client';

// Mock API functions
jest.mock('@/lib/api-client', () => ({
  getAvailableVoices: jest.fn(),
  generateVoice: jest.fn(),
  persistVoiceAudio: jest.fn(),
}));

// Mock togglePlayPause
jest.mock('@/utils/scene/event-handlers/audio-handlers', () => ({
  togglePlayPause: jest.fn((audio, setPlaying) => setPlaying(true)),
  base64ToBlob: jest.fn(() => new Blob(['mock-audio-data'], { type: 'audio/mp3' }))
}));

// Mock URL.createObjectURL
const mockObjectURL = 'blob:mock-url';
URL.createObjectURL = jest.fn(() => mockObjectURL);
URL.revokeObjectURL = jest.fn();

describe('useSceneAudio', () => {
  const mockUpdateSceneAudio = jest.fn();
  const mockText = 'This is test text for voice generation';
  const mockProjectId = 'project-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
    (getAvailableVoices as jest.Mock).mockResolvedValue({
      data: {
        voices: [
          { voice_id: 'voice-1', name: 'Voice 1' },
          { voice_id: 'voice-2', name: 'Voice 2' }
        ]
      }
    });
    (generateVoice as jest.Mock).mockResolvedValue({
      data: {
        audio_base64: 'mock-base64-audio',
        character_count: 50
      }
    });
    (persistVoiceAudio as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        url: 'https://storage.example.com/audio.mp3',
        storage_key: 'projects/project-123/scenes/scene-123/audio.mp3'
      }
    });
  });
  
  // Create a minimal scene object for testing
  const createMockScene = (overrides = {}): Scene => ({
    id: 'scene-123',
    url: 'https://example.com/image.jpg',
    text: mockText,
    source: {
      platform: 'reddit',
      author: 'testuser',
      subreddit: 'test'
    },
    createdAt: Date.now(),
    ...overrides
  });
  
  test('should initialize with scene voice settings', () => {
    // Create a mock scene with voice settings
    const mockScene = createMockScene({
      voice_settings: {
        voice_id: 'test-voice-id',
        stability: 0.6,
        similarity_boost: 0.8,
        style: 1,
        speaker_boost: true,
        speed: 1.2
      }
    });
    
    // Render the hook with the mock scene
    const { result } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    // Verify initial state matches voice settings
    expect(result.current.voiceId).toBe('test-voice-id');
    expect(result.current.stability).toBe(0.6);
    expect(result.current.similarityBoost).toBe(0.8);
    expect(result.current.style).toBe(1);
    expect(result.current.speakerBoost).toBe(true);
    expect(result.current.speed).toBe(1.2);
  });
  
  test('should fetch voices on initialization', async () => {
    const mockScene = createMockScene();
    
    const { waitForNextUpdate } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    await waitForNextUpdate();
    
    expect(getAvailableVoices).toHaveBeenCalled();
  });
  
  test('should handle voice generation', async () => {
    const mockScene = createMockScene({
      voice_settings: {
        voice_id: 'test-voice-id',
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speaker_boost: false,
        speed: 1.0
      }
    });
    
    const { result, waitForNextUpdate } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    await waitForNextUpdate();
    
    // Call handleGenerateVoice
    await act(async () => {
      await result.current.handleGenerateVoice();
    });
    
    // Verify generateVoice was called with correct parameters
    expect(generateVoice).toHaveBeenCalledWith({
      text: mockText,
      voice_id: 'test-voice-id',
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: false,
      output_format: 'mp3_44100_128',
      speed: 1.0
    });
    
    // Verify updateSceneAudio was called with audio data and voice settings
    expect(mockUpdateSceneAudio).toHaveBeenCalledWith(
      'scene-123',
      expect.objectContaining({
        audio_base64: 'mock-base64-audio',
        content_type: 'audio/mp3',
        audio_url: mockObjectURL,
        generated_at: expect.any(Number),
        character_count: 50
      }),
      expect.objectContaining({
        voice_id: 'test-voice-id',
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0,
        speaker_boost: false,
        speed: 1.0
      })
    );
    
    // Verify audio was persisted to storage
    expect(persistVoiceAudio).toHaveBeenCalledWith({
      audio_base64: 'mock-base64-audio',
      content_type: 'audio/mp3',
      project_id: mockProjectId,
      scene_id: 'scene-123',
      voice_id: 'test-voice-id'
    });
  });
  
  test('should toggle audio playback', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    // Mock HTMLAudioElement
    const mockAudio = {
      play: jest.fn(),
      pause: jest.fn()
    } as unknown as HTMLAudioElement;
    
    // Update the ref to use our mock audio element
    Object.defineProperty(result.current.audioRef, 'current', {
      value: mockAudio,
      writable: true
    });
    
    // Call handlePlayPauseToggle
    act(() => {
      result.current.handlePlayPauseToggle();
    });
    
    // Verify togglePlayPause was called
    expect(require('@/utils/scene/event-handlers/audio-handlers').togglePlayPause).toHaveBeenCalledWith(
      mockAudio,
      expect.any(Function)
    );
    
    // Verify isPlaying was updated (the mock togglePlayPause sets it to true)
    expect(result.current.isPlaying).toBe(true);
  });
  
  test('should update playback speed', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    // Mock HTMLAudioElement with playbackRate property
    const mockAudio = {
      playbackRate: 1.0
    } as unknown as HTMLAudioElement;
    
    // Update the ref to use our mock audio element
    Object.defineProperty(result.current.audioRef, 'current', {
      value: mockAudio,
      writable: true
    });
    
    // Call handlePlaybackSpeedChange
    act(() => {
      result.current.handlePlaybackSpeedChange(1.5);
    });
    
    // Verify playback speed was updated
    expect(result.current.playbackSpeed).toBe(1.5);
    expect(mockAudio.playbackRate).toBe(1.5);
  });
  
  test('should toggle settings', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneAudio(
        mockScene, 
        mockText,
        mockProjectId, 
        mockUpdateSceneAudio
      )
    );
    
    // Initial state should be false
    expect(result.current.showSettings).toBe(false);
    
    // Toggle settings
    act(() => {
      result.current.toggleSettings();
    });
    
    // Should be true after toggle
    expect(result.current.showSettings).toBe(true);
    
    // Toggle settings again
    act(() => {
      result.current.toggleSettings();
    });
    
    // Should be false after second toggle
    expect(result.current.showSettings).toBe(false);
  });
}); 