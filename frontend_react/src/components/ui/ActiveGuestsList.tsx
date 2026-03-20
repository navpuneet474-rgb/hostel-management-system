import React, { useState, useEffect } from 'react';
import { Card, Button, LoadingSpinner, Alert } from './';
import { getActiveGuests } from '../../api/endpoints';
import { cn } from '../../utils/cn';

export interface ActiveGuest {
  id: string;
  guest_name: string;
  guest_phone: string;
  student_name: string;
  room_number: string;
  entry_time: string;
  expires_at: string;
  verification_code: string;
  status: 'inside' | 'expired';
}

export interface ActiveGuestsListProps {
  className?: string;
  onGuestSelect?: (guest: ActiveGuest) => void;
}

const ActiveGuestsList: React.FC<ActiveGuestsListProps> = ({
  className,
  onGuestSelect
}) => {
  const [guests, setGuests] = useState<ActiveGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchActiveGuests = async () => {
    try {
      setLoading(true);
      const data = await getActiveGuests();
      setGuests(data.guests || []);
      setError('');
    } catch (error) {
      console.error('Error fetching active guests:', error);
      setError('Failed to load active guests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveGuests();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchActiveGuests, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeUntilExpiry = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  };

  const isExpiringSoon = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diffMs = expiry.getTime() - now.getTime();
    return diffMs <= 30 * 60 * 1000; // 30 minutes
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
          Active Guests ({guests.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchActiveGuests}
          disabled={loading}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="error" className="mb-4" dismissible onDismiss={() => setError('')}>
          {error}
        </Alert>
      )}

      {guests.length === 0 ? (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          <p className="text-sm text-gray-600">No active guests in the hostel</p>
        </div>
      ) : (
        <div className="space-y-3">
          {guests.map((guest) => (
            <div
              key={guest.id}
              className={cn(
                'border rounded-lg p-4 hover:bg-gray-50 transition-colors',
                guest.status === 'expired' && 'border-red-200 bg-red-50',
                isExpiringSoon(guest.expires_at) && guest.status !== 'expired' && 'border-yellow-200 bg-yellow-50'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{guest.guest_name}</h4>
                      <p className="text-sm text-gray-600">
                        Visiting {guest.student_name} (Room {guest.room_number})
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                    <span>Entered: {formatDateTime(guest.entry_time)}</span>
                    <span>•</span>
                    <span className={cn(
                      guest.status === 'expired' ? 'text-red-600' :
                      isExpiringSoon(guest.expires_at) ? 'text-yellow-600' : 'text-gray-500'
                    )}>
                      {guest.status === 'expired' ? 'Expired' : `Expires in ${getTimeUntilExpiry(guest.expires_at)}`}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {guest.status === 'expired' && (
                    <span className="px-2 py-1 text-xs font-medium text-red-600 bg-red-100 rounded-full">
                      Expired
                    </span>
                  )}
                  {isExpiringSoon(guest.expires_at) && guest.status !== 'expired' && (
                    <span className="px-2 py-1 text-xs font-medium text-yellow-600 bg-yellow-100 rounded-full">
                      Expiring Soon
                    </span>
                  )}
                  
                  {onGuestSelect && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onGuestSelect(guest)}
                    >
                      View
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export { ActiveGuestsList };