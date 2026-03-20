import { useEffect } from 'react';
import { Alert } from './Alert';
import { Button } from './Button';
import type { Notification } from '../../hooks/useNotifications';

interface NotificationContainerProps {
  notifications?: Notification[]; // Make optional with safe default
  onRemove: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  maxNotifications?: number;
}

/**
 * Container component for displaying notifications
 * Implements Requirements 9.1, 9.3 - immediate feedback and user-friendly messages
 */
export const NotificationContainer = ({
  notifications = [], // Safe default
  onRemove,
  position = 'top-right',
  maxNotifications = 5,
}: NotificationContainerProps) => {
  // Limit the number of visible notifications with safe fallback
  const visibleNotifications = (notifications || []).slice(-maxNotifications);

  // Position classes
  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'top-center': 'fixed top-4 left-1/2 transform -translate-x-1/2 z-50',
    'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
  };

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`${positionClasses[position]} space-y-2 max-w-sm w-full`}>
      {visibleNotifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const NotificationItem = ({ notification, onRemove }: NotificationItemProps) => {
  const { id, type, title, message, action, duration, persistent } = notification;

  // Auto-remove effect (backup in case the hook's timeout fails)
  useEffect(() => {
    if (!persistent && duration) {
      const timer = setTimeout(() => {
        onRemove(id);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [id, duration, persistent, onRemove]);

  const handleDismiss = () => {
    onRemove(id);
  };

  return (
    <div className="animate-slide-in-right">
      <Alert
        variant={type}
        dismissible
        onDismiss={handleDismiss}
        className="shadow-lg border-l-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {title && (
              <div className="font-semibold text-sm mb-1">{title}</div>
            )}
            <div className="text-sm">{message}</div>
            {action && (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    action.onClick();
                    onRemove(id);
                  }}
                >
                  {action.label}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Alert>
    </div>
  );
};

/**
 * Hook to automatically show notifications for common operations
 */
export const useAutoNotifications = () => {
  // This would integrate with your notification system
  // For now, it's a placeholder for the pattern
  
  const showSuccess = (message: string) => {
    console.log('Success:', message);
  };

  const showError = (message: string) => {
    console.error('Error:', message);
  };

  const showWarning = (message: string) => {
    console.warn('Warning:', message);
  };

  const showInfo = (message: string) => {
    console.info('Info:', message);
  };

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};