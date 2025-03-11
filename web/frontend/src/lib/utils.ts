import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format relative time
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const time = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - time.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
  } else if (diffDay < 30) {
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  } else {
    // Format as MM/DD/YYYY
    return time.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

/**
 * Truncate text to a certain length
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format seconds to MM:SS
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * List of supported domains for content retrieval
 * These domains have been tested and known to work with the content extraction
 */
export const SUPPORTED_DOMAINS = [
  'reddit.com',
  'www.reddit.com',
  'old.reddit.com',
  'medium.com',
  'dev.to',
  'github.com',
  'substack.com',
  'nytimes.com',
  'bbc.com',
  'cnn.com',
  'theguardian.com',
  'washingtonpost.com',
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
 * Validate video creation form fields
 * Returns validation errors for each field
 */
export interface FormValidationErrors {
  title?: string;
  url?: string;
}

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
