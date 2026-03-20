import React from 'react';
import { cn } from '../../utils/cn';

export interface FormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  className?: string;
  spacing?: 'sm' | 'md' | 'lg';
}

const Form: React.FC<FormProps> = ({
  children,
  className,
  spacing = 'md',
  ...props
}) => {
  const spacingStyles = {
    sm: 'space-y-3',
    md: 'space-y-4',
    lg: 'space-y-6'
  };

  return (
    <form
      className={cn(
        spacingStyles[spacing],
        className
      )}
      {...props}
    >
      {children}
    </form>
  );
};

// Form field wrapper component
export interface FormFieldProps {
  children: React.ReactNode;
  className?: string;
}

const FormField: React.FC<FormFieldProps> = ({
  children,
  className
}) => {
  return (
    <div className={cn('space-y-1', className)}>
      {children}
    </div>
  );
};

// Textarea component
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    className, 
    label, 
    error, 
    helperText, 
    required = false,
    id,
    ...props 
  }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = error ? `${textareaId}-error` : undefined;
    const helperId = helperText ? `${textareaId}-helper` : undefined;
    const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;

    const baseStyles = [
      'block w-full rounded-md border px-3 py-2',
      'text-sm placeholder-gray-400',
      'transition-colors duration-200',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
      'resize-vertical min-h-[80px]'
    ];

    const variants = error
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
            htmlFor={textareaId}
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
        
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            baseStyles,
            variants,
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
            className="text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export { Form, FormField, Textarea };