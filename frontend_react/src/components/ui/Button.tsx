import React from 'react';
import { cn } from '../../utils/cn';
import { focusVisible } from '../../utils/accessibility';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ 
    className, 
    variant = 'primary', 
    size = 'md', 
    loading = false, 
    disabled,
    children, 
    'aria-label': ariaLabel,
    'aria-describedby': ariaDescribedBy,
    ...props 
  }, ref) => {
    const baseStyles = [
      'inline-flex items-center justify-center rounded-md font-medium',
      'transition-colors duration-200',
      focusVisible,
      'disabled:opacity-50 disabled:cursor-not-allowed',
      'active:scale-95 transition-transform'
    ];

    const variants = {
      primary: [
        'bg-brand-600 text-white hover:bg-brand-700',
        'disabled:bg-brand-300'
      ],
      secondary: [
        'bg-gray-100 text-gray-900 hover:bg-gray-200',
        'disabled:bg-gray-50 disabled:text-gray-400'
      ],
      danger: [
        'bg-red-600 text-white hover:bg-red-700',
        'disabled:bg-red-300'
      ],
      outline: [
        'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        'disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200'
      ]
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm min-h-[32px]',
      md: 'px-4 py-2 text-sm min-h-[40px]',
      lg: 'px-6 py-3 text-base min-h-[44px]' // 44px minimum for mobile touch targets
    };

    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isDisabled}
        ref={ref}
        aria-disabled={isDisabled}
        aria-label={loading ? `Loading... ${ariaLabel || ''}`.trim() : ariaLabel}
        aria-describedby={ariaDescribedBy}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={loading ? 'sr-only' : undefined}>
          {children}
        </span>
        {loading && (
          <span aria-live="polite" className="sr-only">
            Loading, please wait
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };