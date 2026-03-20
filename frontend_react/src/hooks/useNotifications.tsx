import { useState, useCallback, useEffect } from 'react';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface UseNotificationsReturn {
  /** Current notifications */
  notifications: Notification[];
  /** Add a notification */
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  /** Remove a notification by ID */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearNotifications: () => void;
  /** Convenience methods for different types */
  success: (message: string, options?: Partial<Notification>) => string;
  error: (message: string, options?: Partial<Notification>) => string;
  warning: (message: string, options?: Partial<Notification>) => string;
  info: (message: string, options?: Partial<Notification>) => string;
}

/**
 * Hook for managing notifications and user feedback
 * Implements Requirements 9.1, 9.3, 9.5 - immediate feedback and error handling
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((
    notification: Omit<Notification, 'id'>
  ): string => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      id,
      duration: 5000, // 5 seconds default
      ...notification,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove after duration (unless persistent)
    if (!newNotification.persistent && newNotification.duration) {
      setTimeout(() => {
        removeNotification(id);
      }, newNotification.duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const success = useCallback((
    message: string, 
    options: Partial<Notification> = {}
  ): string => {
    return addNotification({
      type: 'success',
      message,
      ...options,
    });
  }, [addNotification]);

  const error = useCallback((
    message: string, 
    options: Partial<Notification> = {}
  ): string => {
    return addNotification({
      type: 'error',
      message,
      duration: 8000, // Longer duration for errors
      ...options,
    });
  }, [addNotification]);

  const warning = useCallback((
    message: string, 
    options: Partial<Notification> = {}
  ): string => {
    return addNotification({
      type: 'warning',
      message,
      duration: 6000,
      ...options,
    });
  }, [addNotification]);

  const info = useCallback((
    message: string, 
    options: Partial<Notification> = {}
  ): string => {
    return addNotification({
      type: 'info',
      message,
      ...options,
    });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
  };
}

/**
 * Global notification context and provider
 */
import { createContext, useContext } from 'react';

const NotificationContext = createContext<UseNotificationsReturn | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const notifications = useNotifications();

  return (
    <NotificationContext.Provider value={notifications}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useGlobalNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useGlobalNotifications must be used within NotificationProvider');
  }
  return context;
};

/**
 * Hook for operation feedback with automatic notifications
 */
export function useOperationFeedback() {
  const notifications = useNotifications();

  const withFeedback = useCallback(async <T,>(
    operation: () => Promise<T>,
    options: {
      successMessage?: string;
      errorMessage?: string;
      loadingMessage?: string;
    } = {}
  ): Promise<T | null> => {
    const {
      successMessage = 'Operation completed successfully',
      errorMessage = 'Operation failed',
      loadingMessage,
    } = options;

    let loadingId: string | null = null;

    try {
      // Show loading notification if specified
      if (loadingMessage) {
        loadingId = notifications.info(loadingMessage, { persistent: true });
      }

      const result = await operation();

      // Remove loading notification
      if (loadingId) {
        notifications.removeNotification(loadingId);
      }

      // Show success notification
      notifications.success(successMessage);

      return result;
    } catch (error) {
      // Remove loading notification
      if (loadingId) {
        notifications.removeNotification(loadingId);
      }

      // Show error notification
      const message = error instanceof Error ? error.message : errorMessage;
      notifications.error(message);

      return null;
    }
  }, [notifications]);

  return {
    ...notifications,
    withFeedback,
  };
}