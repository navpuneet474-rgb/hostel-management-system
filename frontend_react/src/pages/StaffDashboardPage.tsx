import { useEffect, useState } from "react";
import { AppShell } from "../layouts/AppShell";
import {
  approveRequest,
  getDailySummary,
  getStaffDashboard,
  getStudentsPresentDetails,
  rejectRequest,
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
  List,
  Modal,
  Alert,
  LoadingSpinner,
  InputField
} from "../components/ui";
import type { Column } from "../components/ui";

interface RequestItem {
  id?: number;
  request_id?: string;
  student__name?: string;
  guest_name?: string;
  status?: string;
  created_at?: string;
  purpose?: string;
  from_time?: string;
  to_time?: string;
}

interface StudentItem {
  name: string;
  student_id: string;
  room_number: string;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant: "primary" | "danger";
  loading?: boolean;
}

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  confirmVariant,
  loading = false 
}: ConfirmationModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
    <div className="space-y-4">
      <p className="text-gray-700">{message}</p>
      <div className="flex justify-end space-x-3">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant={confirmVariant} 
          onClick={onConfirm} 
          disabled={loading}
        >
          {loading ? <LoadingSpinner size="sm" /> : confirmText}
        </Button>
      </div>
    </div>
  </Modal>
);

export const StaffDashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [guestRequests, setGuestRequests] = useState<RequestItem[]>([]);
  const [absenceRequests, setAbsenceRequests] = useState<RequestItem[]>([]);
  const [maintenanceRequests, setMaintenanceRequests] = useState<RequestItem[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RequestItem[]>([]);
  const [dailySummary, setDailySummary] = useState<Record<string, unknown> | null>(null);
  const [presentStudents, setPresentStudents] = useState<StudentItem[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Enhanced filtering and confirmation states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [requestTypeFilter, setRequestTypeFilter] = useState<string>("guest");
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    action: "approve" | "reject";
    item: RequestItem | null;
    requestType: string;
  }>({ isOpen: false, action: "approve", item: null, requestType: "guest" });
  
  // Recent activity state for subtask 9.2
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    type: string;
    message: string;
    timestamp: string;
    priority?: "high" | "medium" | "low";
  }>>([]);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getStaffDashboard();
      const data = result.data || {};
      setStats(data.stats || {});

      // Load all three types of requests
      const guestReqs = data.pending_requests?.guest_requests || [];
      const absenceReqs = data.pending_requests?.absence_requests || [];
      const maintenanceReqs = data.pending_requests?.maintenance_requests || [];

      setGuestRequests(guestReqs);
      setAbsenceRequests(absenceReqs);
      setMaintenanceRequests(maintenanceReqs);

      // Set filtered requests based on current filter
      updateFilteredRequests(requestTypeFilter, guestReqs, absenceReqs, maintenanceReqs);

      // Mock recent activity data for subtask 9.2
      const mockActivity = [
        {
          id: "1",
          type: "approval",
          message: "Guest request approved for John Doe",
          timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          priority: "medium" as const
        },
        {
          id: "2",
          type: "complaint",
          message: "New maintenance complaint submitted - Room 201",
          timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          priority: "high" as const
        },
        {
          id: "3",
          type: "leave",
          message: "Leave request submitted by Alice Smith",
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          priority: "low" as const
        }
      ];
      setRecentActivity(mockActivity);

    } catch (err) {
      setError("Unable to load staff dashboard");
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateFilteredRequests = (
    type: string,
    guestReqs: RequestItem[] = guestRequests,
    absenceReqs: RequestItem[] = absenceRequests,
    maintenanceReqs: RequestItem[] = maintenanceRequests
  ) => {
    switch (type) {
      case "guest":
        setFilteredRequests(guestReqs);
        break;
      case "absence":
        setFilteredRequests(absenceReqs);
        break;
      case "maintenance":
        setFilteredRequests(maintenanceReqs);
        break;
      default:
        setFilteredRequests(guestReqs);
    }
  };

  const loadDailySummary = async () => {
    try {
      const result = await getDailySummary();
      setDailySummary(result);
      setSummaryOpen(true);
    } catch (err) {
      setError("Unable to load daily summary");
      console.error("Daily summary error:", err);
    }
  };

  const loadPresentStudents = async () => {
    try {
      const result = await getStudentsPresentDetails();
      const list = result.data?.students || result.data || [];
      setPresentStudents(Array.isArray(list) ? list : []);
      setPresentOpen(true);
    } catch (err) {
      setError("Unable to load present students details");
      console.error("Present students error:", err);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  // Enhanced filtering logic
  useEffect(() => {
    let allRequests: RequestItem[] = [];

    // Get requests based on request type filter
    switch (requestTypeFilter) {
      case "guest":
        allRequests = guestRequests;
        break;
      case "absence":
        allRequests = absenceRequests;
        break;
      case "maintenance":
        allRequests = maintenanceRequests;
        break;
      default:
        allRequests = guestRequests;
    }

    let filtered = allRequests;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(request =>
        (request.guest_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.student__name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (request.purpose?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(request =>
        (request.status || "pending") === statusFilter
      );
    }

    setFilteredRequests(filtered);
  }, [guestRequests, absenceRequests, maintenanceRequests, searchTerm, statusFilter, requestTypeFilter]);

  const handleActionClick = (item: RequestItem, action: "approve" | "reject") => {
    setConfirmationModal({
      isOpen: true,
      action,
      item,
      requestType: requestTypeFilter
    });
  };

  const handleConfirmAction = async () => {
    const { action, item, requestType } = confirmationModal;
    if (!item) return;

    const actionId = `${item.request_id || item.id}-${action}`;
    setActionLoading(actionId);
    setError(null);

    try {
      const payload = { request_id: item.request_id || item.id, request_type: requestType };
      if (action === "approve") {
        await approveRequest(payload);
      } else {
        await rejectRequest(payload);
      }
      await loadDashboard();
      setConfirmationModal({ isOpen: false, action: "approve", item: null, requestType: "guest" });
    } catch (err) {
      setError(`Failed to ${action} request`);
      console.error(`${action} error:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (item: RequestItem, action: "approve" | "reject") => {
    const actionId = `${item.request_id || item.id}-${action}`;
    setActionLoading(actionId);
    setError(null);
    
    try {
      const payload = { request_id: item.request_id || item.id, request_type: "guest" };
      if (action === "approve") {
        await approveRequest(payload);
      } else {
        await rejectRequest(payload);
      }
      await loadDashboard();
    } catch (err) {
      setError(`Failed to ${action} request`);
      console.error(`${action} error:`, err);
    } finally {
      setActionLoading(null);
    }
  };

  const columns: Column<RequestItem>[] = [
    {
      key: 'guest_name',
      title: 'Guest Name',
      dataIndex: 'guest_name',
      sortable: true,
    },
    {
      key: 'student_name',
      title: 'Student',
      dataIndex: 'student__name',
      sortable: true,
    },
    {
      key: 'purpose',
      title: 'Purpose',
      dataIndex: 'purpose',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600 max-w-xs truncate block">
          {value || 'Not specified'}
        </span>
      ),
    },
    {
      key: 'time_range',
      title: 'Visit Time',
      render: (_, record) => {
        const fromTime = record.from_time ? new Date(record.from_time).toLocaleString() : '';
        const toTime = record.to_time ? new Date(record.to_time).toLocaleString() : '';
        return (
          <div className="text-sm">
            <div>{fromTime}</div>
            <div className="text-gray-500">to {toTime}</div>
          </div>
        );
      },
    },
    {
      key: 'created_at',
      title: 'Submitted',
      dataIndex: 'created_at',
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">
          {value ? new Date(value).toLocaleDateString() : 'Unknown'}
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (value) => (
        <Tag color={value === 'approved' ? 'success' : value === 'rejected' ? 'danger' : 'warning'}>
          {value || 'pending'}
        </Tag>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_, row) => {
        const approveId = `${row.request_id || row.id}-approve`;
        const rejectId = `${row.request_id || row.id}-reject`;
        
        return (
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleActionClick(row, "approve")}
              disabled={actionLoading === approveId}
            >
              {actionLoading === approveId ? <LoadingSpinner size="sm" /> : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleActionClick(row, "reject")}
              disabled={actionLoading === rejectId}
            >
              {actionLoading === rejectId ? <LoadingSpinner size="sm" /> : 'Reject'}
            </Button>
          </div>
        );
      },
    },
  ];

  // Icons using SVG
  const AlertIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );

  const CheckIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const TeamIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );

  const GuestIcon = () => (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );

  return (
    <AppShell title="Staff Dashboard">
      <div className="space-y-6">
        {/* Header Card */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Dashboard</CardTitle>
            <p className="text-gray-600">Review pending approvals, monitor occupancy, and track daily activity.</p>
          </CardHeader>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Pending Requests"
            value={stats.total_pending_requests || 0}
            icon={<AlertIcon />}
          />
          <StatCard
            title="Present Students"
            value={stats.present_students || 0}
            icon={<CheckIcon />}
          />
          <StatCard
            title="Total Students"
            value={stats.total_students || 0}
            icon={<TeamIcon />}
          />
          <StatCard
            title="Active Guests"
            value={stats.active_guests || 0}
            icon={<GuestIcon />}
          />
        </div>

        {/* Enhanced Guest Requests Table with Filtering */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>

            {/* Request Type Tabs */}
            <div className="flex space-x-2 mb-4 border-b border-gray-200">
              <button
                className={`px-4 py-2 font-medium transition-colors ${
                  requestTypeFilter === "guest"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setRequestTypeFilter("guest")}
              >
                Guest Requests ({guestRequests.length})
              </button>
              <button
                className={`px-4 py-2 font-medium transition-colors ${
                  requestTypeFilter === "absence"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setRequestTypeFilter("absence")}
              >
                Leave Requests ({absenceRequests.length})
              </button>
              <button
                className={`px-4 py-2 font-medium transition-colors ${
                  requestTypeFilter === "maintenance"
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-600 hover:text-gray-800"
                }`}
                onClick={() => setRequestTypeFilter("maintenance")}
              >
                Maintenance Requests ({maintenanceRequests.length})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search and Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="flex-1 max-w-sm">
                  <InputField
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  onClick={() => void loadPresentStudents()}
                >
                  Present Students
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void loadDailySummary()}
                >
                  Daily Summary
                </Button>
                <Button
                  variant="primary"
                  onClick={() => void loadDashboard()}
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size="sm" /> : 'Refresh'}
                </Button>
              </div>
            </div>

            {/* Filter Results Summary */}
            {(searchTerm || statusFilter !== "all") && (
              <div className="text-sm text-gray-600 mt-2">
                Showing {filteredRequests.length} of{" "}
                {requestTypeFilter === "guest"
                  ? guestRequests.length
                  : requestTypeFilter === "absence"
                  ? absenceRequests.length
                  : maintenanceRequests.length}{" "}
                requests
                {searchTerm && ` matching "${searchTerm}"`}
                {statusFilter !== "all" && ` with status "${statusFilter}"`}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                  }}
                  className="ml-2"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              dataSource={filteredRequests}
              rowKey={(record) => String(record.request_id || record.id)}
              loading={loading}
              emptyText={
                searchTerm || statusFilter !== "all"
                  ? "No requests match your filters"
                  : `No pending ${requestTypeFilter} requests`
              }
            />
          </CardContent>
        </Card>

        {/* Enhanced Bottom Section with Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Feed - New for subtask 9.2 */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <p className="text-sm text-gray-600">Latest actions and updates</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                      activity.priority === 'high' ? 'bg-red-500' :
                      activity.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <p className="text-gray-500 text-center py-4 text-sm">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions - Enhanced for subtask 9.2 */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <p className="text-sm text-gray-600">Common administrative tasks</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full justify-start"
                  onClick={() => void loadDailySummary()}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Daily Report
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => void loadPresentStudents()}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  View Present Students
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("pending");
                  }}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View Pending Requests
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
                  onClick={() => void loadDashboard()}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Summary Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Summary Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {dailySummary ? (
                <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded overflow-auto max-h-64">
                  {JSON.stringify(dailySummary, null, 2)}
                </pre>
              ) : (
                <p className="text-gray-500">Load summary to view latest report.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Summary Modal */}
        <Modal
          isOpen={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          title="Daily Summary"
          size="lg"
        >
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(dailySummary, null, 2)}
          </pre>
        </Modal>

        {/* Present Students Modal */}
        <Modal
          isOpen={presentOpen}
          onClose={() => setPresentOpen(false)}
          title="Present Students"
          size="lg"
        >
          <List>
            {presentStudents.map((student, index) => (
              <List.Item key={student.student_id || index}>
                <List.Item.Meta
                  title={student.name || "Unknown"}
                  description={`${student.student_id || "N/A"} · Room ${student.room_number || "N/A"}`}
                />
              </List.Item>
            ))}
          </List>
          {presentStudents.length === 0 && (
            <p className="text-gray-500 text-center py-8">No students present</p>
          )}
        </Modal>

        {/* Confirmation Modal for Actions */}
        <ConfirmationModal
          isOpen={confirmationModal.isOpen}
          onClose={() => setConfirmationModal({ isOpen: false, action: "approve", item: null, requestType: "guest" })}
          onConfirm={handleConfirmAction}
          title={`${confirmationModal.action === "approve" ? "Approve" : "Reject"} ${
            confirmationModal.requestType === "guest"
              ? "Guest Request"
              : confirmationModal.requestType === "absence"
              ? "Leave Request"
              : "Maintenance Request"
          }`}
          message={
            confirmationModal.item
              ? `Are you sure you want to ${confirmationModal.action} this ${confirmationModal.requestType} request?`
              : ""
          }
          confirmText={confirmationModal.action === "approve" ? "Approve" : "Reject"}
          confirmVariant={confirmationModal.action === "approve" ? "primary" : "danger"}
          loading={actionLoading !== null}
        />
      </div>
    </AppShell>
  );
};
