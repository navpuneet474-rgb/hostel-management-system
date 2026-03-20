import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { getStudentDashboardData, submitLeaveRequest } from "../api/endpoints";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatCard,
  ActivityItem,
  Modal,
  Alert,
  LoadingSpinner,
  LeaveRequestForm,
  NotificationContainer,
} from "../components/ui";
import { useDashboardData, useAsyncOperation, useNotifications } from "../hooks";
import type { LeaveRequestData } from "../components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRecord {
  id?: number;
  request_id?: string;
  absence_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  guest_name?: string;
  issue_type?: string;
  pass_number?: string;
  from_date?: string;
  to_date?: string;
  start_date?: string;
  end_date?: string;
  reason?: string;
  purpose?: string;
  download_url?: string;
  file_url?: string;
  pdf_url?: string;
  pass_url?: string;
  _type?: string;
  [key: string]: unknown;
}

// ─── Pure helpers (defined once, never re-created) ───────────────────────────

const normalizeItems = (
  source: unknown,
  nestedListKeys: string[] = []
): ItemRecord[] => {
  const collectFromObject = (
    value: Record<string, unknown>,
    preferredKeys: string[],
    depth: number
  ): ItemRecord[] => {
    if (depth > 4) return [];
    for (const key of preferredKeys) {
      const candidate = value[key];
      if (Array.isArray(candidate)) return candidate as ItemRecord[];
      if (candidate && typeof candidate === "object") {
        const nested = collectFromObject(
          candidate as Record<string, unknown>,
          preferredKeys,
          depth + 1
        );
        if (nested.length > 0) return nested;
      }
    }
    for (const candidate of Object.values(value)) {
      if (Array.isArray(candidate)) return candidate as ItemRecord[];
      if (candidate && typeof candidate === "object") {
        const nested = collectFromObject(
          candidate as Record<string, unknown>,
          preferredKeys,
          depth + 1
        );
        if (nested.length > 0) return nested;
      }
    }
    return [];
  };

  if (Array.isArray(source)) return source as ItemRecord[];
  if (source && typeof source === "object") {
    const preferredKeys = [
      ...nestedListKeys,
      "results",
      "items",
      "data",
      "records",
      "list",
      "rows",
    ];
    return collectFromObject(
      source as Record<string, unknown>,
      preferredKeys,
      0
    );
  }
  return [];
};

const normalizeStatus = (status?: string) => (status || "").toLowerCase();

const parseTime = (value?: string) => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

const sortByLatest = (items: ItemRecord[]): ItemRecord[] =>
  [...items].sort(
    (a, b) =>
      parseTime(b.created_at || b.updated_at) -
      parseTime(a.created_at || a.updated_at)
  );

const isPendingStatus = (status?: string) =>
  ["pending", "submitted", "assigned", "in_progress"].includes(
    normalizeStatus(status)
  );

const isRejectedStatus = (status?: string) =>
  ["rejected", "cancelled", "failed"].includes(normalizeStatus(status));

const isActiveStatus = (status?: string) =>
  ["active", "approved"].includes(normalizeStatus(status));

const getStatusColor = (
  status: string
): "success" | "pending" | "error" | "info" => {
  if (isActiveStatus(status)) return "success";
  if (isPendingStatus(status)) return "pending";
  if (isRejectedStatus(status)) return "error";
  return "info";
};

const getStatusBadgeClasses = (status: string) => {
  switch (getStatusColor(status)) {
    case "success":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "error":
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
    default:
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }
};

const formatStatusLabel = (status?: string) => {
  if (!status) return "Pending";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "Recently";
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) return "Recently";
  return parsed.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateRange = (item: ItemRecord) => {
  const from = item.from_date || item.start_date;
  const to = item.to_date || item.end_date;
  if (!from && !to) return "Date not available";
  if (from && !to) return `From ${formatDate(from)}`;
  if (!from && to) return `Until ${formatDate(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
};

const getPassId = (item: ItemRecord) =>
  item.pass_number || `PASS-${item.id ?? "N/A"}`;

const getPassDownloadLink = (item: ItemRecord): string | null => {
  const c = item.download_url || item.file_url || item.pdf_url || item.pass_url;
  return typeof c === "string" && c.length > 0 ? c : null;
};

// ─── Sub-components (stable, no inline definitions) ──────────────────────────

interface PassCardProps {
  pass: ItemRecord;
  index: number;
  onView: () => void;
}

const PassCard = ({ pass, index, onView }: PassCardProps) => {
  const status = pass.status || "pending";
  const downloadLink = getPassDownloadLink(pass);
  const isActive = isActiveStatus(status);

  return (
    <div
      key={`${pass.id ?? pass.pass_number ?? index}-${pass.created_at ?? ""}`}
      className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-sm ${
        isActive
          ? "border-emerald-100 bg-emerald-50/30"
          : "border-amber-100 bg-amber-50/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {getPassId(pass)}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatDateRange(pass)}</p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClasses(
            status
          )}`}
        >
          {formatStatusLabel(status)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onView}>
          View
        </Button>
        {downloadLink ? (
          <a
            href={downloadLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download
          </a>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            Download
          </Button>
        )}
      </div>
    </div>
  );
};

interface PendingGroupProps {
  label: string;
  count: number;
  ctaLabel: string;
  onClick: () => void;
  latestItem?: ItemRecord;
  icon: React.ReactNode;
}

const PendingGroup = ({
  label,
  count,
  ctaLabel,
  onClick,
  latestItem,
  icon,
}: PendingGroupProps) => (
  <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-4 hover:bg-gray-50 transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-500 shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {count > 0 && latestItem ? (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            Latest: {formatDate(latestItem.created_at)}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-0.5">
            {count === 0 ? "No pending items" : `${count} pending`}
          </p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 ml-3">
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold px-1.5">
          {count}
        </span>
      )}
      <Button variant="secondary" size="sm" onClick={onClick}>
        {ctaLabel}
      </Button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

export const StudentDashboardPage = () => {
  const navigate = useNavigate();
  const notifications = useNotifications();
  const [isLeaveOpen, setLeaveOpen] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const {
    data: dashboardData,
    loading,
    error: dataError,
    refresh,
    lastUpdated,
    isAutoRefreshActive,
  } = useDashboardData(getStudentDashboardData, {
    onError: (error) =>
      notifications.error(`Failed to load dashboard: ${error.message}`),
    onSuccess: () => notifications.info("Dashboard updated", { duration: 2000 }),
  });

  const leaveSubmission = useAsyncOperation({
    successMessage: "Leave request submitted successfully!",
    errorMessage: "Failed to submit leave request. Please try again.",
    onSuccess: () => {
      setLeaveOpen(false);
      void refresh();
    },
  });

  // ── Stable raw lists (only recomputed when dashboardData changes) ──────────

  const passes = useMemo(
    () => normalizeItems(dashboardData?.passes, ["passes", "items"]),
    [dashboardData?.passes]
  );
  const absences = useMemo(
    () =>
      normalizeItems(dashboardData?.absences, ["absences", "requests", "items"]),
    [dashboardData?.absences]
  );
  const guests = useMemo(
    () => normalizeItems(dashboardData?.guests, ["guests", "requests", "items"]),
    [dashboardData?.guests]
  );
  const maintenance = useMemo(
    () =>
      normalizeItems(dashboardData?.maintenance, [
        "maintenance",
        "requests",
        "items",
      ]),
    [dashboardData?.maintenance]
  );

  // ── Derived: passes ────────────────────────────────────────────────────────

  const activePasses = useMemo(
    () => sortByLatest(passes.filter((p) => isActiveStatus(p.status))),
    [passes]
  );

  const pendingPasses = useMemo(
    () => sortByLatest(passes.filter((p) => isPendingStatus(p.status))),
    [passes]
  );

  /** All pass display items: active first, then pending, then the rest */
  const passDisplayItems = useMemo(() => {
    const pendingPassRequests = sortByLatest(absences).map(
      (absence, index) => ({
        ...absence,
        pass_number:
          absence.pass_number ||
          `REQ-${absence.absence_id ||
            absence.request_id ||
            absence.id ||
            index + 1}`,
      })
    );

    const merged = [...passes, ...pendingPassRequests];
    const seen = new Set<string>();

    return sortByLatest(merged)
      .filter((item) => {
        const key = `${item.pass_number ?? ""}-${item.absence_id ?? ""}-${item.request_id ?? ""}-${item.created_at ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 6);
  }, [passes, absences]);

  // ── Derived: pending requests ──────────────────────────────────────────────

  const uniquePendingLeaves = useMemo(() => {
    const combined = [...passes, ...absences].filter((item) =>
      isPendingStatus(item.status)
    );
    const seen = new Set<string>();
    return sortByLatest(combined).filter((item) => {
      const key = `${item.id ?? ""}-${item.pass_number ?? ""}-${item.created_at ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [passes, absences]);

  const pendingGuests = useMemo(
    () => sortByLatest(guests.filter((item) => isPendingStatus(item.status))),
    [guests]
  );

  const pendingMaintenance = useMemo(
    () =>
      sortByLatest(maintenance.filter((item) => isPendingStatus(item.status))),
    [maintenance]
  );

  // ── Derived: stats ─────────────────────────────────────────────────────────

  const activePassCount = activePasses.length;

  const totalPendingRequests = useMemo(
    () =>
      uniquePendingLeaves.length +
      pendingGuests.length +
      pendingMaintenance.length,
    [uniquePendingLeaves, pendingGuests, pendingMaintenance]
  );

  const openIssuesCount = useMemo(
    () =>
      maintenance.filter(
        (item) =>
          !["resolved", "completed", "closed"].includes(
            normalizeStatus(item.status)
          )
      ).length,
    [maintenance]
  );

  // ── Derived: recent activity ───────────────────────────────────────────────

  const recentActivity = useMemo(
    () =>
      sortByLatest([
        ...guests.map((item) => ({ ...item, _type: "guest" })),
        ...passes.map((item) => ({ ...item, _type: "pass" })),
        ...maintenance.map((item) => ({ ...item, _type: "maintenance" })),
      ]).slice(0, 5),
    [guests, passes, maintenance]
  );

  const hasAnyActivity =
    passes.length > 0 ||
    guests.length > 0 ||
    maintenance.length > 0 ||
    absences.length > 0;

  // ── Stable handlers (useCallback prevents child re-renders) ───────────────

  const handleOpenLeave = useCallback(() => setLeaveOpen(true), []);
  const handleCloseLeave = useCallback(() => setLeaveOpen(false), []);
  const handleNavigateGuests = useCallback(
    () => navigate("/guest-requests"),
    [navigate]
  );
  const handleNavigateComplaints = useCallback(
    () => navigate("/complaints"),
    [navigate]
  );
  const handleNavigateProfile = useCallback(
    () => navigate("/student/profile"),
    [navigate]
  );
  const handleNavigateLeaveRequests = useCallback(
    () => navigate("/leave-requests"),
    [navigate]
  );
  const handleRefresh = useCallback(() => void refresh(), [refresh]);

  const handleLeaveSubmit = useCallback(
    async (data: LeaveRequestData) => {
      const formData = new FormData();
      formData.append("from_date", data.from_date);
      formData.append("to_date", data.to_date);
      formData.append("reason", data.reason);
      if (data.emergency) formData.append("emergency", "true");
      data.supporting_documents?.forEach((file, i) =>
        formData.append(`supporting_document_${i}`, file)
      );
      await leaveSubmission.execute(() =>
        submitLeaveRequest(formData as unknown as Record<string, unknown>)
      );
    },
    [leaveSubmission]
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        isLeaveOpen ||
        ["INPUT", "TEXTAREA"].includes(
          (event.target as HTMLElement)?.tagName
        )
      )
        return;
      switch (event.key.toLowerCase()) {
        case "l":
          event.preventDefault();
          setLeaveOpen(true);
          break;
        case "g":
          event.preventDefault();
          navigate("/guest-requests");
          break;
        case "m":
          event.preventDefault();
          navigate("/complaints");
          break;
        case "p":
          event.preventDefault();
          navigate("/student/profile");
          break;
        case "r":
          event.preventDefault();
          void refresh();
          break;
      }
    };
    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isLeaveOpen, navigate, refresh]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Student Dashboard">
      <NotificationContainer
        notifications={notifications.notifications}
        onRemove={notifications.removeNotification}
        position="top-right"
      />

      <div className="space-y-6 pb-8 max-w-5xl mx-auto">

        {/* ── Error Banner ─────────────────────────────────────────────────── */}
        {dataError && (
          <Alert variant="error" title="Unable to load dashboard" dismissible>
            <div className="flex items-center gap-3">
              <p className="text-sm">{dataError.message}</p>
              <Button variant="secondary" size="sm" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          </Alert>
        )}

        {/* ── Welcome ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-6 py-5 text-white shadow-lg relative overflow-hidden">
          {/* Subtle decorative grid */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.15) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Welcome back 👋
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Track your passes, requests, and hostel activity.
              </p>
              <p className="text-xs text-slate-500 mt-3">
                Shortcuts:&nbsp;
                {["L Leave", "G Guest", "M Issue", "P Profile", "R Refresh"].map(
                  (s) => (
                    <kbd
                      key={s}
                      className="mx-0.5 px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono text-[10px]"
                    >
                      {s}
                    </kbd>
                  )
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {lastUpdated && (
                <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              )}
              {isAutoRefreshActive && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1.5 text-white text-xs font-medium transition-colors disabled:opacity-50"
                aria-label="Refresh dashboard"
              >
                <svg
                  className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* ── Quick Actions (4 only) ────────────────────────────────────────── */}
        <section aria-label="Quick Actions">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: "Leave Request",
                sub: "Apply for leave",
                shortcut: "L",
                onClick: handleOpenLeave,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                ),
                accent: "text-blue-600 bg-blue-50",
              },
              {
                label: "Guest Request",
                sub: "Register a visitor",
                shortcut: "G",
                onClick: handleNavigateGuests,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                ),
                accent: "text-violet-600 bg-violet-50",
              },
              {
                label: "Report Issue",
                sub: "Log a complaint",
                shortcut: "M",
                onClick: handleNavigateComplaints,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                accent: "text-orange-600 bg-orange-50",
              },
              {
                label: "My Profile",
                sub: "View & edit profile",
                shortcut: "P",
                onClick: handleNavigateProfile,
                icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                accent: "text-teal-600 bg-teal-50",
              },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                aria-label={`${action.label}. Shortcut: ${action.shortcut}`}
                className="group flex flex-col items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${action.accent}`}
                >
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-tight">
                    {action.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.sub}</p>
                </div>
                <kbd className="mt-auto self-end text-[10px] font-mono rounded px-1.5 py-0.5 bg-gray-100 text-gray-400 group-hover:bg-gray-200 transition-colors">
                  {action.shortcut}
                </kbd>
              </button>
            ))}
          </div>
        </section>

        {/* ── Overview Stats ────────────────────────────────────────────────── */}
        <section aria-label="Overview Stats">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Overview
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Active Passes"
              value={activePassCount}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              title="Pending Requests"
              value={totalPendingRequests}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatCard
              title="Open Issues"
              value={openIssuesCount}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* ── My Passes ────────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">My Passes</CardTitle>
            {passDisplayItems.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleNavigateLeaveRequests}
              >
                View all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="md" />
              </div>
            ) : passDisplayItems.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No passes yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Start by submitting a leave request.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleOpenLeave}
                  className="mt-3"
                >
                  Apply for Leave
                </Button>
              </div>
            ) : (
              <>
                {/* Active passes */}
                {activePasses.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </p>
                    <div className="space-y-2">
                      {activePasses.slice(0, 3).map((pass, i) => (
                        <PassCard
                          key={`active-${pass.id ?? i}`}
                          pass={pass}
                          index={i}
                          onView={handleNavigateLeaveRequests}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Pending passes */}
                {pendingPasses.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Pending
                    </p>
                    <div className="space-y-2">
                      {pendingPasses.slice(0, 3).map((pass, i) => (
                        <PassCard
                          key={`pending-${pass.id ?? i}`}
                          pass={pass}
                          index={i}
                          onView={handleNavigateLeaveRequests}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallback for passes that are neither active nor pending */}
                {activePasses.length === 0 && pendingPasses.length === 0 && (
                  <div className="space-y-2">
                    {passDisplayItems.map((pass, i) => (
                      <PassCard
                        key={`pass-${pass.id ?? i}`}
                        pass={pass}
                        index={i}
                        onView={handleNavigateLeaveRequests}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Pending Requests ─────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="md" />
              </div>
            ) : (
              <div className="space-y-2">
                <PendingGroup
                  label="Leave Requests"
                  count={uniquePendingLeaves.length}
                  ctaLabel="View"
                  onClick={handleNavigateLeaveRequests}
                  latestItem={uniquePendingLeaves[0]}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                />
                <PendingGroup
                  label="Guest Requests"
                  count={pendingGuests.length}
                  ctaLabel="Open Form"
                  onClick={handleNavigateGuests}
                  latestItem={pendingGuests[0]}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  }
                />
                <PendingGroup
                  label="Maintenance Requests"
                  count={pendingMaintenance.length}
                  ctaLabel="Open Form"
                  onClick={handleNavigateComplaints}
                  latestItem={pendingMaintenance[0]}
                  icon={
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Activity ───────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="md" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-600">No activity yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Start by making a request.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.map((item, index) => {
                  const itemType = String(item._type || "").toLowerCase();
                  const titlePrefix =
                    itemType === "pass"
                      ? "Pass"
                      : itemType === "guest"
                      ? "Guest"
                      : "Issue";
                  const titleValue =
                    itemType === "pass"
                      ? item.pass_number || `#${item.id ?? index + 1}`
                      : itemType === "guest"
                      ? item.guest_name || `#${item.id ?? index + 1}`
                      : item.issue_type || `#${item.id ?? index + 1}`;

                  return (
                    <ActivityItem
                      key={`${item.id ?? index}-${item.created_at ?? ""}`}
                      title={`${titlePrefix}: ${titleValue}`}
                      description={`Status: ${formatStatusLabel(item.status)}`}
                      timestamp={
                        item.created_at
                          ? formatDate(item.created_at)
                          : "Recently"
                      }
                      status={getStatusColor(item.status || "pending")}
                    />
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Empty state (no data at all) ──────────────────────────────────── */}
        {!loading && !dataError && !hasAnyActivity && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">
              No activity yet. Start by making a request.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleOpenLeave}
              className="mt-3"
            >
              Apply for Leave
            </Button>
          </div>
        )}
      </div>

      {/* ── Leave Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={isLeaveOpen}
        onClose={handleCloseLeave}
        title="Submit Leave Request"
        size="lg"
      >
        <LeaveRequestForm
          onSubmit={handleLeaveSubmit}
          loading={leaveSubmission.loading}
          onCancel={handleCloseLeave}
        />
      </Modal>
    </AppShell>
  );
};