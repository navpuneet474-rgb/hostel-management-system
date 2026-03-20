import React from 'react';
import { cn } from '../../utils/cn';

export interface TimelineStep {
  id: string;
  title: string;
  description?: string;
  timestamp?: string;
  status: 'completed' | 'current' | 'pending' | 'rejected';
  actor?: string;
  comments?: string;
}

export interface TimelineProps {
  steps: TimelineStep[];
  className?: string;
  variant?: 'default' | 'compact';
}

const Timeline: React.FC<TimelineProps> = ({
  steps,
  className,
  variant = 'default'
}) => {
  const getStepIcon = (status: TimelineStep['status']) => {
    switch (status) {
      case 'completed':
        return (
          <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full ring-4 ring-white">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'current':
        return (
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full ring-4 ring-white">
            <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full ring-4 ring-white">
            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'pending':
      default:
        return (
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full ring-4 ring-white">
            <div className="w-3 h-3 bg-gray-400 rounded-full" />
          </div>
        );
    }
  };

  const getConnectorColor = (currentStatus: TimelineStep['status'], nextStatus?: TimelineStep['status']) => {
    if (currentStatus === 'completed') {
      return 'bg-green-200';
    }
    if (currentStatus === 'rejected') {
      return 'bg-red-200';
    }
    return 'bg-gray-200';
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';
    
    try {
      const date = new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return timestamp;
    }
  };

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {getStepIcon(step.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className={cn(
                  'text-sm font-medium',
                  step.status === 'completed' ? 'text-green-900' :
                  step.status === 'current' ? 'text-blue-900' :
                  step.status === 'rejected' ? 'text-red-900' :
                  'text-gray-500'
                )}>
                  {step.title}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-gray-500">
                    {formatTimestamp(step.timestamp)}
                  </p>
                )}
              </div>
              {step.actor && (
                <p className="text-xs text-gray-600">by {step.actor}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('flow-root', className)}>
      <ul className="-mb-8">
        {steps.map((step, stepIndex) => {
          const isLast = stepIndex === steps.length - 1;
          
          return (
            <li key={step.id}>
              <div className="relative pb-8">
                {!isLast && (
                  <span
                    className={cn(
                      'absolute top-8 left-4 -ml-px h-full w-0.5',
                      getConnectorColor(step.status, steps[stepIndex + 1]?.status)
                    )}
                    aria-hidden="true"
                  />
                )}
                
                <div className="relative flex space-x-3">
                  <div className="flex-shrink-0">
                    {getStepIcon(step.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          step.status === 'completed' ? 'text-green-900' :
                          step.status === 'current' ? 'text-blue-900' :
                          step.status === 'rejected' ? 'text-red-900' :
                          'text-gray-900'
                        )}>
                          {step.title}
                        </p>
                        
                        {step.description && (
                          <p className="text-sm text-gray-500 mt-0.5">
                            {step.description}
                          </p>
                        )}
                        
                        {step.actor && (
                          <p className="text-xs text-gray-600 mt-1">
                            by {step.actor}
                          </p>
                        )}
                        
                        {step.comments && (
                          <div className="mt-2 p-2 bg-gray-50 rounded-md">
                            <p className="text-xs text-gray-700">
                              <span className="font-medium">Comments:</span> {step.comments}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {step.timestamp && (
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            {formatTimestamp(step.timestamp)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export { Timeline };