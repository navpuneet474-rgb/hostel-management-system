import { useEffect, useState } from "react";
import { AppShell } from "../layouts/AppShell";
import {
  activateEmergencyMode,
  bulkVerifyPasses,
  getRecentVerifications,
  getSecurityActivePasses,
  getSecurityStats,
  searchStudentPasses,
  verifyPass,
  verifyGuestCode,
  recordGuestEntry,
  getActiveGuests,
  getGuestEntryLog,
} from "../api/endpoints";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  DataTable,
  Tag,
  InputField,
  Alert,
  LoadingSpinner,
  QRScanner,
  GuestVerification,
  ActiveGuestsList,
  EntryExitLog,
  VerificationHistory,
  Modal,
} from "../components/ui";
import type { Column } from "../components/ui";
import type { GuestVerificationData } from "../components/ui/QRScanner";

interface VerificationItem {
  student_id?: string;
  student_name?: string;
  pass_number?: string;
  status?: string;
  verification_time?: string;
}

interface ActivePassItem {
  pass_number?: string;
  student_name?: string;
  status?: string;
  to_date?: string;
}

interface SearchResultItem {
  student_id?: string;
  name?: string;
  room_number?: string;
  has_active_pass?: boolean;
}

export const SecurityDashboardPage = () => {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [activePasses, setActivePasses] = useState<ActivePassItem[]>([]);
  const [recentVerifications, setRecentVerifications] = useState<VerificationItem[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passNumber, setPassNumber] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [emergencyLoading, setEmergencyLoading] = useState(false);
  
  // QR Scanner and Guest Verification states
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [guestData, setGuestData] = useState<GuestVerificationData | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSecurityStats();
      setStats(result.stats || result || {});
      
      const activeResult = await getSecurityActivePasses();
      const recentResult = await getRecentVerifications();
      
      setActivePasses(activeResult.active_passes || []);
      setRecentVerifications(recentResult.recent_verifications || []);
    } catch (err) {
      setError("Unable to load security stats");
      console.error("Security stats error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      void load();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleVerifyPass = async () => {
    if (!passNumber.trim()) {
      setError("Please enter a pass number");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const result = await verifyPass(passNumber.trim());
      setError(null);
      // Show success message
      setPassNumber("");
      await load();
    } catch (err) {
      setError("Verification failed");
      console.error("Verification error:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleBulkVerify = async () => {
    if (!passNumber.trim()) {
      setError("Enter comma-separated pass numbers in verify field first");
      return;
    }

    const passNumbers = passNumber.split(",").map((v) => v.trim()).filter(Boolean);
    if (!passNumbers.length) {
      setError("Enter comma-separated pass numbers in verify field first");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      await bulkVerifyPasses(passNumbers);
      setPassNumber("");
      await load();
    } catch (err) {
      setError("Bulk verification failed");
      console.error("Bulk verification error:", err);
    } finally {
      setVerifying(false);
    }
  };

  const handleEmergencyMode = async () => {
    setEmergencyLoading(true);
    setError(null);
    try {
      await activateEmergencyMode({
        emergency_type: "general_emergency",
        description: "Activated from React dashboard",
        activated_by: "Security Personnel",
      });
    } catch (err) {
      setError("Emergency activation failed");
      console.error("Emergency activation error:", err);
    } finally {
      setEmergencyLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setError(null);
    try {
      const result = await searchStudentPasses(searchQuery.trim());
      setSearchResults(result.students || []);
    } catch (err) {
      setError("Search failed");
      console.error("Search error:", err);
    }
  };

  // QR Scanner and Guest Verification handlers
  const handleQRScan = async (qrData: string) => {
    setVerificationLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await verifyGuestCode(qrData);
      setGuestData(result.guest_data || result);
      setShowQRScanner(false);
    } catch (err) {
      setError("Failed to verify QR code. Please try manual input.");
      console.error("QR verification error:", err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleManualVerification = async () => {
    if (!manualCode.trim()) {
      setError("Please enter a verification code");
      return;
    }

    setVerificationLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await verifyGuestCode(manualCode.trim());
      setGuestData(result.guest_data || result);
      setManualCode("");
      setShowManualInput(false);
    } catch (err) {
      setError("Invalid verification code");
      console.error("Manual verification error:", err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    if (!guestData?.id) return;

    setVerificationLoading(true);
    setError(null);
    
    try {
      await recordGuestEntry({
        guest_id: guestData.id,
        verification_code: guestData.verification_code || '',
        action: 'entry'
      });
      
      setSuccess("Guest entry recorded successfully");
      setGuestData(null);
      await load(); // Refresh data
    } catch (err) {
      setError("Failed to record guest entry");
      console.error("Guest entry error:", err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleGuestExit = async () => {
    if (!guestData?.id) return;

    setVerificationLoading(true);
    setError(null);
    
    try {
      await recordGuestEntry({
        guest_id: guestData.id,
        verification_code: guestData.verification_code || '',
        action: 'exit'
      });
      
      setSuccess("Guest exit recorded successfully");
      setGuestData(null);
      await load(); // Refresh data
    } catch (err) {
      setError("Failed to record guest exit");
      console.error("Guest exit error:", err);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleDenyEntry = () => {
    setGuestData(null);
    setError("Entry denied by security personnel");
  };

  const handleResetVerification = () => {
    setGuestData(null);
    setError(null);
    setSuccess(null);
  };

  const recentVerificationsColumns: Column<VerificationItem>[] = [
    {
      key: 'student_name',
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
      title: 'Pass',
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
        <Tag color={value === 'verified' ? 'success' : value === 'expired' ? 'danger' : 'warning'}>
          {value || 'unknown'}
        </Tag>
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
  ];

  const activePassesColumns: Column<ActivePassItem>[] = [
    {
      key: 'pass_number',
      title: 'Pass',
      dataIndex: 'pass_number',
      sortable: true,
    },
    {
      key: 'student_name',
      title: 'Student',
      dataIndex: 'student_name',
      sortable: true,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      render: (value) => (
        <Tag color={value === 'active' ? 'success' : value === 'expired' ? 'danger' : 'warning'}>
          {value || 'unknown'}
        </Tag>
      ),
    },
    {
      key: 'to_date',
      title: 'Valid Till',
      dataIndex: 'to_date',
      sortable: true,
    },
  ];

  const searchResultsColumns: Column<SearchResultItem>[] = [
    {
      key: 'name',
      title: 'Student',
      dataIndex: 'name',
      sortable: true,
      render: (value, record) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-sm text-gray-500">ID: {record.student_id}</div>
        </div>
      ),
    },
    {
      key: 'room_number',
      title: 'Room',
      dataIndex: 'room_number',
      sortable: true,
      render: (value) => (
        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          {value}
        </span>
      ),
    },
    {
      key: 'has_active_pass',
      title: 'Pass Status',
      dataIndex: 'has_active_pass',
      render: (value, record) => (
        <div className="flex flex-col space-y-1">
          <Tag color={value ? 'success' : 'default'}>
            {value ? 'Active Pass' : 'No Active Pass'}
          </Tag>
          {value && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPassNumber(record.student_id || '');
                void handleVerifyPass();
              }}
            >
              Quick Verify
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Icons using SVG
  const SafetyIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );

  const SearchIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );

  const ExportIcon = () => (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );

  return (
    <AppShell title="Security Dashboard">
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle>Security Dashboard</CardTitle>
            <p className="text-gray-600">QR verification, guest management, and security controls.</p>
          </CardHeader>
        </Card>

        {/* Error and Success Alerts */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert variant="success" dismissible onDismiss={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Active Passes"
            value={stats.active_passes || 0}
          />
          <StatCard
            title="Students Away"
            value={stats.students_away || 0}
          />
          <StatCard
            title="Active Guests"
            value={stats.active_guests || 0}
          />
          <StatCard
            title="Verifications Today"
            value={stats.total_verifications || 0}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - QR Scanner and Verification */}
          <div className="lg:col-span-2 space-y-6">
            {/* Enhanced QR Scanner Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m6-4h.01M12 8h.01M12 8h-4.01M12 8V4m6 4h.01m-6 0h2m-2 0h-2m2 0V4m6 4V4m0 0h2m-2 0h-2m2 0v4m0-4h-2" />
                  </svg>
                  <span>Guest QR Verification</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!showQRScanner && !guestData && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="primary"
                        onClick={() => setShowQRScanner(true)}
                        className="flex-1"
                      >
                        <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M12 12h-4.01M12 12v4m6-4h.01M12 8h.01M12 8h-4.01M12 8V4m6 4h.01m-6 0h2m-2 0h-2m2 0V4m6 4V4m0 0h2m-2 0h-2m2 0v4m0-4h-2" />
                        </svg>
                        Scan QR Code
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowManualInput(true)}
                        className="flex-1"
                      >
                        Manual Code Entry
                      </Button>
                    </div>
                  )}

                  {showQRScanner && (
                    <div className="space-y-4">
                      <QRScanner
                        onScan={handleQRScan}
                        onError={(error) => setError(error)}
                        isActive={showQRScanner}
                      />
                      <Button
                        variant="secondary"
                        onClick={() => setShowQRScanner(false)}
                        className="w-full"
                      >
                        Cancel Scanning
                      </Button>
                    </div>
                  )}

                  {showManualInput && (
                    <div className="space-y-4">
                      <div className="flex space-x-2">
                        <InputField
                          placeholder="Enter verification code"
                          value={manualCode}
                          onChange={(e) => setManualCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              void handleManualVerification();
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          variant="primary"
                          onClick={handleManualVerification}
                          loading={verificationLoading}
                        >
                          Verify
                        </Button>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowManualInput(false);
                          setManualCode("");
                        }}
                        className="w-full"
                      >
                        Cancel
                      </Button>
                    </div>
                  )}

                  {guestData && (
                    <GuestVerification
                      guestData={guestData}
                      loading={verificationLoading}
                      onApproveEntry={handleGuestEntry}
                      onApproveExit={handleGuestExit}
                      onDenyEntry={handleDenyEntry}
                      onReset={handleResetVerification}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Digital Pass Verification */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SafetyIcon />
                  <span>Digital Pass Verification</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <InputField
                        placeholder="LP-2026..."
                        value={passNumber}
                        onChange={(e) => setPassNumber(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleVerifyPass();
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleVerifyPass}
                      disabled={verifying}
                    >
                      {verifying ? <LoadingSpinner size="sm" /> : 'Verify'}
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={handleBulkVerify}
                      disabled={verifying}
                    >
                      Bulk Verify
                    </Button>
                    <Button
                      variant="danger"
                      onClick={handleEmergencyMode}
                      disabled={emergencyLoading}
                    >
                      {emergencyLoading ? <LoadingSpinner size="sm" /> : 'Emergency Mode'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => window.open('/api/security/export-report/', '_blank')}
                    >
                      <ExportIcon />
                      <span className="ml-1">Export Report</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Search Student Passes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <SearchIcon />
                  <span>Search Student Passes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <InputField
                        placeholder="Student name or ID"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            void handleSearch();
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="primary"
                      onClick={handleSearch}
                    >
                      Search
                    </Button>
                  </div>
                  
                  {searchResults.length > 0 && (
                    <DataTable
                      columns={searchResultsColumns}
                      dataSource={searchResults}
                      rowKey={(record) => String(record.student_id || Math.random())}
                      size="small"
                      emptyText="No search results"
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Active Guests and Logs */}
          <div className="space-y-6">
            {/* Active Guests with Expiry Alerts */}
            <ActiveGuestsList 
              onGuestSelect={(guest) => {
                // Convert ActiveGuest to GuestVerificationData format
                const guestVerificationData: GuestVerificationData = {
                  id: guest.id,
                  guest_name: guest.guest_name,
                  guest_phone: guest.guest_phone,
                  purpose: "Visit", // Default purpose
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
              }}
            />

            {/* Recent Verifications */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Verifications</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={recentVerificationsColumns}
                  dataSource={recentVerifications}
                  rowKey={(record) => `${String(record.student_id || "unknown")}-${String(record.verification_time || Math.random())}`}
                  size="small"
                  loading={loading}
                  emptyText="No recent verifications"
                  pagination={{
                    current: 1,
                    pageSize: 5,
                    total: recentVerifications.length,
                    onChange: () => {}
                  }}
                />
              </CardContent>
            </Card>

            {/* Active Passes */}
            <Card>
              <CardHeader>
                <CardTitle>Active Passes</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={activePassesColumns}
                  dataSource={activePasses}
                  rowKey={(record) => String(record.pass_number || Math.random())}
                  size="small"
                  loading={loading}
                  pagination={{
                    current: 1,
                    pageSize: 5,
                    total: activePasses.length,
                    onChange: () => {}
                  }}
                  emptyText="No active passes"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Entry/Exit Log and Verification History - Full Width */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EntryExitLog limit={10} />
          <VerificationHistory limit={20} />
        </div>
      </div>
    </AppShell>
  );
};
