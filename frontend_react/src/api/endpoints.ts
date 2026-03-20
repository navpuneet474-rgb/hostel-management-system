import { api } from "./client";
import { API_CONFIG } from "../config";
import type { AxiosResponse } from "axios";
import type { UserType } from "../types";

export const login = (payload: { email: string; password: string; user_type: UserType }) =>
  api.post(API_CONFIG.ENDPOINTS.AUTH.LOGIN, payload).then((r: AxiosResponse) => r.data);

export const changePassword = (payload: Record<string, string>) =>
  api.post(API_CONFIG.ENDPOINTS.AUTH.CHANGE_PASSWORD, payload).then((r: AxiosResponse) => r.data);

export const getStudentDashboardData = async () => {
  const [passes, absences, guests, maintenance] = await Promise.all([
    api.get(API_CONFIG.ENDPOINTS.API.DIGITAL_PASSES),
    api.get(API_CONFIG.ENDPOINTS.API.ABSENCE_RECORDS),
    api.get(API_CONFIG.ENDPOINTS.API.GUEST_REQUESTS),
    api.get(API_CONFIG.ENDPOINTS.API.MAINTENANCE_REQUESTS),
  ]);

  return {
    passes: passes.data,
    absences: absences.data,
    guests: guests.data,
    maintenance: maintenance.data,
  };
};

export const submitLeaveRequest = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.SUBMIT_LEAVE_REQUEST, payload).then((r: AxiosResponse) => r.data);

export const submitGuestRequest = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.GUEST_REQUESTS, payload).then((r: AxiosResponse) => r.data);

export const submitMaintenanceRequest = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.MAINTENANCE_REQUESTS, payload).then((r: AxiosResponse) => r.data);

export const getStaffDashboard = () => api.get(API_CONFIG.ENDPOINTS.API.DASHBOARD_DATA).then((r: AxiosResponse) => r.data);

export const approveRequest = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.APPROVE_REQUEST, payload).then((r: AxiosResponse) => r.data);

export const rejectRequest = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.REJECT_REQUEST, payload).then((r: AxiosResponse) => r.data);

export const getPassHistory = (params?: Record<string, string>) =>
  api.get(API_CONFIG.ENDPOINTS.API.PASS_HISTORY, { params }).then((r: AxiosResponse) => r.data);



export const getSecurityStats = () => api.get("/api/security/stats/").then((r: AxiosResponse) => r.data);

export const verifyPass = (pass_number: string) =>
  api.post(API_CONFIG.ENDPOINTS.API.VERIFY_PASS, { pass_number }).then((r: AxiosResponse) => r.data);

export const verifyGuestCode = (code: string) =>
  api.post(API_CONFIG.ENDPOINTS.API.VERIFY_GUEST, { verification_code: code }).then((r: AxiosResponse) => r.data);

export const recordGuestEntry = (payload: { guest_id: string; verification_code: string; action: 'entry' | 'exit' }) =>
  api.post(API_CONFIG.ENDPOINTS.API.GUEST_ENTRY_LOG, payload).then((r: AxiosResponse) => r.data);

export const getGuestEntryLog = (params?: { date?: string; limit?: number }) =>
  api.get(API_CONFIG.ENDPOINTS.API.GUEST_ENTRY_LOG, { params }).then((r: AxiosResponse) => r.data);

export const getActiveGuests = () =>
  api.get(API_CONFIG.ENDPOINTS.API.ACTIVE_GUESTS).then((r: AxiosResponse) => r.data);

export const getMaintenanceStats = () => api.get("/api/maintenance/stats/").then((r: AxiosResponse) => r.data);

export const getMaintenanceHistory = () => api.get("/api/maintenance/history/").then((r: AxiosResponse) => r.data);

export const updateMaintenanceStatus = (payload: Record<string, unknown>) =>
  api.post("/api/maintenance/update-status/", payload).then((r: AxiosResponse) => r.data);

export const acceptMaintenanceTask = (payload: { request_id: string }) =>
  api.post("/api/maintenance/accept-task/", payload).then((r: AxiosResponse) => r.data);

export const getStudentsPresentDetails = () =>
  api.get("/api/students-present/").then((r: AxiosResponse) => r.data);

export const getDailySummary = (date?: string) =>
  api.get("/api/daily-summary/", { params: date ? { date } : undefined }).then((r: AxiosResponse) => r.data);



export const getSecurityActivePasses = () =>
  api.get("/api/security/active-passes/").then((r: AxiosResponse) => r.data);

export const searchStudentPasses = (q: string) =>
  api.get("/api/security/search-students/", { params: { q } }).then((r: AxiosResponse) => r.data);

export const getRecentVerifications = () =>
  api.get("/api/security/recent-verifications/").then((r: AxiosResponse) => r.data);

export const bulkVerifyPasses = (pass_numbers: string[]) =>
  api.post("/api/security/bulk-verify/", { pass_numbers }).then((r: AxiosResponse) => r.data);

export const activateEmergencyMode = (payload: Record<string, string>) =>
  api.post("/api/security/emergency-mode/", payload).then((r: AxiosResponse) => r.data);

export const submitComplaint = (payload: Record<string, unknown>) =>
  api.post(API_CONFIG.ENDPOINTS.API.SUBMIT_COMPLAINT, payload).then((r: AxiosResponse) => r.data);

export const getComplaints = (params?: Record<string, string>) =>
  api.get(API_CONFIG.ENDPOINTS.API.COMPLAINTS, { params }).then((r: AxiosResponse) => r.data);
