import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/routing";
import { LoginPage } from "./pages/LoginPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StaffDashboardPage } from "./pages/StaffDashboardPage";
import { PassHistoryPage } from "./pages/PassHistoryPage";
import { SecurityDashboardPage } from "./pages/SecurityDashboardPage";
import { MaintenanceDashboardPage } from "./pages/MaintenanceDashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SecurityActivePassesPage } from "./pages/SecurityActivePassesPage";
import { LeaveRequestsPage } from "./pages/LeaveRequestsPage";
import GuestRequestPage from "./pages/GuestRequestPage";
import { ComplaintPage } from "./pages/ComplaintPage";
import QRVerificationPage from "./pages/QRVerificationPage";
import { DigitalPassTemplatePage } from "./pages/passes/DigitalPassTemplatePage";
import { LeaveAutoApprovalEmailPage } from "./pages/emails/LeaveAutoApprovalEmailPage";
import { LeaveEscalationEmailPage } from "./pages/emails/LeaveEscalationEmailPage";
import { LeaveRejectionEmailPage } from "./pages/emails/LeaveRejectionEmailPage";
import { LeaveWardenApprovalEmailPage } from "./pages/emails/LeaveWardenApprovalEmailPage";
import { MaintenanceStatusUpdateEmailPage } from "./pages/emails/MaintenanceStatusUpdateEmailPage";

const App = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* Authentication Routes */}
      <Route 
        path="/auth/change-password" 
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Student Routes */}
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-requests"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <LeaveRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/guest-requests"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <GuestRequestPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints"
        element={
          <ProtectedRoute allowedRoles={['student']}>
            <ComplaintPage />
          </ProtectedRoute>
        }
      />
      {/* Warden Routes (using staff pages for now) */}
      <Route 
        path="/warden/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['warden']}>
            <StaffDashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/warden/profile" 
        element={
          <ProtectedRoute allowedRoles={['warden']}>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
      
      {/* Legacy staff routes - redirect to warden */}
      <Route path="/staff" element={<Navigate to="/warden/dashboard" replace />} />
      <Route path="/staff/profile" element={<Navigate to="/warden/profile" replace />} />
      <Route 
        path="/staff/pass-history" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'admin']}>
            <PassHistoryPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Security Routes */}
      <Route
        path="/security/dashboard"
        element={
          <ProtectedRoute allowedRoles={['security']}>
            <SecurityDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security/active-passes"
        element={
          <ProtectedRoute allowedRoles={['security']}>
            <SecurityActivePassesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security/qr-verify"
        element={
          <ProtectedRoute allowedRoles={['security']}>
            <QRVerificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security/profile"
        element={
          <ProtectedRoute allowedRoles={['security']}>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      
      {/* Maintenance Routes */}
      <Route 
        path="/maintenance/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['maintenance']}>
            <MaintenanceDashboardPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/maintenance/profile" 
        element={
          <ProtectedRoute allowedRoles={['maintenance']}>
            <ProfilePage />
          </ProtectedRoute>
        } 
      />
      
      {/* Admin Routes */}
      <Route 
        path="/admin/dashboard" 
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <StaffDashboardPage />
          </ProtectedRoute>
        } 
      />
      
      {/* Template and Email Routes */}
      <Route 
        path="/passes/digital-template" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'security', 'admin']}>
            <DigitalPassTemplatePage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emails/leave-warden-approval" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'admin']}>
            <LeaveWardenApprovalEmailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emails/leave-escalation" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'admin']}>
            <LeaveEscalationEmailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emails/leave-rejection" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'admin']}>
            <LeaveRejectionEmailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emails/maintenance-status-update" 
        element={
          <ProtectedRoute allowedRoles={['maintenance', 'admin']}>
            <MaintenanceStatusUpdateEmailPage />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/emails/leave-auto-approval" 
        element={
          <ProtectedRoute allowedRoles={['warden', 'admin']}>
            <LeaveAutoApprovalEmailPage />
          </ProtectedRoute>
        } 
      />
      
      {/* 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
