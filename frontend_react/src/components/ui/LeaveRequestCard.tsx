import React, { useState } from 'react';
import { cn } from '../../utils/cn';
import { Card, CardContent, CardHeader } from './Card';
import { LeaveRequestStatus } from './LeaveRequestStatus';
import { Timeline } from './Timeline';
import { Button } from './Button';
import type { LeaveStatus } from './LeaveRequestStatus';
import type { TimelineStep } from './Timeline';

export interface LeaveRequest {
  id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: LeaveStatus;
  created_at: string;
  updated_at?: string;
  emergency?: boolean;
  supporting_documents?: Array<{
    name: string;
    url: string;
    size: number;
  }>;
  approval_chain?: Array<{
    role: string;
    approver?: string;
    approved_at?: string;
    comments?: string;
    status: 'pending' | 'approved' | 'rejected';
  }>;
}

export interface LeaveRequestCardProps {
  request: LeaveRequest;
  onCancel?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

const LeaveRequestCard: React.FC<LeaveRequestCardProps> = ({
  request,
  onCancel,
  onViewDetails,
  className,
  variant = 'default'
}) => {
  const [showTimeline, setShowTimeline] = useState(false);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const calculateDuration = () => {
    try {
      const fromDate = new Date(request.from_date);
      const toDate = new Date(request.to_date);
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return `${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
    } catch {
      return 'N/A';
    }
  };

  const getTimelineSteps = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        id: 'submitted',
        title: 'Request Submitted',
        description: 'Leave request created',
        timestamp: request.created_at,
        status: 'completed'
      }
    ];

    // Add approval chain steps
    if (request.approval_chain) {
      request.approval_chain.forEach((approval, index) => {
        const stepStatus = 
          approval.status === 'approved' ? 'completed' :
          approval.status === 'rejected' ? 'rejected' :
          request.status === 'pending' && index === 0 ? 'current' :
          'pending';

        steps.push({
          id: `approval-${index}`,
          title: `${approval.role} Review`,
          description: approval.status === 'approved' ? 'Approved' : 
                      approval.status === 'rejected' ? 'Rejected' : 
                      'Pending review',
          timestamp: approval.approved_at,
          status: stepStatus,
          actor: approval.approver,
          comments: approval.comments
        });
      });
    } else {
      // Default approval steps if no chain provided
      const defaultSteps = [
        { role: 'Warden', current: ['pending', 'warden_approved'].includes(request.status) },
        { role: 'Security', current: ['security_approved'].includes(request.status) }
      ];

      defaultSteps.forEach((step, index) => {
        let stepStatus: TimelineStep['status'] = 'pending';
        
        if (request.status === 'rejected') {
          stepStatus = index === 0 ? 'rejected' : 'pending';
        } else if (request.status === 'approved') {
          stepStatus = 'completed';
        } else if (request.status === 'warden_approved' && index === 0) {
          stepStatus = 'completed';
        } else if (request.status === 'security_approved') {
          stepStatus = 'completed';
        } else if (step.current) {
          stepStatus = 'current';
        }

        steps.push({
          id: `${step.role.toLowerCase()}-review`,
          title: `${step.role} Review`,
          description: stepStatus === 'completed' ? 'Approved' : 
                      stepStatus === 'rejected' ? 'Rejected' : 
                      stepStatus === 'current' ? 'Under review' :
                      'Pending review',
          status: stepStatus
        });
      });
    }

    return steps;
  };

  const canCancel = request.status === 'pending' || request.status === 'warden_approved';

  if (variant === 'compact') {
    return (
      <Card className={cn('hover:shadow-md transition-shadow', className)}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <LeaveRequestStatus status={request.status} size="sm" />
                {request.emergency && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                    Emergency
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-gray-900 truncate">
                {formatDate(request.from_date)} - {formatDate(request.to_date)}
              </p>
              <p className="text-xs text-gray-500">
                {calculateDuration()} • {formatDateTime(request.created_at)}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onViewDetails?.(request.id)}
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <LeaveRequestStatus status={request.status} />
              {request.emergency && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Emergency
                </span>
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              Leave Request #{request.id.slice(-6)}
            </h3>
            <p className="text-sm text-gray-600">
              Submitted on {formatDateTime(request.created_at)}
            </p>
          </div>
          
          <div className="flex space-x-2">
            {canCancel && onCancel && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCancel(request.id)}
              >
                Cancel
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowTimeline(!showTimeline)}
            >
              {showTimeline ? 'Hide' : 'Show'} Progress
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Leave Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-700">From Date</p>
            <p className="text-sm text-gray-900">{formatDate(request.from_date)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">To Date</p>
            <p className="text-sm text-gray-900">{formatDate(request.to_date)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Duration</p>
            <p className="text-sm text-gray-900">{calculateDuration()}</p>
          </div>
        </div>

        {/* Reason */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-1">Reason</p>
          <p className="text-sm text-gray-900 bg-gray-50 rounded-md p-3">
            {request.reason}
          </p>
        </div>

        {/* Supporting Documents */}
        {request.supporting_documents && request.supporting_documents.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Supporting Documents</p>
            <div className="space-y-1">
              {request.supporting_documents.map((doc, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:text-brand-500 hover:underline"
                  >
                    {doc.name}
                  </a>
                  <span className="text-gray-400">
                    ({(doc.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline */}
        {showTimeline && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Approval Progress</h4>
            <Timeline steps={getTimelineSteps()} variant="default" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { LeaveRequestCard };