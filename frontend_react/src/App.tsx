import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StaffDashboardPage } from "./pages/StaffDashboardPage";
import { PassHistoryPage } from "./pages/PassHistoryPage";
import { StaffQueryPage } from "./pages/StaffQueryPage";
import { SecurityDashboardPage } from "./pages/SecurityDashboardPage";
import { MaintenanceDashboardPage } from "./pages/MaintenanceDashboardPage";
import { ChatPage } from "./pages/ChatPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { StudentDebugPage } from "./pages/StudentDebugPage";
import { SecurityActivePassesPage } from "./pages/SecurityActivePassesPage";
import { DigitalPassTemplatePage } from "./pages/passes/DigitalPassTemplatePage";
import { LeaveAutoApprovalEmailPage } from "./pages/emails/LeaveAutoApprovalEmailPage";
import { LeaveEscalationEmailPage } from "./pages/emails/LeaveEscalationEmailPage";
import { LeaveRejectionEmailPage } from "./pages/emails/LeaveRejectionEmailPage";
import { LeaveWardenApprovalEmailPage } from "./pages/emails/LeaveWardenApprovalEmailPage";
import { MaintenanceStatusUpdateEmailPage } from "./pages/emails/MaintenanceStatusUpdateEmailPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/auth/change-password" element={<ChangePasswordPage />} />
      <Route path="/student/dashboard" element={<StudentDashboardPage />} />
      <Route path="/student/profile" element={<ProfilePage />} />
      <Route path="/student/debug" element={<StudentDebugPage />} />
      <Route path="/staff" element={<StaffDashboardPage />} />
      <Route path="/staff/profile" element={<ProfilePage />} />
      <Route path="/staff/pass-history" element={<PassHistoryPage />} />
      <Route path="/staff/query" element={<StaffQueryPage />} />
      <Route path="/security/dashboard" element={<SecurityDashboardPage />} />
      <Route path="/security/active-passes" element={<SecurityActivePassesPage />} />
      <Route path="/security/profile" element={<ProfilePage />} />
      <Route path="/maintenance/dashboard" element={<MaintenanceDashboardPage />} />
      <Route path="/maintenance/profile" element={<ProfilePage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/passes/digital-template" element={<DigitalPassTemplatePage />} />
      <Route path="/emails/leave-warden-approval" element={<LeaveWardenApprovalEmailPage />} />
      <Route path="/emails/leave-escalation" element={<LeaveEscalationEmailPage />} />
      <Route path="/emails/leave-rejection" element={<LeaveRejectionEmailPage />} />
      <Route path="/emails/maintenance-status-update" element={<MaintenanceStatusUpdateEmailPage />} />
      <Route path="/emails/leave-auto-approval" element={<LeaveAutoApprovalEmailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
