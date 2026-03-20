import React, { useState, useEffect } from 'react';
import { Card, Button, LoadingSpinner, Alert, InputField } from './';
import { getGuestEntryLog } from '../../api/endpoints';
import { cn } from '../../utils/cn';

export interface EntryLogItem {
  id: string;
  guest_name: string;
  student_name: string;
  room_number: string;
  action: 'entry' | 'exit';
  timestamp: string;
  verification_code: string;
  verified_by?: string;
}

export interface EntryExitLogProps {
  className?: string;
  limit?: number;
}

const EntryExitLog: React.FC<EntryExitLogProps> = ({
  className,
  limit = 20
}) => {
  const [logEntries, setLogEntries] = useState<EntryLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  const fetchEntryLog = async (date?: string) => {
    try {
      setLoading(true);
      const params: { date?: string; limit?: number } = { limit };
      if (date) {
        params.date = date;
      }
      
      const data = await getGuestEntryLog(params);
      setLogEntries(data.entries || []);
      setError('');
    } catch (error) {
      console.error('Error fetching entry log:', error);
      setError('Failed to load entry log. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntryLog(filterDate);
  }, [filterDate, limit]);

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionIcon = (action: 'entry' | 'exit') => {
    if (action === 'entry') {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
        </div>
      );
    } else {
      return (
        <div className="flex items-center justify-center w-8 h-8 bg-red-100 rounded-full">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </div>
      );
    }
  };

  const handleDateFilter = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterDate(e.target.value);
  };

  const clearDateFilter = () => {
    setFilterDate('');
  };

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
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Entry/Exit Log
        </h3>
        <div className="flex items-center space-x-2">
          <InputField
            type="date"
            value={filterDate}
            onChange={handleDateFilter}
            placeholder="Filter by date"
            className="w-40"
          />
          {filterDate && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearDateFilter}
            >
              Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEntryLog(filterDate)}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      {logEntries.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-sm text-gray-600">
            {filterDate ? 'No entries found for selected date' : 'No entry/exit records found'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {logEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {getActionIcon(entry.action)}
              
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {entry.guest_name}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {entry.action === 'entry' ? 'Entered' : 'Exited'} • 
                      Visiting {entry.student_name} (Room {entry.room_number})
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(entry.timestamp)}
                    </p>
                    {entry.verified_by && (
                      <p className="text-xs text-gray-500">
                        Verified by {entry.verified_by}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="mt-1 flex items-center space-x-2">
                  <span className="text-xs text-gray-500 font-mono">
                    Code: {entry.verification_code}
                  </span>
                  <span className={cn(
                    'px-2 py-1 text-xs font-medium rounded-full',
                    entry.action === 'entry' 
                      ? 'text-green-600 bg-green-100' 
                      : 'text-red-600 bg-red-100'
                  )}>
                    {entry.action.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {logEntries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Showing {logEntries.length} recent entries
            {filterDate && ` for ${new Date(filterDate).toLocaleDateString()}`}
          </p>
        </div>
      )}
    </Card>
  );
};

export { EntryExitLog };