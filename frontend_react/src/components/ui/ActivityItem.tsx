import React from 'react';
import { cn } from '../../utils/cn';

export interface ActivityItemProps {
  title: string;
  description: string;
  timestamp: string;
  status?: 'success' | 'pending' | 'error' | 'info';
  icon?: React.ReactNode;
  className?: string;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  title,
  description,
  timestamp,
  status = 'info',
  icon,
  className,
}) => {
  const statusColors = {
    success: 'text-green-600 bg-green-100',
    pending: 'text-yellow-600 bg-yellow-100',
    error: 'text-red-600 bg-red-100',
    info: 'text-blue-600 bg-blue-100'
  };

  const statusIcons = {
    success: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    pending: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className={cn('flex items-start space-x-3 py-3', className)}>
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
        statusColors[status]
      )}>
        {icon || statusIcons[status]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {title}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {description}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {timestamp}
        </p>
      </div>
    </div>
  );
};

export { ActivityItem };