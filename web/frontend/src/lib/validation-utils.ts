/**
 * @fileoverview Validation utilities for form inputs and URLs
 * 
 * This module provides a set of validation functions for URLs and form inputs,
 * specifically focused on content extraction from supported platforms. It handles:
 * - URL format validation
 * - Domain validation
 * - Reddit post URL validation
 * - Form field validation
 * 
 * Key features:
 * - Type-safe validation functions
 * - Detailed error messages
 * - Support for multiple content platforms
 * - Reddit-specific URL validation
 * - Form field validation with customizable rules
 * 
 * @module validation-utils
 */

/**
 * List of domains supported for content extraction
 * These domains have been tested and verified to work with our content extraction system
 * 
 * @constant
 * @type {string[]}
 */
const SUPPORTED_DOMAINS = [
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'medium.com',
  'dev.to',
  'github.com',
  'substack.com'
];

/**
 * Checks if a URL belongs to a supported domain for content extraction
 * Handles both exact matches and subdomains
 * 
 * @param {string} url - The URL to check
 * @returns {boolean} True if the domain is supported
 * 
 * @example
 * // Returns true
 * isSupportedDomain('https://www.reddit.com/r/programming');
 * isSupportedDomain('https://blog.github.com/news');
 * 
 * // Returns false
 * isSupportedDomain('https://example.com');
 * isSupportedDomain('not-a-url');
 */
export function isSupportedDomain(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return SUPPORTED_DOMAINS.some(
      (domain) => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );
  } catch (e) {
    return false;
  }
}

/**
 * Validates a URL string for proper formatting and supported protocols
 * Checks for:
 * - Valid URL format
 * - HTTP/HTTPS protocol
 * - Valid domain structure
 * 
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL is valid
 * 
 * @example
 * // Returns true
 * isValidUrl('https://www.example.com');
 * isValidUrl('http://subdomain.example.com/path');
 * 
 * // Returns false
 * isValidUrl('not-a-url');
 * isValidUrl('ftp://example.com');
 * isValidUrl('https://localhost');
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    // Check if protocol is http or https (support common web protocols)
    const validProtocols = ['http:', 'https:'];
    if (!validProtocols.includes(parsedUrl.protocol)) {
      return false;
    }
    // Check if hostname is not empty and contains at least one dot (basic domain check)
    if (!parsedUrl.hostname || !parsedUrl.hostname.includes('.')) {
      return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Validates a Reddit post URL for proper format
 * Ensures the URL follows Reddit's standard post URL pattern:
 * /r/{subreddit}/comments/{post_id}/{post_title}
 * 
 * @param {string} url - The Reddit URL to validate
 * @returns {boolean} True if the URL is a valid Reddit post URL
 * 
 * @example
 * // Returns true
 * isValidRedditPostUrl('https://www.reddit.com/r/programming/comments/abc123/title');
 * 
 * // Returns false
 * isValidRedditPostUrl('https://www.reddit.com/r/programming');
 * isValidRedditPostUrl('https://www.reddit.com/user/username');
 */
export function isValidRedditPostUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);

    // Check if it's a reddit domain
    if (!['reddit.com', 'www.reddit.com', 'old.reddit.com'].includes(parsedUrl.hostname)) {
      return false;
    }

    // Check if it follows Reddit post pattern
    // Pattern: /r/{subreddit}/comments/{post_id}/{post_title}
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    if (pathParts.length < 4) {
      return false;
    }

    // First part should be 'r'
    if (pathParts[0] !== 'r') {
      return false;
    }

    // Third part should be 'comments'
    if (pathParts[2] !== 'comments') {
      return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Interface for form validation errors
 * Each field can have an optional error message
 * 
 * @interface FormValidationErrors
 */
export interface FormValidationErrors {
  /** Error message for the title field */
  title?: string;
  /** Error message for the URL field */
  url?: string;
}

/**
 * Validates video creation form fields
 * Performs the following validations:
 * - Title: Required, length between 3-100 characters
 * - URL: Required, valid format, supported domain
 * - Reddit URLs: Must be valid post URLs
 * 
 * @param {string} title - The video title
 * @param {string} url - The content source URL
 * @returns {FormValidationErrors} Object containing validation errors
 * 
 * @example
 * const errors = validateVideoForm('My Video', 'https://www.reddit.com/r/videos/comments/abc123/title');
 * if (Object.keys(errors).length > 0) {
 *   console.log('Form has errors:', errors);
 * } else {
 *   console.log('Form is valid');
 * }
 */
export function validateVideoForm(title: string, url: string): FormValidationErrors {
  const errors: FormValidationErrors = {};

  // Validate title
  if (!title.trim()) {
    errors.title = 'Please enter a title for your video';
  } else if (title.trim().length < 3) {
    errors.title = 'Title must be at least 3 characters long';
  } else if (title.trim().length > 100) {
    errors.title = 'Title must be less than 100 characters';
  }

  // Validate URL
  if (!url.trim()) {
    errors.url = 'Please enter a URL';
  } else if (!isValidUrl(url.trim())) {
    errors.url = 'Please enter a valid URL (must begin with http:// or https://)';
  } else if (!isSupportedDomain(url.trim())) {
    errors.url =
      'This domain is not supported for content extraction. Please try a URL from a supported domain.';
  } else if (url.includes('reddit.com') && !isValidRedditPostUrl(url.trim())) {
    errors.url =
      'This Reddit URL format is not supported. Please use a direct post URL (e.g., https://www.reddit.com/r/subreddit/comments/...)';
  }

  return errors;
} 