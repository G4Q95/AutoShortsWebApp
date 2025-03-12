/**
 * Validation utility functions for URLs and forms
 */

// List of supported domains for content extraction
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
 * Check if a URL belongs to a supported domain
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
 * Validate URL
 * Ensures URL is properly formatted and uses supported protocols
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
 * Validate Reddit URL specifically
 * Ensures the URL follows Reddit's pattern for post URLs
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
 * Form validation error interface
 */
export interface FormValidationErrors {
  title?: string;
  url?: string;
}

/**
 * Validate video creation form fields
 * Returns validation errors for each field
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