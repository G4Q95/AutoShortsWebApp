import { renderHook, act } from '@testing-library/react-hooks';
import { useSceneEdit } from '../useSceneEdit';
import { Scene } from '@/components/project/ProjectTypes';
import { getWordCount } from '@/utils/scene/event-handlers/text-handlers';

// Mock text handlers
jest.mock('@/utils/scene/event-handlers/text-handlers', () => ({
  getWordCount: jest.fn((text) => text.split(/\s+/).filter((word) => word.length > 0).length)
}));

describe('useSceneEdit', () => {
  const mockUpdateSceneText = jest.fn();
  const mockProjectId = 'project-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  // Create a minimal scene object for testing
  const createMockScene = (overrides = {}): Scene => ({
    id: 'scene-123',
    url: 'https://example.com/image.jpg',
    text: 'This is test text for the scene',
    source: {
      platform: 'reddit',
      author: 'testuser',
      subreddit: 'test'
    },
    createdAt: Date.now(),
    ...overrides
  });
  
  test('should initialize with scene text', () => {
    // Create a mock scene with text
    const mockScene = createMockScene();
    
    // Render the hook with the mock scene
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // Verify initial state matches text from scene
    expect(result.current.text).toBe('This is test text for the scene');
    expect(result.current.wordCount).toBe(7); // Based on mocked getWordCount
    expect(result.current.isEditing).toBe(false);
    expect(result.current.isDirty).toBe(false);
  });
  
  test('should handle text changes', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // Call handleTextChange
    act(() => {
      result.current.handleTextChange('Updated text content');
    });
    
    // Verify state is updated
    expect(result.current.text).toBe('Updated text content');
    expect(result.current.wordCount).toBe(3); // Based on mocked getWordCount
    expect(result.current.isDirty).toBe(true);
  });
  
  test('should save text changes', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // First make a change
    act(() => {
      result.current.handleTextChange('New text for saving');
    });
    
    // Then save the changes
    act(() => {
      result.current.handleSaveText();
    });
    
    // Verify updateSceneText was called with new text
    expect(mockUpdateSceneText).toHaveBeenCalledWith('scene-123', 'New text for saving');
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });
  
  test('should cancel editing and revert changes', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // First make a change
    act(() => {
      result.current.handleTextChange('Changed text that will be discarded');
    });
    
    // Then cancel the changes
    act(() => {
      result.current.handleCancelEdit();
    });
    
    // Verify text is reverted to original
    expect(result.current.text).toBe('This is test text for the scene');
    expect(result.current.wordCount).toBe(7); // Original word count
    expect(result.current.isDirty).toBe(false);
    expect(result.current.isEditing).toBe(false);
    
    // Verify updateSceneText was not called
    expect(mockUpdateSceneText).not.toHaveBeenCalled();
  });
  
  test('should toggle info visibility', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // Initial state should be false
    expect(result.current.isInfoVisible).toBe(false);
    
    // Toggle info visibility
    act(() => {
      result.current.toggleInfo();
    });
    
    // Should be true after toggle
    expect(result.current.isInfoVisible).toBe(true);
    
    // Toggle info visibility again
    act(() => {
      result.current.toggleInfo();
    });
    
    // Should be false after second toggle
    expect(result.current.isInfoVisible).toBe(false);
  });
  
  test('should handle keydown events', () => {
    const mockScene = createMockScene();
    
    const { result } = renderHook(() => 
      useSceneEdit(
        mockScene, 
        mockProjectId, 
        mockUpdateSceneText
      )
    );
    
    // Mock KeyboardEvent for Enter + Ctrl
    const mockEnterCtrlEvent = {
      key: 'Enter',
      ctrlKey: true,
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;
    
    // Mock KeyboardEvent for Escape
    const mockEscapeEvent = {
      key: 'Escape',
      preventDefault: jest.fn()
    } as unknown as React.KeyboardEvent;
    
    // First make a change to enable saving
    act(() => {
      result.current.handleTextChange('Text to be saved with Ctrl+Enter');
    });
    
    // Save with Ctrl+Enter
    act(() => {
      result.current.handleKeyDown(mockEnterCtrlEvent);
    });
    
    // Verify save was called
    expect(mockUpdateSceneText).toHaveBeenCalledWith('scene-123', 'Text to be saved with Ctrl+Enter');
    expect(mockEnterCtrlEvent.preventDefault).toHaveBeenCalled();
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Make another change
    act(() => {
      result.current.handleTextChange('Text to be discarded with Escape');
    });
    
    // Cancel with Escape
    act(() => {
      result.current.handleKeyDown(mockEscapeEvent);
    });
    
    // Verify text reverted and save not called
    expect(result.current.text).toBe('This is test text for the scene');
    expect(mockEscapeEvent.preventDefault).toHaveBeenCalled();
    expect(mockUpdateSceneText).not.toHaveBeenCalled();
  });
}); 