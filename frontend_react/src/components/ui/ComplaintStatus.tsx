import React from 'react';
import { cn } from '../../utils/cn';
import type { ComplaintStatus as ComplaintStatusType } from '../../types';

export interface ComplaintStatusProps {
  status: ComplaintStatusType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<ComplaintStatusType, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  description: string;
}> = {
  submitted: {
    label: 'Submitted',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    icon: '📝',
    description: 'Complaint has been submitted and is awaiting assignment'
  },
  assigned: {
    label: 'Assigned',
    color: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '👷',
    description: 'Complaint has been assigned to maintenance team'
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: '🔧',
    description: 'Maintenance team is actively working on the issue'
  },
  resolved: {
    label: 'Resolved',
    color: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '✅',
    description: 'Issue has been resolved and is awaiting confirmation'
  },
  closed: {
    label: 'Closed',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: '🔒',
    description: 'Complaint has been completed and closed'
  }
};

const SIZE_CONFIG = {
  sm: {
    container: 'px-2 py-1 text-xs',
    icon: 'text-sm',
    text: 'text-xs'
  },
  md: {
    container: 'px-3 py-1.5 text-sm',
    icon: 'text-base',
    text: 'text-sm'
  },
  lg: {
    container: 'px-4 py-2 text-base',
    icon: 'text-lg',
    text: 'text-base'
  }
};

const ComplaintStatus: React.FC<ComplaintStatusProps> = ({
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  className
}) => {
  const config = STATUS_CONFIG[status];
  const sizeConfig = SIZE_CONFIG[size];

  if (!config) {
    console.warn(`Unknown complaint status: ${status}`);
    return null;
  }

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        config.color,
        config.bgColor,
        config.borderColor,
        sizeConfig.container,
        className
      )}
      title={config.description}
    >
      {showIcon && (
        <span className={cn('mr-1', sizeConfig.icon)} aria-hidden="true">
          {config.icon}
        </span>
      )}
      {showLabel && (
        <span className={sizeConfig.text}>
          {config.label}
        </span>
      )}
    </span>
  );
};

// Progress indicator component for showing complaint workflow
export interface ComplaintProgressProps {
  currentStatus: ComplaintStatusType;
  className?: string;
}

const ComplaintProgress: React.FC<ComplaintProgressProps> = ({
  currentStatus,
  className
}) => {
  const steps: ComplaintStatusType[] = ['submitted', 'assigned', 'in_progress', 'resolved', 'closed'];
  const currentIndex = steps.indexOf(currentStatus);

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-center">
        {steps.map((step, index) => {
          const config = STATUS_CONFIG[step];
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          
          return (
            <React.Fragment key={step}>
              {/* Step circle */}
              <div className="flex items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors',
                    isActive
                      ? `${config.bgColor} ${config.borderColor} ${config.color}`
                      : 'bg-gray-100 border-gray-300 text-gray-400'
                  )}
                  title={config.description}
                >
                  <span className="text-sm" aria-hidden="true">
                    {config.icon}
                  </span>
                </div>
                
                {/* Step label */}
                <div className="ml-2 hidden sm:block">
                  <p className={cn(
                    'text-xs font-medium',
                    isActive ? config.color : 'text-gray-400'
                  )}>
                    {config.label}
                  </p>
                </div>
              </div>
              
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-4">
                  <div
                    className={cn(
                      'h-0.5 transition-colors',
                      index < currentIndex ? 'bg-green-400' : 'bg-gray-300'
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      
      {/* Current status description */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {STATUS_CONFIG[currentStatus].description}
        </p>
      </div>
    </div>
  );
};

export { ComplaintStatus, ComplaintProgress };