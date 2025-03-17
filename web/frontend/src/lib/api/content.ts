/**
 * @fileoverview Content extraction API module
 * 
 * This module provides functions for extracting content from various sources,
 * primarily handling URL-based content retrieval.
 */

import { fetchAPI } from '../api-client';
import type { ApiResponse } from '../api-types';

/**
 * Extract content from a URL
 * 
 * This function fetches content from a provided URL, including text,
 * media, and metadata. It supports various sources like Reddit.
 * 
 * @param url - The URL to extract content from
 * @returns ApiResponse containing the extracted content
 */
export async function extractContent(url: string): Promise<ApiResponse<any>> {
  try {
    // Extended timeout for content extraction (30 seconds)
    const response = await fetchAPI<any>(
      '/content/extract',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      },
      30000 // 30 second timeout for content extraction
    );

    return response;
  } catch (error: any) {
    console.error('Error extracting content:', error);
    return {
      data: null,
      error: {
        status_code: 500,
        message: error.message || 'Failed to extract content',
        error_code: 'CONTENT_EXTRACTION_ERROR',
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0,
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 500,
        statusText: 'Error',
      },
    };
  }
}

/**
 * Validate a URL before extraction
 * 
 * This function checks if a URL is valid and supported for content extraction.
 * 
 * @param url - The URL to validate
 * @returns ApiResponse indicating if the URL is valid
 */
export async function validateUrl(url: string): Promise<ApiResponse<{valid: boolean, message?: string}>> {
  try {
    const response = await fetchAPI<{valid: boolean, message?: string}>(
      '/content/validate-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      }
    );

    return response;
  } catch (error: any) {
    console.error('Error validating URL:', error);
    return {
      data: { valid: false, message: 'URL validation failed' },
      error: {
        status_code: 500,
        message: error.message || 'Failed to validate URL',
        error_code: 'URL_VALIDATION_ERROR',
      },
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0,
      },
      connectionInfo: {
        success: false,
        server: '',
        status: 500,
        statusText: 'Error',
      },
    };
  }
} 