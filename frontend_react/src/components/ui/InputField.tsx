import React from 'react';
import { cn } from '../../utils/cn';
import { generateId, focusVisible } from '../../utils/accessibility';

export interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ 
    className, 
    label, 
    error, 
    helperText, 
    required = false,
    id,
    ...props 
  }, ref) => {
    const inputId = id || generateId('input');
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const baseInputStyles = [
      'block w-full rounded-md border px-3 py-2',
      'text-sm placeholder-gray-400',
      'transition-colors duration-200',
      focusVisible,
      'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'
    ];

    const inputVariants = error
      ? [
          'border-red-300 text-red-900 placeholder-red-300',
          'focus:border-red-500 focus:ring-red-500'
        ]
      : [
          'border-gray-300 text-gray-900',
          'focus:border-brand-500 focus:ring-brand-500'
        ];

    return (
      <div className="space-y-1">
        {label && (
          <label 
            htmlFor={inputId}
            className={cn(
              'block text-sm font-medium text-gray-700',
              required && "after:content-['*'] after:ml-0.5 after:text-red-500"
            )}
          >
            {label}
            {required && (
              <span className="sr-only"> (required)</span>
            )}
          </label>
        )}
        
        <input
          ref={ref}
          id={inputId}
          className={cn(
            baseInputStyles,
            inputVariants,
            className
          )}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
          aria-required={required}
          {...props}
        />
        
        {error && (
          <p 
            id={errorId}
            className="text-sm text-red-600 flex items-start space-x-1"
            role="alert"
            aria-live="polite"
          >
            <svg 
              className="h-4 w-4 mt-0.5 flex-shrink-0" 
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
            <span>{error}</span>
          </p>
        )}
        
        {helperText && !error && (
          <p 
            id={helperId}
            className="text-sm text-gray-500 flex items-start space-x-1"
          >
            <svg 
              className="h-4 w-4 mt-0.5 flex-shrink-0" 
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
            <span>{helperText}</span>
          </p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';

export { InputField };