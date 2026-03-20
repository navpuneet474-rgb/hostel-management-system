import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Typography } from 'antd';
import { useAuth } from '../../context/AuthContext';
import type { UserType } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserType[];
  redirectTo?: string;
  requireAuth?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  allowedRoles, 
  redirectTo = '/login',
  requireAuth = true
}: ProtectedRouteProps) => {
  const { user, loading, isAuthenticated, hasRole } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        gap: 16
      }}>
        <Spin size="large" />
        <Typography.Text type="secondary">Loading...</Typography.Text>
      </div>
    );
  }

  // Redirect to login if authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // If user is authenticated but doesn't have required role, redirect to their dashboard
  if (isAuthenticated && allowedRoles && !hasRole(allowedRoles)) {
    const roleRedirects: Record<UserType, string> = {
      student: '/student/dashboard',
      warden: '/warden/dashboard',
      security: '/security/dashboard',
      maintenance: '/maintenance/dashboard',
      admin: '/admin/dashboard',
      staff: '/warden/dashboard' // Default staff to warden dashboard
    };
    
    const userDashboard = user ? roleRedirects[user.userType] : '/login';
    return <Navigate to={userDashboard} replace />;
  }

  return <>{children}</>;
};