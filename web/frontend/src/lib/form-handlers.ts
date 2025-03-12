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
  checkApiHealth,
  type VideoCreationResponse,
  type ApiResponse
} from './api-client';

const INITIAL_FORM_STATE: FormState = {
  title: '',
  url: '',
  isLoading: false,
  errors: {}
};

/**
 * Custom hook for handling video creation form
 */
export function useVideoCreationForm() {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);

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

      if (!result.error && result.data?.task_id) {
        toast.success('Video creation started successfully!');
        router.push(`/processing/${result.data.task_id}`);
      } else {
        setFormState((prev) => ({
          ...prev,
          isLoading: false,
          errors: {
            url: result.error?.detail || 'Failed to create video. Please try again.'
          }
        }));
        toast.error(result.error?.detail || 'Failed to create video. Please try again.');
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
