import React, { useState } from 'react';
import { QRScanner } from '../components/ui/QRScanner';
import { GuestVerification, type GuestVerificationData } from '../components/ui/GuestVerification';
import { ActiveGuestsList, type ActiveGuest } from '../components/ui/ActiveGuestsList';
import { EntryExitLog } from '../components/ui/EntryExitLog';
import { InputField, Button, Alert, Card } from '../components/ui';
import { verifyGuestCode, recordGuestEntry } from '../api/endpoints';

const QRVerificationPage: React.FC = () => {
  const [guestData, setGuestData] = useState<GuestVerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualCode, setManualCode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [scannerActive, setScannerActive] = useState(true);
  const [activeTab, setActiveTab] = useState<'scanner' | 'guests' | 'log'>('scanner');

  const verifyGuestCodeHandler = async (code: string) => {
    setLoading(true);
    setError('');

    try {
      // Call real backend API for guest verification
      const result = await verifyGuestCode(code);
      
      // Map backend response to frontend data structure
      const guestData: GuestVerificationData = {
        id: result.id,
        guest_name: result.guest_name,
        guest_phone: result.guest_phone,
        purpose: result.purpose,
        from_time: result.from_time,
        to_time: result.to_time,
        student_name: result.student_name,
        room_number: result.room_number,
        status: result.status,
        guest_photo: result.guest_photo,
        verification_code: code,
        entry_time: result.entry_time,
        exit_time: result.exit_time,
        current_status: result.current_status
      };

      setGuestData(guestData);
      setScannerActive(false);
    } catch (error) {
      console.error('Error verifying guest code:', error);
      
      // Handle different error types based on backend response
      if (error instanceof Error) {
        if (error.message.includes('expired') || error.message.includes('404')) {
          setGuestData({
            guest_name: 'Unknown Guest',
            guest_phone: 'N/A',
            purpose: 'N/A',
            from_time: '',
            to_time: '',
            status: 'expired',
            verification_code: code
          });
        } else if (error.message.includes('invalid') || error.message.includes('400')) {
          setGuestData({
            guest_name: 'Unknown Guest',
            guest_phone: 'N/A',
            purpose: 'N/A',
            from_time: '',
            to_time: '',
            status: 'invalid',
            verification_code: code
          });
        } else {
          setError('Failed to verify guest code. Please check your connection and try again.');
        }
      } else {
        setError('Failed to verify guest code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (result: string) => {
    verifyGuestCodeHandler(result);
  };

  const handleManualVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      verifyGuestCodeHandler(manualCode.trim());
    }
  };

  const handleApproveEntry = async () => {
    if (!guestData?.id || !guestData?.verification_code) {
      setError('Missing guest information for entry recording.');
      return;
    }

    setLoading(true);
    try {
      // Record entry in backend
      await recordGuestEntry({
        guest_id: guestData.id,
        verification_code: guestData.verification_code,
        action: 'entry'
      });
      
      // Update guest data to show entry recorded
      setGuestData({
        ...guestData,
        status: 'already_entered',
        entry_time: new Date().toISOString(),
        current_status: 'inside'
      });
      
      // Show success message and auto-reset after delay
      setError('');
      setTimeout(() => {
        handleReset();
      }, 3000);
    } catch (error) {
      console.error('Error recording entry:', error);
      setError('Failed to record entry. Please try again or contact IT support.');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveExit = async () => {
    if (!guestData?.id || !guestData?.verification_code) {
      setError('Missing guest information for exit recording.');
      return;
    }

    setLoading(true);
    try {
      // Record exit in backend
      await recordGuestEntry({
        guest_id: guestData.id,
        verification_code: guestData.verification_code,
        action: 'exit'
      });
      
      // Update guest data to show exit recorded
      setGuestData({
        ...guestData,
        status: 'exited',
        exit_time: new Date().toISOString(),
        current_status: 'outside'
      });
      
      // Show success message and auto-reset after delay
      setError('');
      setTimeout(() => {
        handleReset();
      }, 3000);
    } catch (error) {
      console.error('Error recording exit:', error);
      setError('Failed to record exit. Please try again or contact IT support.');
    } finally {
      setLoading(false);
    }
  };

  const handleDenyEntry = () => {
    // Log denial reason (in real app, might show a modal for reason)
    console.log('Entry denied for guest:', guestData?.guest_name);
    
    // Could add API call to log denial reason
    // await recordGuestDenial({ guest_id: guestData.id, reason: 'Security concern' });
    
    handleReset();
  };

  const handleReset = () => {
    setGuestData(null);
    setError('');
    setManualCode('');
    setShowManualInput(false);
    setScannerActive(true);
  };

  const handleScannerError = (error: string) => {
    setError(error);
    setShowManualInput(true);
  };

  const handleActiveGuestSelect = (guest: ActiveGuest) => {
    // Convert ActiveGuest to GuestVerificationData for display
    const guestVerificationData: GuestVerificationData = {
      id: guest.id,
      guest_name: guest.guest_name,
      guest_phone: guest.guest_phone,
      purpose: 'Visit', // Default purpose
      from_time: guest.entry_time,
      to_time: guest.expires_at,
      student_name: guest.student_name,
      room_number: guest.room_number,
      status: guest.status === 'expired' ? 'expired' : 'already_entered',
      verification_code: guest.verification_code,
      entry_time: guest.entry_time,
      current_status: guest.status === 'inside' ? 'inside' : 'outside'
    };
    
    setGuestData(guestVerificationData);
    setActiveTab('scanner');
    setScannerActive(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Guest Entry Verification
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Scan QR code or enter verification code manually to verify guest entry
          </p>
        </div>

        {error && (
          <div className="mb-6">
            <Alert variant="error" dismissible onDismiss={() => setError('')}>
              {error}
            </Alert>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('scanner')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'scanner'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              QR Scanner
            </button>
            <button
              onClick={() => setActiveTab('guests')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'guests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Guests
            </button>
            <button
              onClick={() => setActiveTab('log')}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'log'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Entry/Exit Log
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Scanner Section */}
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  QR Code Scanner
                </h2>
                
                {scannerActive && !guestData && (
                  <QRScanner
                    onScan={handleQRScan}
                    onError={handleScannerError}
                    isActive={scannerActive}
                  />
                )}

                {guestData && (
                  <div className="text-center py-8">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                      <svg
                        className="h-6 w-6 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-600">
                      Code scanned successfully
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handleReset}
                      className="mt-4"
                    >
                      Scan Another Code
                    </Button>
                  </div>
                )}
              </Card>

              {/* Manual Input Section */}
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Manual Verification
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowManualInput(!showManualInput)}
                  >
                    {showManualInput ? 'Hide' : 'Show'} Manual Input
                  </Button>
                </div>

                {showManualInput && (
                  <form onSubmit={handleManualVerification} className="space-y-4">
                    <InputField
                      label="Verification Code"
                      placeholder="Enter 8-character code"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      maxLength={8}
                      className="font-mono"
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={!manualCode.trim() || loading}
                      className="w-full"
                    >
                      Verify Code
                    </Button>
                  </form>
                )}

                {!showManualInput && (
                  <p className="text-sm text-gray-600">
                    Use manual input if QR scanner is not working or guest doesn't have QR code
                  </p>
                )}
              </Card>
            </div>

            {/* Verification Results Section */}
            <div>
              {guestData ? (
                <GuestVerification
                  guestData={guestData}
                  loading={loading}
                  onApproveEntry={handleApproveEntry}
                  onApproveExit={handleApproveExit}
                  onDenyEntry={handleDenyEntry}
                  onReset={handleReset}
                />
              ) : (
                <Card className="p-8 text-center">
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Guest Scanned
                  </h3>
                  <p className="text-sm text-gray-600">
                    Scan a QR code or enter a verification code to see guest details
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}

        {activeTab === 'guests' && (
          <ActiveGuestsList onGuestSelect={handleActiveGuestSelect} />
        )}

        {activeTab === 'log' && (
          <EntryExitLog />
        )}

        {/* Quick Actions */}
        <div className="mt-8">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Quick Actions</h3>
                <p className="text-xs text-gray-600">Common security tasks</p>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab('guests')}
                >
                  View Active Guests
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setActiveTab('log')}
                >
                  Entry Log
                </Button>
                <Button variant="outline" size="sm">
                  Emergency Mode
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default QRVerificationPage;