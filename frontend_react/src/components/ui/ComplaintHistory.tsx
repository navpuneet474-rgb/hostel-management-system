import React, { useState, useMemo } from 'react';
import { ComplaintCard } from './ComplaintCard';
import { LoadingSpinner } from './LoadingSpinner';
import { Alert } from './Alert';
import { Button } from './Button';
import { InputField } from './InputField';
import { cn } from '../../utils/cn';
import type { Complaint, ComplaintStatus, ComplaintCategory, ComplaintPriority } from '../../types';

export interface ComplaintHistoryProps {
  complaints: Complaint[];
  loading?: boolean;
  error?: string;
  onComplaintClick?: (complaint: Complaint) => void;
  onRefresh?: () => void;
  showFilters?: boolean;
  className?: string;
}

interface FilterState {
  search: string;
  status: ComplaintStatus | 'all';
  category: ComplaintCategory | 'all';
  priority: ComplaintPriority | 'all';
}

const STATUS_OPTIONS: { value: ComplaintStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Status' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' }
];

const CATEGORY_OPTIONS: { value: ComplaintCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Categories' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'cleaning', label: 'Cleaning' },
  { value: 'internet', label: 'Internet' },
  { value: 'security', label: 'Security' },
  { value: 'other', label: 'Other' }
];

const PRIORITY_OPTIONS: { value: ComplaintPriority | 'all'; label: string }[] = [
  { value: 'all', label: 'All Priorities' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

const ComplaintHistory: React.FC<ComplaintHistoryProps> = ({
  complaints,
  loading = false,
  error,
  onComplaintClick,
  onRefresh,
  showFilters = true,
  className
}) => {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: 'all',
    priority: 'all'
  });

  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort complaints
  const filteredComplaints = useMemo(() => {
    let filtered = complaints.filter(complaint => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          complaint.title.toLowerCase().includes(searchLower) ||
          complaint.description.toLowerCase().includes(searchLower) ||
          complaint.ticket_number?.toLowerCase().includes(searchLower) ||
          complaint.room_number?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all' && complaint.status !== filters.status) {
        return false;
      }

      // Category filter
      if (filters.category !== 'all' && complaint.category !== filters.category) {
        return false;
      }

      // Priority filter
      if (filters.priority !== 'all' && complaint.priority !== filters.priority) {
        return false;
      }

      return true;
    });

    // Sort complaints
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'date':
          const dateA = new Date(a.created_at || 0).getTime();
          const dateB = new Date(b.created_at || 0).getTime();
          comparison = dateA - dateB;
          break;
        
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          const priorityA = priorityOrder[a.priority || 'medium'];
          const priorityB = priorityOrder[b.priority || 'medium'];
          comparison = priorityA - priorityB;
          break;
        
        case 'status':
          const statusOrder = { submitted: 1, assigned: 2, in_progress: 3, resolved: 4, closed: 5 };
          const statusA = statusOrder[a.status || 'submitted'];
          const statusB = statusOrder[b.status || 'submitted'];
          comparison = statusA - statusB;
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [complaints, filters, sortBy, sortOrder]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      category: 'all',
      priority: 'all'
    });
  };

  const hasActiveFilters = filters.search || filters.status !== 'all' || 
                          filters.category !== 'all' || filters.priority !== 'all';

  // Get status counts for quick filters
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    complaints.forEach(complaint => {
      const status = complaint.status || 'submitted';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [complaints]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" text="Loading complaints..." />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="error" className="mb-6">
        <div className="flex items-center justify-between">
          <span>{error}</span>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh}>
              Try Again
            </Button>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters */}
      {showFilters && (
        <div className="space-y-4">
          {/* Search */}
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <InputField
                type="text"
                placeholder="Search complaints by title, description, ticket number, or room..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="w-full"
              />
            </div>
            {onRefresh && (
              <Button
                variant="outline"
                onClick={onRefresh}
                className="flex items-center space-x-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </Button>
            )}
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                    {option.value !== 'all' && statusCounts[option.value] ? ` (${statusCounts[option.value]})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
              >
                {CATEGORY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select
                value={filters.priority}
                onChange={(e) => handleFilterChange('priority', e.target.value)}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
              >
                {PRIORITY_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <div className="flex space-x-2">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'date' | 'priority' | 'status')}
                  className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-brand-500 focus:ring-brand-500 text-sm"
                >
                  <option value="date">Date</option>
                  <option value="priority">Priority</option>
                  <option value="status">Status</option>
                </select>
                <button
                  type="button"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  title={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                >
                  <svg 
                    className={cn('h-4 w-4 transition-transform', sortOrder === 'desc' && 'rotate-180')} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Active filters indicator */}
          {hasActiveFilters && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                </svg>
                <span className="text-sm text-blue-800">
                  Showing {filteredComplaints.length} of {complaints.length} complaints
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="text-blue-600 border-blue-300 hover:bg-blue-100"
              >
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {filteredComplaints.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            {hasActiveFilters ? 'No complaints match your filters' : 'No complaints found'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {hasActiveFilters 
              ? 'Try adjusting your search criteria or clearing filters.'
              : 'You haven\'t submitted any complaints yet.'
            }
          </p>
          {hasActiveFilters && (
            <div className="mt-6">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Results header */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              {filteredComplaints.length} complaint{filteredComplaints.length !== 1 ? 's' : ''}
              {hasActiveFilters && ` (filtered from ${complaints.length})`}
            </p>
          </div>

          {/* Complaints grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredComplaints.map((complaint) => (
              <ComplaintCard
                key={complaint.id || complaint.ticket_number}
                complaint={complaint}
                onClick={onComplaintClick}
                showActions={true}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { ComplaintHistory };