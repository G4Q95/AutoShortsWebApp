/**
 * Form-related type definitions
 */

/**
 * Form state interface for video creation form
 */
export interface FormState {
  title: string;
  url: string;
  isLoading: boolean;
  errors: FormValidationErrors;
}

/**
 * Form validation error interface
 */
export interface FormValidationErrors {
  title?: string;
  url?: string;
}

/**
 * Form submission result interface
 */
export interface FormSubmissionResult {
  success: boolean;
  message: string;
  videoId?: string;
} 