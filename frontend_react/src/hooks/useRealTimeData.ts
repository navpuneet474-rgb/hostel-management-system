import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseRealTimeDataOptions<T> {
  /** Function to fetch data */
  fetchFn: () => Promise<T>;
  /** Auto-refresh interval in milliseconds (default: 30000 = 30 seconds) */
  refreshInterval?: number;
  /** Whether to start fetching immediately (default: true) */
  immediate?: boolean;
  /** Whether to refresh when window becomes visible (default: true) */
  refreshOnFocus?: boolean;
  /** Dependencies that trigger a refresh when changed */
  dependencies?: unknown[];
  /** Error handler */
  onError?: (error: Error) => void;
  /** Success handler */
  onSuccess?: (data: T) => void;
}

export interface UseRealTimeDataReturn<T> {
  /** Current data */
  data: T | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Last updated timestamp */
  lastUpdated: Date | null;
  /** Whether auto-refresh is active */
  isAutoRefreshActive: boolean;
  /** Start auto-refresh */
  startAutoRefresh: () => void;
  /** Stop auto-refresh */
  stopAutoRefresh: () => void;
}

/**
 * Custom hook for real-time data fetching with automatic refresh capabilities
 * Implements Requirements 2.3, 4.3, 6.5, 9.1, 10.2
 */
export function useRealTimeData<T>(
  options: UseRealTimeDataOptions<T>
): UseRealTimeDataReturn<T> {
  const {
    fetchFn,
    refreshInterval = 30000, // 30 seconds default
    immediate = true,
    refreshOnFocus = true,
    dependencies = [],
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshActive, setIsAutoRefreshActive] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Manual refresh function
  const refresh = useCallback(async () => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      
      if (isMountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        onSuccess?.(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error occurred');
      
      if (isMountedRef.current) {
        setError(error);
        onError?.(error);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [fetchFn, onError, onSuccess]);

  // Start auto-refresh
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    setIsAutoRefreshActive(true);
    intervalRef.current = setInterval(() => {
      void refresh();
    }, refreshInterval);
  }, [refresh, refreshInterval]);

  // Stop auto-refresh
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsAutoRefreshActive(false);
  }, []);

  // Handle visibility change for refresh on focus
  useEffect(() => {
    if (!refreshOnFocus) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAutoRefreshActive) {
        void refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh, refreshOnFocus, isAutoRefreshActive]);

  // Handle dependencies change
  useEffect(() => {
    if (dependencies.length > 0) {
      void refresh();
    }
  }, dependencies);

  // Initial fetch and auto-refresh setup
  useEffect(() => {
    if (immediate) {
      void refresh();
      startAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [immediate, startAutoRefresh, stopAutoRefresh, refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    data,
    loading,
    error,
    refresh,
    lastUpdated,
    isAutoRefreshActive,
    startAutoRefresh,
    stopAutoRefresh,
  };
}

/**
 * Specialized hook for dashboard data with optimized refresh intervals
 */
export function useDashboardData<T>(
  fetchFn: () => Promise<T>,
  options?: Partial<UseRealTimeDataOptions<T>>
) {
  return useRealTimeData({
    fetchFn,
    refreshInterval: 30000, // 30 seconds for dashboard data
    refreshOnFocus: true,
    immediate: true,
    ...options,
  });
}

/**
 * Hook for critical data that needs frequent updates (e.g., security dashboard)
 */
export function useCriticalData<T>(
  fetchFn: () => Promise<T>,
  options?: Partial<UseRealTimeDataOptions<T>>
) {
  return useRealTimeData({
    fetchFn,
    refreshInterval: 15000, // 15 seconds for critical data
    refreshOnFocus: true,
    immediate: true,
    ...options,
  });
}

/**
 * Hook for less critical data with longer refresh intervals
 */
export function useBackgroundData<T>(
  fetchFn: () => Promise<T>,
  options?: Partial<UseRealTimeDataOptions<T>>
) {
  return useRealTimeData({
    fetchFn,
    refreshInterval: 60000, // 1 minute for background data
    refreshOnFocus: false,
    immediate: true,
    ...options,
  });
}