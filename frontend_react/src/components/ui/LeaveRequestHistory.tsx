import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { InputField } from './InputField';
import { Button } from './Button';
import { LeaveRequestCard } from './LeaveRequestCard';
import { LoadingSpinner } from './LoadingSpinner';
import { Alert } from './Alert';
import type { LeaveRequest } from './LeaveRequestCard';
import type { LeaveStatus } from './LeaveRequestStatus';

export interface LeaveRequestHistoryProps {
  requests: LeaveRequest[];
  loading?: boolean;
  error?: string;
  onCancel?: (id: string) => void;
  onViewDetails?: (id: string) => void;
  onRefresh?: () => void;
  className?: string;
}

type SortOption = 'newest' | 'oldest' | 'status' | 'duration';

const LeaveRequestHistory: React.FC<LeaveRequestHistoryProps> = ({
  requests,
  loading = false,
  error,
  onCancel,
  onViewDetails,
  onRefresh,
  className
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Filter and sort requests
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = requests;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(request => 
        request.reason.toLowerCase().includes(query) ||
        request.id.toLowerCase().includes(query) ||
        request.from_date.includes(query) ||
        request.to_date.includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(request => request.status === statusFilter);
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'status':
          return a.status.localeCompare(b.status);
        case 'duration':
          const aDuration = new Date(a.to_date).getTime() - new Date(a.from_date).getTime();
          const bDuration = new Date(b.to_date).getTime() - new Date(b.from_date).getTime();
          return bDuration - aDuration;
        default:
          return 0;
      }
    });

    return sorted;
  }, [requests, searchQuery, statusFilter, sortBy]);

  const getStatusCounts = () => {
    const counts = requests.reduce((acc, request) => {
      acc[request.status] = (acc[request.status] || 0) + 1;
      return acc;
    }, {} as Record<LeaveStatus, number>);

    return counts;
  };

  const statusCounts = getStatusCounts();

  const statusOptions = [
    { value: 'all' as const, label: 'All Requests', count: requests.length },
    { value: 'pending' as const, label: 'Pending', count: statusCounts.pending },
    { value: 'warden_approved' as const, label: 'Warden Approved', count: statusCounts.warden_approved },
    { value: 'security_approved' as const, label: 'Security Approved', count: statusCounts.security_approved },
    { value: 'approved' as const, label: 'Approved', count: statusCounts.approved },
    { value: 'rejected' as const, label: 'Rejected', count: statusCounts.rejected },
    { value: 'cancelled' as const, label: 'Cancelled', count: statusCounts.cancelled }
  ].filter(option => option.value === 'all' || (option.count && option.count > 0));

  const sortOptions: Array<{ value: SortOption; label: string }> = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'status', label: 'By Status' },
    { value: 'duration', label: 'By Duration' }
  ];

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || sortBy !== 'newest';

  if (error) {
    return (
      <div className={cn('space-y-4', className)}>
        <Alert variant="error">
          {error}
        </Alert>
        {onRefresh && (
          <div className="text-center">
            <Button variant="secondary" onClick={onRefresh}>
              Try Again
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Leave Request History</h2>
          <p className="text-sm text-gray-600">
            {filteredAndSortedRequests.length} of {requests.length} requests
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            Filters
          </Button>
          
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              loading={loading}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Search */}
            <div>
              <InputField
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as LeaveStatus | 'all')}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label} {option.count !== undefined && `(${option.count})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner size="lg" text="Loading requests..." />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAndSortedRequests.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {hasActiveFilters ? 'No matching requests' : 'No leave requests'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {hasActiveFilters 
              ? 'Try adjusting your search or filter criteria.'
              : 'You haven\'t submitted any leave requests yet.'
            }
          </p>
          {hasActiveFilters && (
            <div className="mt-6">
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Request List */}
      {!loading && filteredAndSortedRequests.length > 0 && (
        <div className="space-y-4">
          {filteredAndSortedRequests.map((request) => (
            <LeaveRequestCard
              key={request.id}
              request={request}
              onCancel={onCancel}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export { LeaveRequestHistory };