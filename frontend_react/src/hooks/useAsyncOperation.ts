import { useState, useCallback } from 'react';

export interface UseAsyncOperationOptions {
  /** Success message to show */
  successMessage?: string;
  /** Error message to show (or function to generate message from error) */
  errorMessage?: string | ((error: Error) => string);
  /** Callback on success */
  onSuccess?: (result: any) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Whether to show loading state immediately */
  immediate?: boolean;
}

export interface UseAsyncOperationReturn {
  /** Current loading state */
  loading: boolean;
  /** Current error state */
  error: Error | null;
  /** Success state */
  success: boolean;
  /** Execute async operation */
  execute: <T>(operation: () => Promise<T>) => Promise<T | null>;
  /** Reset states */
  reset: () => void;
  /** Set loading state manually */
  setLoading: (loading: boolean) => void;
  /** Set error state manually */
  setError: (error: Error | null) => void;
  /** Set success state manually */
  setSuccess: (success: boolean) => void;
}

/**
 * Hook for managing async operations with loading states and user feedback
 * Implements Requirements 9.1, 10.2 - immediate feedback for all user actions
 */
export function useAsyncOperation(
  options: UseAsyncOperationOptions = {}
): UseAsyncOperationReturn {
  const {
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    immediate = false,
  } = options;

  const [loading, setLoadingState] = useState(immediate);
  const [error, setErrorState] = useState<Error | null>(null);
  const [success, setSuccessState] = useState(false);

  const setLoading = useCallback((loading: boolean) => {
    setLoadingState(loading);
  }, []);

  const setError = useCallback((error: Error | null) => {
    setErrorState(error);
    if (error) {
      setSuccessState(false);
    }
  }, []);

  const setSuccess = useCallback((success: boolean) => {
    setSuccessState(success);
    if (success) {
      setErrorState(null);
    }
  }, []);

  const reset = useCallback(() => {
    setLoadingState(false);
    setErrorState(null);
    setSuccessState(false);
  }, []);

  const execute = useCallback(async <T>(
    operation: () => Promise<T>
  ): Promise<T | null> => {
    setLoadingState(true);
    setErrorState(null);
    setSuccessState(false);

    try {
      const result = await operation();
      
      setSuccessState(true);
      onSuccess?.(result);
      
      // Show success message if provided
      if (successMessage) {
        // In a real app, you might use a toast notification system here
        console.log('Success:', successMessage);
      }
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Operation failed');
      
      setErrorState(error);
      onError?.(error);
      
      // Show error message if provided
      if (errorMessage) {
        const message = typeof errorMessage === 'function' 
          ? errorMessage(error) 
          : errorMessage;
        console.error('Error:', message);
      }
      
      return null;
    } finally {
      setLoadingState(false);
    }
  }, [successMessage, errorMessage, onSuccess, onError]);

  return {
    loading,
    error,
    success,
    execute,
    reset,
    setLoading,
    setError,
    setSuccess,
  };
}

/**
 * Hook for form submissions with validation and feedback
 */
export function useFormSubmission<T = any>(
  submitFn: (data: T) => Promise<any>,
  options: UseAsyncOperationOptions = {}
) {
  const asyncOp = useAsyncOperation({
    successMessage: 'Form submitted successfully',
    errorMessage: 'Failed to submit form. Please try again.',
    ...options,
  });

  const submit = useCallback(async (data: T) => {
    return asyncOp.execute(() => submitFn(data));
  }, [asyncOp, submitFn]);

  return {
    ...asyncOp,
    submit,
  };
}

/**
 * Hook for API calls with automatic retry logic
 */
export function useApiCall<T = any>(
  options: UseAsyncOperationOptions & {
    maxRetries?: number;
    retryDelay?: number;
  } = {}
) {
  const { maxRetries = 2, retryDelay = 1000, ...asyncOptions } = options;
  const asyncOp = useAsyncOperation(asyncOptions);

  const call = useCallback(async (apiFn: () => Promise<T>) => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await asyncOp.execute(apiFn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('API call failed');
        
        if (attempt < maxRetries) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All retries failed
    if (lastError) {
      asyncOp.setError(lastError);
    }
    
    return null;
  }, [asyncOp, maxRetries, retryDelay]);

  return {
    ...asyncOp,
    call,
  };
}