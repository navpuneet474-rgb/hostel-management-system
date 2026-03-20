import React from 'react';
import { Card, CardContent } from './Card';
import { cn } from '../../utils/cn';
import type { Complaint, ComplaintStatus, ComplaintPriority, ComplaintCategory } from '../../types';

export interface ComplaintCardProps {
  complaint: Complaint;
  onClick?: (complaint: Complaint) => void;
  showActions?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; icon: string }> = {
  submitted: {
    label: 'Submitted',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '📝'
  },
  assigned: {
    label: 'Assigned',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: '👷'
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: '🔧'
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✅'
  },
  closed: {
    label: 'Closed',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '🔒'
  }
};

const PRIORITY_CONFIG: Record<ComplaintPriority, { color: string; label: string }> = {
  low: { color: 'text-green-600', label: 'Low' },
  medium: { color: 'text-yellow-600', label: 'Medium' },
  high: { color: 'text-orange-600', label: 'High' },
  urgent: { color: 'text-red-600', label: 'Urgent' }
};

const CATEGORY_ICONS: Record<ComplaintCategory, string> = {
  electrical: '⚡',
  plumbing: '🚿',
  furniture: '🪑',
  cleaning: '🧹',
  internet: '📶',
  security: '🔒',
  other: '📝'
};

const ComplaintCard: React.FC<ComplaintCardProps> = ({
  complaint,
  onClick,
  showActions = false,
  className
}) => {
  const status = complaint.status || 'submitted';
  const priority = complaint.priority || 'medium';
  const statusConfig = STATUS_CONFIG[status];
  const priorityConfig = PRIORITY_CONFIG[priority];
  const categoryIcon = CATEGORY_ICONS[complaint.category];

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <Card 
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        onClick && 'cursor-pointer hover:border-brand-300',
        className
      )}
      onClick={() => onClick?.(complaint)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with status and priority */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-lg">{categoryIcon}</span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {complaint.title}
                </h3>
                {complaint.ticket_number && (
                  <p className="text-xs text-gray-500 font-mono">
                    #{complaint.ticket_number}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end space-y-1">
              <span className={cn(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                statusConfig.color
              )}>
                <span className="mr-1">{statusConfig.icon}</span>
                {statusConfig.label}
              </span>
              <span className={cn('text-xs font-medium', priorityConfig.color)}>
                {priorityConfig.label} Priority
              </span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2">
            {complaint.description}
          </p>

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-4">
              <span>Room: {complaint.room_number || 'N/A'}</span>
              {complaint.photos && complaint.photos.length > 0 && (
                <span className="flex items-center space-x-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{complaint.photos.length}</span>
                </span>
              )}
            </div>
            <div className="text-right">
              <div>{formatDate(complaint.created_at)}</div>
              <div className="text-gray-400">{getDaysAgo(complaint.created_at)}</div>
            </div>
          </div>

          {/* Progress indicator for in-progress items */}
          {status === 'in_progress' && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
              <div className="flex items-center space-x-2">
                <div className="flex-1">
                  <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 rounded-full animate-pulse" style={{ width: '60%' }} />
                  </div>
                </div>
                <span className="text-xs text-orange-700 font-medium">In Progress</span>
              </div>
            </div>
          )}

          {/* Resolution info for resolved/closed items */}
          {(status === 'resolved' || status === 'closed') && complaint.resolved_at && (
            <div className="bg-green-50 border border-green-200 rounded-md p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-700 font-medium">
                  Resolved on {formatDate(complaint.resolved_at)}
                </span>
                {complaint.rating && (
                  <div className="flex items-center space-x-1">
                    <span className="text-green-600">Rating:</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={cn(
                            'h-3 w-3',
                            star <= complaint.rating! ? 'text-yellow-400' : 'text-gray-300'
                          )}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          {showActions && (
            <div className="flex space-x-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                className="flex-1 text-xs text-brand-600 hover:text-brand-700 font-medium"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick?.(complaint);
                }}
              >
                View Details
              </button>
              {status === 'resolved' && !complaint.rating && (
                <button
                  type="button"
                  className="flex-1 text-xs text-green-600 hover:text-green-700 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Handle rating action
                  }}
                >
                  Rate Service
                </button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { ComplaintCard };