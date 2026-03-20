import React from 'react';
import { cn } from '../../utils/cn';

export interface ProgressStep {
  id: string;
  label: string;
  description?: string;
}

export interface ProgressIndicatorProps {
  steps: ProgressStep[];
  currentStep: number;
  className?: string;
  variant?: 'horizontal' | 'vertical';
  size?: 'sm' | 'md' | 'lg';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  currentStep,
  className,
  variant = 'horizontal',
  size = 'md'
}) => {
  const sizeStyles = {
    sm: {
      circle: 'w-6 h-6 text-xs',
      text: 'text-xs',
      spacing: variant === 'horizontal' ? 'space-x-4' : 'space-y-2'
    },
    md: {
      circle: 'w-8 h-8 text-sm',
      text: 'text-sm',
      spacing: variant === 'horizontal' ? 'space-x-6' : 'space-y-3'
    },
    lg: {
      circle: 'w-10 h-10 text-base',
      text: 'text-base',
      spacing: variant === 'horizontal' ? 'space-x-8' : 'space-y-4'
    }
  };

  const getStepStatus = (stepIndex: number) => {
    if (stepIndex < currentStep) return 'completed';
    if (stepIndex === currentStep) return 'current';
    return 'upcoming';
  };

  const getStepStyles = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          circle: 'bg-brand-600 text-white border-brand-600',
          text: 'text-gray-900 font-medium',
          connector: 'bg-brand-600'
        };
      case 'current':
        return {
          circle: 'bg-brand-50 text-brand-600 border-brand-600 ring-2 ring-brand-600 ring-offset-2',
          text: 'text-brand-600 font-medium',
          connector: 'bg-gray-200'
        };
      case 'upcoming':
        return {
          circle: 'bg-white text-gray-400 border-gray-300',
          text: 'text-gray-500',
          connector: 'bg-gray-200'
        };
      default:
        return {
          circle: 'bg-white text-gray-400 border-gray-300',
          text: 'text-gray-500',
          connector: 'bg-gray-200'
        };
    }
  };

  if (variant === 'horizontal') {
    return (
      <nav aria-label="Progress" className={cn('w-full', className)}>
        <ol className="flex items-center justify-between">
          {steps.map((step, stepIndex) => {
            const status = getStepStatus(stepIndex);
            const styles = getStepStyles(status);
            const isLast = stepIndex === steps.length - 1;

            return (
              <li key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  {/* Step circle */}
                  <div
                    className={cn(
                      'flex items-center justify-center rounded-full border-2 transition-all duration-200',
                      sizeStyles[size].circle,
                      styles.circle
                    )}
                    aria-current={status === 'current' ? 'step' : undefined}
                  >
                    {status === 'completed' ? (
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <span>{stepIndex + 1}</span>
                    )}
                  </div>

                  {/* Step label */}
                  <div className="mt-2 text-center">
                    <p className={cn(sizeStyles[size].text, styles.text)}>
                      {step.label}
                    </p>
                    {step.description && (
                      <p className="text-xs text-gray-500 mt-1 max-w-24">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {!isLast && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-4 transition-colors duration-200',
                      styles.connector
                    )}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    );
  }

  // Vertical variant
  return (
    <nav aria-label="Progress" className={cn('w-full', className)}>
      <ol className={cn('space-y-4', sizeStyles[size].spacing)}>
        {steps.map((step, stepIndex) => {
          const status = getStepStatus(stepIndex);
          const styles = getStepStyles(status);
          const isLast = stepIndex === steps.length - 1;

          return (
            <li key={step.id} className="relative">
              <div className="flex items-start">
                {/* Step circle */}
                <div
                  className={cn(
                    'flex items-center justify-center rounded-full border-2 transition-all duration-200 flex-shrink-0',
                    sizeStyles[size].circle,
                    styles.circle
                  )}
                  aria-current={status === 'current' ? 'step' : undefined}
                >
                  {status === 'completed' ? (
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    <span>{stepIndex + 1}</span>
                  )}
                </div>

                {/* Step content */}
                <div className="ml-4 min-w-0 flex-1">
                  <p className={cn(sizeStyles[size].text, styles.text)}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-sm text-gray-500 mt-1">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'absolute left-4 top-10 w-0.5 h-6 transition-colors duration-200 -translate-x-0.5',
                    styles.connector
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export { ProgressIndicator };