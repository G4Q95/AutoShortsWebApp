/**
 * @jest-environment jsdom
 */

import { extractContent, validateUrl } from '../content';
import { fetchAPI } from '../../api-client';

// Mock the fetchAPI function
jest.mock('../../api-client', () => ({
  fetchAPI: jest.fn(),
}));

describe('Content API Module', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('extractContent', () => {
    test('successfully extracts content from URL', async () => {
      // Setup mock response
      const mockResponse = {
        data: {
          title: 'Test Title',
          text: 'Test content text',
          media: { type: 'image', url: 'https://example.com/image.jpg' },
          source: 'reddit',
        },
        error: undefined,
        timing: { start: 1000, end: 1100, duration: 100 },
        connectionInfo: { 
          success: true, 
          server: 'test-server',
          status: 200,
          statusText: 'OK'
        },
      };

      // Mock the fetchAPI implementation
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      // Call the function
      const result = await extractContent('https://www.reddit.com/r/test/123');

      // Check fetchAPI was called with correct parameters
      expect(fetchAPI).toHaveBeenCalledWith(
        '/content/extract',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.reddit.com/r/test/123' }),
        },
        30000 // 30 second timeout
      );

      // Check the response matches the mock
      expect(result).toEqual(mockResponse);
    });

    test('handles errors during content extraction', async () => {
      // Mock the fetchAPI implementation to throw an error
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Call the function
      const result = await extractContent('https://www.reddit.com/r/test/123');

      // Check the response contains the correct error format
      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error?.status_code).toBe(500);
      expect(result.error?.message).toBe('Network error');
      expect(result.error?.error_code).toBe('CONTENT_EXTRACTION_ERROR');
      
      // Check timing and connection info are present
      expect(result.timing).toBeDefined();
      expect(result.connectionInfo).toBeDefined();
      expect(result.connectionInfo.success).toBe(false);
    });
  });

  describe('validateUrl', () => {
    test('successfully validates URL', async () => {
      // Setup mock response
      const mockResponse = {
        data: { valid: true },
        error: undefined,
        timing: { start: 1000, end: 1100, duration: 100 },
        connectionInfo: { 
          success: true, 
          server: 'test-server',
          status: 200,
          statusText: 'OK'
        },
      };

      // Mock the fetchAPI implementation
      (fetchAPI as jest.Mock).mockResolvedValue(mockResponse);

      // Call the function
      const result = await validateUrl('https://www.reddit.com/r/test/123');

      // Check fetchAPI was called with correct parameters
      expect(fetchAPI).toHaveBeenCalledWith(
        '/content/validate-url',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.reddit.com/r/test/123' }),
        }
      );

      // Check the response matches the mock
      expect(result).toEqual(mockResponse);
    });

    test('handles errors during URL validation', async () => {
      // Mock the fetchAPI implementation to throw an error
      (fetchAPI as jest.Mock).mockRejectedValue(new Error('Network error'));

      // Call the function
      const result = await validateUrl('https://www.reddit.com/r/test/123');

      // Check the response contains the correct data and error format
      expect(result.data).toEqual({ valid: false, message: 'URL validation failed' });
      expect(result.error).toBeDefined();
      expect(result.error?.status_code).toBe(500);
      expect(result.error?.message).toBe('Network error');
      expect(result.error?.error_code).toBe('URL_VALIDATION_ERROR');
      
      // Check timing and connection info are present
      expect(result.timing).toBeDefined();
      expect(result.connectionInfo).toBeDefined();
      expect(result.connectionInfo.success).toBe(false);
    });
  });
}); 