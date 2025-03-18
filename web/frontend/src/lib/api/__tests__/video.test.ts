/**
 * @jest-environment jsdom
 */

import { createVideo, getVideoCreationStatus, cancelVideoCreation } from '../video';
import { fetchAPI } from '../../api-client';

// Mock api-client fetchAPI function
jest.mock('../../api-client', () => ({
  fetchAPI: jest.fn()
}));

describe('Video API Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.console = {
      ...global.console,
      log: jest.fn(),
      error: jest.fn()
    };
  });

  describe('createVideo', () => {
    it('validates required parameters', async () => {
      // Source URL missing
      const result1 = await createVideo('', 'Test Title');
      expect(result1.error).toBeDefined();
      expect(result1.error?.message).toContain('Source URL is required');
      expect(result1.error?.status_code).toBe(400);
      
      // Title missing
      const result2 = await createVideo('https://example.com', '');
      expect(result2.error).toBeDefined();
      expect(result2.error?.message).toContain('Title is required');
      expect(result2.error?.status_code).toBe(400);
    });

    it('validates URL format', async () => {
      const result = await createVideo('invalid-url', 'Test Title');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid URL format');
      expect(result.error?.status_code).toBe(400);
    });

    it('validates title length', async () => {
      // Title too short
      const result1 = await createVideo('https://example.com', 'AB');
      expect(result1.error).toBeDefined();
      expect(result1.error?.message).toContain('at least 3 characters');
      expect(result1.error?.status_code).toBe(400);
      
      // Title too long
      const longTitle = 'A'.repeat(101);
      const result2 = await createVideo('https://example.com', longTitle);
      expect(result2.error).toBeDefined();
      expect(result2.error?.message).toContain('must not exceed');
      expect(result2.error?.status_code).toBe(400);
    });

    it('validates text style', async () => {
      const result = await createVideo('https://example.com', 'Test Title', 'default', 'invalid-style');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Text style must be one of');
      expect(result.error?.status_code).toBe(400);
    });

    it('calls fetchAPI with correct parameters on valid input', async () => {
      (fetchAPI as jest.Mock).mockResolvedValue({
        data: { videoId: 'video123', status: 'processing' },
        error: undefined
      });

      const result = await createVideo(
        'https://example.com',
        'Test Title',
        'voice123',
        'engaging'
      );

      expect(fetchAPI).toHaveBeenCalledWith(
        '/video-creation/create',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source_url: 'https://example.com',
            title: 'Test Title',
            voice_id: 'voice123',
            text_style: 'engaging'
          })
        },
        30000
      );

      expect(result.data).toEqual({ videoId: 'video123', status: 'processing' });
      expect(result.error).toBeUndefined();
    });
  });

  describe('getVideoCreationStatus', () => {
    it('validates taskId parameter', async () => {
      const result = await getVideoCreationStatus('');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Task ID is required');
      expect(result.error?.status_code).toBe(400);
    });

    it('calls fetchAPI with correct parameters on valid input', async () => {
      (fetchAPI as jest.Mock).mockResolvedValue({
        data: { videoId: 'video123', status: 'processing', progress: 65 },
        error: undefined
      });

      const result = await getVideoCreationStatus('task123');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/video-creation/status/task123'
      );

      expect(result.data).toEqual({ videoId: 'video123', status: 'processing', progress: 65 });
      expect(result.error).toBeUndefined();
    });
  });

  describe('cancelVideoCreation', () => {
    it('validates taskId parameter', async () => {
      const result = await cancelVideoCreation('');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Task ID is required');
      expect(result.error?.status_code).toBe(400);
    });

    it('calls fetchAPI with correct parameters on valid input', async () => {
      (fetchAPI as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: undefined
      });

      const result = await cancelVideoCreation('task123');

      expect(fetchAPI).toHaveBeenCalledWith(
        '/video-creation/cancel/task123',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }
      );

      expect(result.data).toEqual({ success: true });
      expect(result.error).toBeUndefined();
    });
  });
}); 