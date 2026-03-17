import { api } from "./client";
import type { AxiosResponse } from "axios";
import type { UserType } from "../types";

export const login = (payload: { email: string; password: string; user_type: UserType }) =>
  api.post("/auth/login/", payload).then((r: AxiosResponse) => r.data);

export const changePassword = (payload: Record<string, string>) =>
  api.post("/auth/change-password/", payload).then((r: AxiosResponse) => r.data);

export const getStudentDashboardData = async () => {
  const [passes, absences, guests, maintenance] = await Promise.all([
    api.get("/api/digital-passes/"),
    api.get("/api/absence-records/"),
    api.get("/api/guest-requests/"),
    api.get("/api/maintenance-requests/"),
  ]);

  return {
    passes: passes.data,
    absences: absences.data,
    guests: guests.data,
    maintenance: maintenance.data,
  };
};

export const submitLeaveRequest = (payload: Record<string, unknown>) =>
  api.post("/api/submit-leave-request/", payload).then((r: AxiosResponse) => r.data);

export const submitGuestRequest = (payload: Record<string, unknown>) =>
  api.post("/api/guest-requests/", payload).then((r: AxiosResponse) => r.data);

export const submitMaintenanceRequest = (payload: Record<string, unknown>) =>
  api.post("/api/maintenance-requests/", payload).then((r: AxiosResponse) => r.data);

export const getStaffDashboard = () => api.get("/api/dashboard-data/").then((r: AxiosResponse) => r.data);

export const approveRequest = (payload: Record<string, unknown>) =>
  api.post("/api/approve-request/", payload).then((r: AxiosResponse) => r.data);

export const rejectRequest = (payload: Record<string, unknown>) =>
  api.post("/api/reject-request/", payload).then((r: AxiosResponse) => r.data);

export const getPassHistory = (params?: Record<string, string>) =>
  api.get("/api/pass-history/", { params }).then((r: AxiosResponse) => r.data);

export const askStaffQuery = (query: string) =>
  api.post("/api/staff-query/", { query }).then((r: AxiosResponse) => r.data);

export const sendChatMessage = (content: string, userContext?: Record<string, string>) =>
  api.post("/api/messages/", { content, user_context: userContext }).then((r: AxiosResponse) => r.data);

export const getRecentMessages = () => api.get("/api/messages/recent/").then((r: AxiosResponse) => r.data);

export const getSecurityStats = () => api.get("/api/security/stats/").then((r: AxiosResponse) => r.data);

export const verifyPass = (pass_number: string) =>
  api.post("/api/verify-pass/", { pass_number }).then((r: AxiosResponse) => r.data);

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

export const clearChatMessages = (user_id: string) =>
  api.post("/api/messages/clear/", { user_id }).then((r: AxiosResponse) => r.data);

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
