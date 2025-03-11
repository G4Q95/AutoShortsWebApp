import { useState, useEffect } from 'react';
import {
  createVideo,
  VideoCreationResponse,
  ApiResponse,
  apiHealth,
  checkApiHealth,
} from './api-client';
import { validateVideoForm, FormValidationErrors } from './utils';

interface FormState {
  url: string;
  title: string;
  errors: FormValidationErrors;
  submitError: string | null;
  loading: boolean;
  taskId: string | null;
  touched: {
    title: boolean;
    url: boolean;
  };
  retries: number;
  apiStatus: {
    connected: boolean;
    lastChecked: number;
    responseTime: number | null;
    statusMessage: string;
  };
}

interface FormHandlerResult {
  state: FormState;
  setUrl: (url: string) => void;
  setTitle: (title: string) => void;
  handleTitleBlur: () => void;
  handleUrlBlur: () => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  resetForm: () => void;
  retrySubmit: () => Promise<void>;
  checkApiConnection: () => Promise<void>;
}

const MAX_RETRIES = 3;
const NETWORK_ERROR_MESSAGES = [
  'Failed to fetch',
  'Network request failed',
  'network error',
  'Network Error',
  'timeout',
  'Timeout',
];

export function useVideoCreationForm(): FormHandlerResult {
  const [state, setState] = useState<FormState>({
    url: '',
    title: '',
    errors: {},
    submitError: null,
    loading: false,
    taskId: null,
    touched: { title: false, url: false },
    retries: 0,
    apiStatus: {
      connected: false,
      lastChecked: 0,
      responseTime: null,
      statusMessage: 'Not checked',
    },
  });

  // Check API connection when form is first loaded
  useEffect(() => {
    checkApiConnection();
  }, []);

  const checkApiConnection = async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      apiStatus: {
        ...prev.apiStatus,
        statusMessage: 'Checking connection...',
      },
    }));

    const healthCheck = await checkApiHealth();

    setState((prev) => ({
      ...prev,
      apiStatus: {
        connected: apiHealth.isAvailable,
        lastChecked: apiHealth.lastChecked,
        responseTime: apiHealth.responseTime,
        statusMessage: apiHealth.isAvailable
          ? `Connected (${Math.round(apiHealth.responseTime)}ms)`
          : 'Not connected to backend',
      },
    }));
  };

  const setUrl = (url: string) => {
    setState((prev) => ({
      ...prev,
      url,
      // Clear URL errors when user types if the field was previously touched
      errors:
        prev.touched.url && prev.errors.url ? { ...prev.errors, url: undefined } : prev.errors,
    }));
  };

  const setTitle = (title: string) => {
    setState((prev) => ({
      ...prev,
      title,
      // Clear title errors when user types if the field was previously touched
      errors:
        prev.touched.title && prev.errors.title
          ? { ...prev.errors, title: undefined }
          : prev.errors,
    }));
  };

  const handleTitleBlur = () => {
    const { title, url } = state;
    setState((prev) => {
      const touched = { ...prev.touched, title: true };
      const validationErrors = validateVideoForm(title, url);
      return {
        ...prev,
        touched,
        errors: { ...prev.errors, title: validationErrors.title },
      };
    });
  };

  const handleUrlBlur = () => {
    const { title, url } = state;
    setState((prev) => {
      const touched = { ...prev.touched, url: true };
      const validationErrors = validateVideoForm(title, url);
      return {
        ...prev,
        touched,
        errors: { ...prev.errors, url: validationErrors.url },
      };
    });
  };

  const submitFormData = async (): Promise<ApiResponse<VideoCreationResponse> | null> => {
    const { title, url } = state;

    try {
      const response = await createVideo(url, title);

      // Update API status from the response
      if (response.connectionInfo) {
        setState((prev) => ({
          ...prev,
          apiStatus: {
            connected: response.connectionInfo?.success || false,
            lastChecked: Date.now(),
            responseTime: response.timing?.duration || null,
            statusMessage: response.connectionInfo?.success
              ? `Connected (${Math.round(response.timing?.duration || 0)}ms)`
              : `Error: ${response.connectionInfo?.statusText || 'Unknown'}`,
          },
        }));
      }

      return response;
    } catch (err) {
      console.error('Error submitting form:', err);
      // Update API status to disconnected
      setState((prev) => ({
        ...prev,
        apiStatus: {
          ...prev.apiStatus,
          connected: false,
          lastChecked: Date.now(),
          statusMessage: 'Connection error',
        },
      }));
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    const { title, url } = state;

    // Validate all inputs
    const validationErrors = validateVideoForm(title, url);
    if (Object.keys(validationErrors).length > 0) {
      setState((prev) => ({
        ...prev,
        errors: validationErrors,
        touched: { title: true, url: true },
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      errors: {},
      submitError: null,
      loading: true,
      retries: 0, // Reset retries on new submission
    }));

    try {
      const response = await submitFormData();

      if (!response) {
        setState((prev) => ({
          ...prev,
          submitError: 'Failed to connect to the server. Please try again.',
          loading: false,
        }));
        return;
      }

      if (response.error) {
        // More specific error messages based on the status code
        let errorMessage = response.error?.detail || 'An error occurred while creating your video.';

        if (response.connectionInfo) {
          const status = response.connectionInfo.status;

          // Customize error message based on status code
          if (status === 0) {
            errorMessage = 'Cannot connect to the server. Please check your internet connection.';
          } else if (status === 408) {
            errorMessage = 'The request timed out. Please try again.';
          } else if (status === 429) {
            errorMessage = 'Too many requests. Please wait a moment and try again.';
          } else if (status >= 500) {
            errorMessage = 'The server encountered an error. Please try again later.';
          }
        }

        setState((prev) => ({
          ...prev,
          submitError: errorMessage,
          loading: false,
        }));
      } else if (response.data) {
        setState((prev) => ({
          ...prev,
          taskId: response.data?.task_id || null,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          submitError: 'Received an empty response from the server.',
          loading: false,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred.';
      const isNetworkError = NETWORK_ERROR_MESSAGES.some((msg) =>
        errorMessage.toLowerCase().includes(msg.toLowerCase())
      );

      setState((prev) => ({
        ...prev,
        submitError: isNetworkError
          ? 'Network connection issue. Please check your internet connection and try again.'
          : 'An unexpected error occurred. Please try again.',
        loading: false,
      }));
    }
  };

  const retrySubmit = async () => {
    const { retries } = state;

    // First, check API connection
    await checkApiConnection();

    // Don't retry if still not connected
    if (!apiHealth.isAvailable) {
      setState((prev) => ({
        ...prev,
        submitError: 'Cannot connect to the server. Please check your connection and try again.',
        loading: false,
      }));
      return;
    }

    if (retries >= MAX_RETRIES) {
      setState((prev) => ({
        ...prev,
        submitError: 'Maximum retry attempts reached. Please try again later.',
        loading: false,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      loading: true,
      retries: prev.retries + 1,
      submitError: null,
    }));

    // Wait a bit longer between each retry attempt
    await new Promise((resolve) => setTimeout(resolve, 1000 * (state.retries + 1)));

    await handleSubmit(null as any);
  };

  const resetForm = () => {
    setState({
      url: '',
      title: '',
      errors: {},
      submitError: null,
      loading: false,
      taskId: null,
      touched: { title: false, url: false },
      retries: 0,
      apiStatus: state.apiStatus, // Preserve API status
    });
  };

  return {
    state,
    setUrl,
    setTitle,
    handleTitleBlur,
    handleUrlBlur,
    handleSubmit,
    resetForm,
    retrySubmit,
    checkApiConnection,
  };
}
