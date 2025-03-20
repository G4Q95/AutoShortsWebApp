import { renderHook, act } from '@testing-library/react-hooks';
import { useSceneMedia } from '../useSceneMedia';
import { Scene } from '@/components/project/ProjectTypes';

// Mock API functions
jest.mock('@/lib/api-client', () => ({
  getStoredAudio: jest.fn().mockResolvedValue({ data: { exists: false } }),
}));

describe('useSceneMedia', () => {
  const mockUpdateSceneMedia = jest.fn();
  const mockUpdateSceneAudio = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Create a minimal scene object for testing
  const createMockScene = (overrides = {}): Scene => ({
    id: 'scene-123',
    url: 'https://example.com/image.jpg',
    text: 'Test scene text',
    source: {
      platform: 'reddit',
      author: 'testuser',
      subreddit: 'test'
    },
    createdAt: Date.now(),
    ...overrides
  });
  
  test('should initialize with scene data', () => {
    // Create a mock scene with media data
    const mockScene = createMockScene({
      media: {
        type: 'image',
        url: 'https://example.com/stored-image.jpg',
        width: 800,
        height: 600
      }
    });
    
    // Render the hook with the mock scene
    const { result } = renderHook(() => 
      useSceneMedia(
        mockScene, 
        'project-123', 
        mockUpdateSceneMedia, 
        mockUpdateSceneAudio
      )
    );
    
    // Verify initial state matches scene data
    expect(result.current.mediaType).toBe('image');
    expect(result.current.mediaUrl).toBe('https://example.com/stored-image.jpg');
    expect(result.current.aspectRatio).toBe(800 / 600);
    expect(result.current.isLoading).toBe(false);
  });
  
  test('should update media metadata', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneMedia(
        mockScene, 
        'project-123', 
        mockUpdateSceneMedia, 
        mockUpdateSceneAudio
      )
    );
    
    // Call handleMediaMetadata
    act(() => {
      result.current.handleMediaMetadata(1200, 800, 'video');
    });
    
    // Verify state is updated
    expect(result.current.mediaType).toBe('video');
    expect(result.current.aspectRatio).toBe(1.5);
    expect(result.current.isLoading).toBe(false);
    
    // Verify updateSceneMedia was called with correct data
    expect(mockUpdateSceneMedia).toHaveBeenCalledWith('scene-123', {
      type: 'video',
      width: 1200,
      height: 800,
      contentType: 'video/mp4'
    });
  });
  
  test('should handle media errors', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneMedia(
        mockScene, 
        'project-123', 
        mockUpdateSceneMedia, 
        mockUpdateSceneAudio
      )
    );
    
    // Call handleMediaError
    act(() => {
      result.current.handleMediaError('Failed to load media');
    });
    
    // Verify error state is updated
    expect(result.current.mediaError).toBe('Failed to load media');
    expect(result.current.isLoading).toBe(false);
  });
  
  test('should handle scene with no media data', () => {
    const mockScene = createMockScene({
      url: 'https://example.com/post'
    });
    
    const { result } = renderHook(() => 
      useSceneMedia(
        mockScene, 
        'project-123', 
        mockUpdateSceneMedia, 
        mockUpdateSceneAudio
      )
    );
    
    expect(result.current.mediaUrl).toBe('https://example.com/post');
    expect(result.current.mediaType).toBe('unknown');
    expect(result.current.aspectRatio).toBeNull();
  });
}); 