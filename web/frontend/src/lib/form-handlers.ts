/**
 * @fileoverview Form handling utilities for video creation
 * 
 * This module provides a custom React hook for managing video creation form state
 * and submission. It handles:
 * - Form state management
 * - Input validation
 * - API health checks
 * - Form submission
 * - Error handling
 * - Success/error notifications
 * 
 * Key features:
 * - Type-safe form state management
 * - Real-time input validation
 * - API health verification before submission
 * - Toast notifications for user feedback
 * - Automatic navigation on success
 * 
 * @module form-handlers
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { generateId } from './utils';
import {
  isValidUrl,
  isSupportedDomain,
  validateVideoForm
} from './validation-utils';
import type {
  FormState,
  FormValidationErrors,
  FormSubmissionResult
} from './form-types';
import {
  createVideo,
  checkApiHealth
} from './api-client';
import type {
  ApiResponse,
  VideoCreationResponse
} from './api-types';

/**
 * Initial state for the video creation form
 * 
 * @constant
 * @type {FormState}
 */
const INITIAL_FORM_STATE: FormState = {
  title: '',
  url: '',
  isLoading: false,
  errors: {}
};

/**
 * Custom hook for managing video creation form state and submission
 * 
 * This hook provides a complete form management solution including:
 * - Form state management with TypeScript support
 * - Input change handlers with error clearing
 * - Form submission with validation
 * - API health verification
 * - Error handling and user notifications
 * - Form reset functionality
 * 
 * @returns {{
 *   formState: FormState,
 *   handleInputChange: (field: 'title' | 'url', value: string) => void,
 *   handleSubmit: (e: React.FormEvent) => Promise<void>,
 *   resetForm: () => void
 * }}
 * 
 * @example
 * function VideoCreationForm() {
 *   const { formState, handleInputChange, handleSubmit } = useVideoCreationForm();
 * 
 *   return (
 *     <form onSubmit={handleSubmit}>
 *       <input
 *         value={formState.title}
 *         onChange={(e) => handleInputChange('title', e.target.value)}
 *       />
 *       {formState.errors.title && (
 *         <span className="error">{formState.errors.title}</span>
 *       )}
 *       // ... rest of the form
 *     </form>
 *   );
 * }
 */
export function useVideoCreationForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);

  /**
   * Handles changes to form inputs
   * Clears any existing errors for the changed field
   * 
   * @param {keyof Pick<FormState, 'title' | 'url'>} field - Field to update
   * @param {string} value - New value for the field
   */
  const handleInputChange = useCallback((
    field: keyof Pick<FormState, 'title' | 'url'>,
    value: string
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
      errors: {
        ...prev.errors,
        [field]: undefined
      }
    }));
  }, []);

  /**
   * Handles form submission
   * Performs the following steps:
   * 1. Validates form inputs
   * 2. Checks API health
   * 3. Submits video creation request
   * 4. Handles success/error states
   * 
   * @param {React.FormEvent} e - Form submission event
   * @returns {Promise<void>}
   * 
   * @throws Will not throw, but handles errors internally
   */
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    const errors = validateVideoForm(formState.title, formState.url);
    if (Object.keys(errors).length > 0) {
      setFormState((prev) => ({
        ...prev,
        errors
      }));
      return;
    }

    // Check API health before proceeding
    try {
      const healthCheck = await checkApiHealth();
      if (healthCheck.error || !healthCheck.data?.status) {
        toast.error('API is not available. Please try again later.');
        return;
      }
    } catch (error) {
      toast.error('Failed to check API health. Please try again later.');
      return;
    }

    // Start submission
    setFormState((prev) => ({
      ...prev,
      isLoading: true,
      errors: {}
    }));

    try {
      const videoId = generateId();
      const result = await createVideo(
        formState.url.trim(),
        formState.title.trim()
      );

      if (!result.error && result.data?.videoId) {
        toast.success('Video creation started successfully!');
        router.push(`/processing/${result.data.videoId}`);
      } else {
        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          errors: {
            url: result.error?.message || 'Failed to create video. Please try again.'
          }
        }));
        toast.error(result.error?.message || 'Failed to create video. Please try again.');
      }
    } catch (error) {
      console.error('Error creating video:', error);
      setFormState((prev) => ({
        ...prev,
        isLoading: false,
        errors: {
          url: 'Failed to create video. Please try again.'
        }
      }));
      toast.error('Failed to create video. Please try again.');
    }
  }, [formState.title, formState.url, router]);

  /**
   * Resets the form to its initial state
   * Clears all inputs, errors, and loading state
   */
  const resetForm = useCallback(() => {
    setFormState(INITIAL_FORM_STATE);
  }, []);

  return {
    formState,
    handleInputChange,
    handleSubmit,
    resetForm
  };
}
