/**
 * @fileoverview Content extraction API client for interacting with the backend
 * 
 * This module provides functions for content extraction and manipulation:
 * - Extracting content from URLs
 * - Rewriting and summarizing text
 * - Processing media content
 */

import { fetchAPI } from './core';
import { ApiResponse } from '../api-types';

/**
 * Extract content from a URL
 * 
 * @param {string} url - URL to extract content from
 * @returns {Promise<ApiResponse<any>>} Promise with extracted content
 */
export async function extractContent(url: string): Promise<ApiResponse<any>> {
  // Use a longer timeout for content extraction (20 seconds)
  return fetchAPI<any>(
    '/content/extract',
    {
      method: 'POST',
      body: JSON.stringify({ url }),
    },
    20000 // 20 second timeout
  );
}

/**
 * Rewrite text in a specific style
 * 
 * @param {string} text - Text to rewrite
 * @param {string} [style='engaging'] - Style to rewrite in ('engaging', 'professional', 'casual', etc.)
 * @param {number} [maxLength] - Maximum length of the rewritten text
 * @returns {Promise<ApiResponse<{ rewritten_text: string }>>} Promise with rewritten text
 */
export async function rewriteText(
  text: string,
  style: string = 'engaging',
  maxLength?: number
): Promise<ApiResponse<{ rewritten_text: string }>> {
  const requestBody: {
    text: string;
    style: string;
    max_length?: number;
  } = {
    text,
    style,
  };

  if (maxLength) {
    requestBody.max_length = maxLength;
  }

  return fetchAPI<{ rewritten_text: string }>(
    '/content/rewrite',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
    },
    15000 // 15 second timeout
  );
}

/**
 * Summarize text to a specified length
 * 
 * @param {string} text - Text to summarize
 * @param {number} [maxLength=150] - Maximum length of the summary
 * @returns {Promise<ApiResponse<{ summary: string }>>} Promise with summarized text
 */
export async function summarizeText(
  text: string,
  maxLength: number = 150
): Promise<ApiResponse<{ summary: string }>> {
  return fetchAPI<{ summary: string }>(
    '/content/summarize',
    {
      method: 'POST',
      body: JSON.stringify({
        text,
        max_length: maxLength,
      }),
    },
    15000 // 15 second timeout
  );
}

/**
 * Extract keywords from text
 * 
 * @param {string} text - Text to extract keywords from
 * @param {number} [maxKeywords=5] - Maximum number of keywords to extract
 * @returns {Promise<ApiResponse<{ keywords: string[] }>>} Promise with extracted keywords
 */
export async function extractKeywords(
  text: string,
  maxKeywords: number = 5
): Promise<ApiResponse<{ keywords: string[] }>> {
  return fetchAPI<{ keywords: string[] }>(
    '/content/keywords',
    {
      method: 'POST',
      body: JSON.stringify({
        text,
        max_keywords: maxKeywords,
      }),
    }
  );
}

/**
 * Process an image URL (resize, optimize, etc.)
 * 
 * @param {string} imageUrl - URL of the image to process
 * @param {object} [options] - Processing options
 * @param {number} [options.width] - Target width
 * @param {number} [options.height] - Target height
 * @param {string} [options.format='webp'] - Output format
 * @param {number} [options.quality=80] - Output quality (1-100)
 * @returns {Promise<ApiResponse<{ processed_url: string }>>} Promise with processed image URL
 */
export async function processImage(
  imageUrl: string,
  options?: {
    width?: number;
    height?: number;
    format?: 'webp' | 'jpeg' | 'png';
    quality?: number;
  }
): Promise<ApiResponse<{ processed_url: string }>> {
  return fetchAPI<{ processed_url: string }>(
    '/content/process-image',
    {
      method: 'POST',
      body: JSON.stringify({
        image_url: imageUrl,
        ...options,
      }),
    }
  );
} 