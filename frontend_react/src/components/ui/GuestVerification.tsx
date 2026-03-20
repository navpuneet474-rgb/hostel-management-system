import React from 'react';
import { Card, Button, Alert } from './';
import { cn } from '../../utils/cn';

export interface GuestVerificationData {
  id?: string;
  guest_name: string;
  guest_phone: string;
  purpose: string;
  from_time: string;
  to_time: string;
  student_name?: string;
  room_number?: string;
  status: 'valid' | 'expired' | 'invalid' | 'already_entered' | 'exited';
  guest_photo?: string;
  verification_code?: string;
  entry_time?: string;
  exit_time?: string;
  current_status?: 'inside' | 'outside';
}

export interface GuestVerificationProps {
  guestData: GuestVerificationData | null;
  loading?: boolean;
  onApproveEntry?: () => void;
  onApproveExit?: () => void;
  onDenyEntry?: () => void;
  onReset?: () => void;
  className?: string;
}

const GuestVerification: React.FC<GuestVerificationProps> = ({
  guestData,
  loading = false,
  onApproveEntry,
  onApproveExit,
  onDenyEntry,
  onReset,
  className
}) => {
  if (!guestData) {
    return null;
  }

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid':
        return 'text-green-600 bg-green-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      case 'invalid':
        return 'text-red-600 bg-red-100';
      case 'already_entered':
        return 'text-blue-600 bg-blue-100';
      case 'exited':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'valid':
        return 'Valid Entry';
      case 'expired':
        return 'Expired';
      case 'invalid':
        return 'Invalid Code';
      case 'already_entered':
        return 'Inside Hostel';
      case 'exited':
        return 'Exited';
      default:
        return 'Unknown Status';
    }
  };

  const isEntryAllowed = guestData.status === 'valid';
  const isExitAllowed = guestData.status === 'already_entered' && guestData.current_status === 'inside';

  return (
    <div className={cn('space-y-4', className)}>
      <Card className="p-6">
        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Guest Verification
            </h3>
            <span
              className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                getStatusColor(guestData.status)
              )}
            >
              {getStatusText(guestData.status)}
            </span>
          </div>

          {/* Status-specific alerts */}
          {guestData.status === 'expired' && (
            <Alert variant="error">
              This guest pass has expired. Entry is not permitted.
            </Alert>
          )}

          {guestData.status === 'invalid' && (
            <Alert variant="error">
              Invalid verification code. Please check the QR code or manual code.
            </Alert>
          )}

          {guestData.status === 'already_entered' && (
            <Alert variant="info">
              This guest entered the hostel at {formatDateTime(guestData.entry_time || '')}. 
              {guestData.current_status === 'inside' ? ' Guest is currently inside.' : ' Guest has exited.'}
            </Alert>
          )}

          {guestData.status === 'exited' && (
            <Alert variant="info">
              This guest has exited the hostel at {formatDateTime(guestData.exit_time || '')}.
            </Alert>
          )}

          {guestData.status === 'valid' && (
            <Alert variant="success">
              Guest verification successful. Entry is permitted.
            </Alert>
          )}

          {/* Guest Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Guest Photo - Enhanced Display */}
            {guestData.guest_photo && (
              <div className="md:col-span-2 flex justify-center">
                <div className="relative">
                  <img
                    src={guestData.guest_photo}
                    alt={`Photo of ${guestData.guest_name}`}
                    className="w-32 h-32 rounded-lg object-cover border-4 border-gray-200 shadow-lg"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-green-500 text-white rounded-full p-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
            )}

            {/* No Photo Placeholder */}
            {!guestData.guest_photo && (
              <div className="md:col-span-2 flex justify-center">
                <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center border-4 border-gray-300">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="ml-4 flex items-center">
                  <Alert variant="warning" className="text-sm">
                    No photo available. Verify guest identity with ID.
                  </Alert>
                </div>
              </div>
            )}

            {/* Guest Details */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Guest Name</label>
                <p className="text-lg font-semibold text-gray-900">{guestData.guest_name}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Phone Number</label>
                <p className="text-sm text-gray-900">{guestData.guest_phone}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Purpose of Visit</label>
                <p className="text-sm text-gray-900">{guestData.purpose}</p>
              </div>
            </div>

            {/* Visit Details */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Visiting Student</label>
                <p className="text-sm text-gray-900">
                  {guestData.student_name || 'N/A'}
                  {guestData.room_number && (
                    <span className="text-gray-600"> (Room {guestData.room_number})</span>
                  )}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Visit Period</label>
                <p className="text-sm text-gray-900">
                  {formatDateTime(guestData.from_time)}
                </p>
                <p className="text-xs text-gray-600">
                  to {formatDateTime(guestData.to_time)}
                </p>
              </div>

              {guestData.entry_time && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Entry Time</label>
                  <p className="text-sm text-gray-900">{formatDateTime(guestData.entry_time)}</p>
                </div>
              )}

              {guestData.exit_time && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Exit Time</label>
                  <p className="text-sm text-gray-900">{formatDateTime(guestData.exit_time)}</p>
                </div>
              )}

              {guestData.current_status && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Current Status</label>
                  <p className={cn(
                    "text-sm font-medium",
                    guestData.current_status === 'inside' ? 'text-green-600' : 'text-gray-600'
                  )}>
                    {guestData.current_status === 'inside' ? 'Inside Hostel' : 'Outside Hostel'}
                  </p>
                </div>
              )}
            </div>

            {guestData.verification_code && (
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Verification Code</label>
                <p className="text-sm font-mono font-medium text-gray-900">
                  {guestData.verification_code}
                </p>
              </div>
            )}
          </div>

          {/* Time Validation */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center space-x-2 text-sm">
              <svg
                className={cn(
                  'h-4 w-4',
                  isEntryAllowed ? 'text-green-500' : 'text-red-500'
                )}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-gray-700">
                Current time: {new Date().toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            {isEntryAllowed ? (
              <>
                <Button
                  variant="primary"
                  onClick={onApproveEntry}
                  loading={loading}
                  className="flex-1"
                >
                  Approve Entry
                </Button>
                <Button
                  variant="secondary"
                  onClick={onDenyEntry}
                  disabled={loading}
                >
                  Deny Entry
                </Button>
              </>
            ) : isExitAllowed ? (
              <>
                <Button
                  variant="primary"
                  onClick={onApproveExit}
                  loading={loading}
                  className="flex-1"
                >
                  Record Exit
                </Button>
                <Button
                  variant="secondary"
                  onClick={onReset}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                onClick={onReset}
                disabled={loading}
                className="flex-1"
              >
                Scan Another Code
              </Button>
            )}
          </div>

          {/* Instructions */}
          {isEntryAllowed && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Security Checklist:</h4>
              <ul className="text-xs text-blue-800 space-y-1">
                <li>• Verify guest's identity with photo ID</li>
                <li>• Confirm guest photo matches (if available)</li>
                <li>• Check if guest has any prohibited items</li>
                <li>• Record entry time in the system</li>
              </ul>
            </div>
          )}

          {isExitAllowed && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-orange-900 mb-1">Exit Checklist:</h4>
              <ul className="text-xs text-orange-800 space-y-1">
                <li>• Confirm guest identity</li>
                <li>• Check for any hostel property</li>
                <li>• Record exit time in the system</li>
                <li>• Thank guest for visiting</li>
              </ul>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export { GuestVerification };