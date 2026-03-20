import React, { useState, useEffect } from 'react';
import { Card, Button, LoadingSpinner, Alert, InputField, DataTable, Tag } from './';
import { getRecentVerifications } from '../../api/endpoints';
import { cn } from '../../utils/cn';
import type { Column } from './DataTable';

export interface VerificationHistoryItem {
  id: string;
  student_id: string;
  student_name: string;
  pass_number: string;
  status: 'verified' | 'expired' | 'invalid' | 'denied';
  verification_time: string;
  verified_by?: string;
  verification_method: 'qr_scan' | 'manual_entry' | 'bulk_verify';
  notes?: string;
}

export interface VerificationHistoryProps {
  className?: string;
  limit?: number;
  showFilters?: boolean;
}

const VerificationHistory: React.FC<VerificationHistoryProps> = ({
  className,
  limit = 50,
  showFilters = true
}) => {
  const [verifications, setVerifications] = useState<VerificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStudent, setFilterStudent] = useState<string>('');

  const fetchVerificationHistory = async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { limit };
      
      if (filterDate) params.date = filterDate;
      if (filterStatus) params.status = filterStatus;
      if (filterStudent) params.student = filterStudent;
      
      const data = await getRecentVerifications();
      setVerifications(data.recent_verifications || []);
      setError('');
    } catch (error) {
      console.error('Error fetching verification history:', error);
      setError('Failed to load verification history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerificationHistory();
  }, [filterDate, filterStatus, filterStudent, limit]);

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'expired':
        return 'danger';
      case 'invalid':
        return 'danger';
      case 'denied':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'qr_scan':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m6-4h.01M12 8h.01M12 8h-4.01M12 8V4m6 4h.01m-6 0h2m-2 0h-2m2 0V4m6 4V4m0 0h2m-2 0h-2m2 0v4m0-4h-2" />
          </svg>
        );
      case 'manual_entry':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        );
      case 'bulk_verify':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        );
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setFilterDate('');
    setFilterStatus('');
    setFilterStudent('');
  };

  const columns: Column<VerificationHistoryItem>[] = [
    {
      key: 'student_info',
      title: 'Student',
      dataIndex: 'student_name',
      sortable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">ID: {record.student_id}</div>
        </div>
      ),
    },
    {
      key: 'pass_number',
      title: 'Pass Number',
      dataIndex: 'pass_number',
      sortable: true,
      render: (value) => (
        <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
          {value}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      render: (value) => (
        <Tag color={getStatusColor(value)}>
          {value?.toUpperCase() || 'UNKNOWN'}
        </Tag>
      ),
    },
    {
      key: 'verification_method',
      title: 'Method',
      dataIndex: 'verification_method',
      render: (value) => (
        <div className="flex items-center space-x-1">
          {getMethodIcon(value)}
          <span className="text-xs text-gray-600 capitalize">
            {value?.replace('_', ' ') || 'Unknown'}
          </span>
        </div>
      ),
    },
    {
      key: 'verification_time',
      title: 'Time',
      dataIndex: 'verification_time',
      sortable: true,
      render: (value) => (
        <div className="text-sm">
          <div>{new Date(value).toLocaleDateString()}</div>
          <div className="text-xs text-gray-500">
            {new Date(value).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      key: 'verified_by',
      title: 'Verified By',
      dataIndex: 'verified_by',
      render: (value) => (
        <span className="text-sm text-gray-600">
          {value || 'System'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Verification History ({verifications.length})
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchVerificationHistory}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>

        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <InputField
              type="date"
              label="Filter by Date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="Select date"
            />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="verified">Verified</option>
                <option value="expired">Expired</option>
                <option value="invalid">Invalid</option>
                <option value="denied">Denied</option>
              </select>
            </div>

            <InputField
              label="Filter by Student"
              value={filterStudent}
              onChange={(e) => setFilterStudent(e.target.value)}
              placeholder="Student name or ID"
            />

            <div className="flex items-end">
              <Button
                variant="secondary"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        <DataTable
          columns={columns}
          dataSource={verifications}
          rowKey={(record) => record.id || `${record.student_id}-${record.verification_time}`}
          loading={loading}
          emptyText="No verification records found"
          pagination={{
            current: 1,
            pageSize: 10,
            total: verifications.length,
            onChange: () => {}
          }}
        />

        {verifications.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                Showing {verifications.length} verification records
                {filterDate && ` for ${new Date(filterDate).toLocaleDateString()}`}
              </span>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Verified: {verifications.filter(v => v.status === 'verified').length}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Failed: {verifications.filter(v => v.status !== 'verified').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export { VerificationHistory };