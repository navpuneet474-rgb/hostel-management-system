import React from 'react';
import { cn } from '../../utils/cn';
import { focusVisible } from '../../utils/accessibility';

export interface AlertProps {
  variant?: 'success' | 'error' | 'warning' | 'info';
  dismissible?: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

const Alert: React.FC<AlertProps> = ({ 
  variant = 'info', 
  dismissible = false, 
  onDismiss, 
  children, 
  className,
  title
}) => {
  const baseStyles = [
    'rounded-md p-4 border',
    'flex items-start space-x-3'
  ];

  const variants = {
    success: [
      'bg-green-50 border-green-200 text-green-800'
    ],
    error: [
      'bg-red-50 border-red-200 text-red-800'
    ],
    warning: [
      'bg-yellow-50 border-yellow-200 text-yellow-800'
    ],
    info: [
      'bg-blue-50 border-blue-200 text-blue-800'
    ]
  };

  const icons = {
    success: (
      <svg 
        className="h-5 w-5 text-green-400 flex-shrink-0" 
        viewBox="0 0 20 20" 
        fill="currentColor"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.236 4.53L7.53 10.53a.75.75 0 00-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" 
          clipRule="evenodd" 
        />
      </svg>
    ),
    error: (
      <svg 
        className="h-5 w-5 text-red-400 flex-shrink-0" 
        viewBox="0 0 20 20" 
        fill="currentColor"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" 
          clipRule="evenodd" 
        />
      </svg>
    ),
    warning: (
      <svg 
        className="h-5 w-5 text-yellow-400 flex-shrink-0" 
        viewBox="0 0 20 20" 
        fill="currentColor"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" 
          clipRule="evenodd" 
        />
      </svg>
    ),
    info: (
      <svg 
        className="h-5 w-5 text-blue-400 flex-shrink-0" 
        viewBox="0 0 20 20" 
        fill="currentColor"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" 
          clipRule="evenodd" 
        />
      </svg>
    )
  };

  const roleMap = {
    success: 'status',
    error: 'alert',
    warning: 'alert',
    info: 'status'
  };

  const ariaLabels = {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Information'
  };

  return (
    <div 
      className={cn(
        baseStyles,
        variants[variant],
        className
      )}
      role={roleMap[variant]}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      aria-label={`${ariaLabels[variant]} alert`}
    >
      {icons[variant]}
      
      <div className="flex-1 min-w-0">
        {title && (
          <h3 className="text-sm font-medium mb-1">
            {title}
          </h3>
        )}
        <div className="text-sm">
          {children}
        </div>
      </div>
      
      {dismissible && onDismiss && (
        <button
          type="button"
          className={cn(
            'flex-shrink-0 ml-auto pl-3',
            'text-current hover:text-opacity-75',
            focusVisible,
            'rounded-sm p-1'
          )}
          onClick={onDismiss}
          aria-label={`Dismiss ${ariaLabels[variant].toLowerCase()} alert`}
        >
          <svg 
            className="h-5 w-5" 
            viewBox="0 0 20 20" 
            fill="currentColor"
            aria-hidden="true"
          >
            <path 
              d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" 
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export { Alert };