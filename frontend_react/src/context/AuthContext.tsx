import { createContext, useContext, useMemo, useState, useEffect, useCallback } from "react";
import { message } from "antd";
import type { AuthUser, UserType } from "../types";
import { api } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (roles: UserType | UserType[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = 'hostel_auth_user';
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadStoredUser = () => {
      try {
        const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserState(parsedUser);
        }
      } catch (error) {
        console.error('Error loading stored user:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    };

    loadStoredUser();
  }, []);

  // Persist user to localStorage when user changes
  useEffect(() => {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }, [user]);

  // Session validation - check if user session is still valid
  const validateSession = useCallback(async () => {
    if (!user) return;

    try {
      // Make a simple authenticated request to validate session
      await api.get('/auth/validate-session/');
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Session expired
        setUserState(null);
        message.warning('Your session has expired. Please log in again.');
      }
    }
  }, [user]);

  // Set up session validation interval
  useEffect(() => {
    if (user) {
      const interval = setInterval(validateSession, SESSION_CHECK_INTERVAL);
      return () => clearInterval(interval);
    }
  }, [user, validateSession]);

  const setUser = useCallback((newUser: AuthUser | null) => {
    setUserState(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint to invalidate server session
      await api.post('/auth/logout/');
    } catch (error) {
      console.error('Logout error:', error);
      // Continue with client-side logout even if server call fails
    } finally {
      // Clear user state and localStorage
      setUserState(null);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      
      // Clear any cached data
      sessionStorage.clear();
      
      message.success('Logged out successfully');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch updated user data from server
      const response = await api.get('/auth/user/');
      const updatedUser = {
        ...user,
        ...response.data,
      };
      setUserState(updatedUser);
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  }, [user]);

  const hasRole = useCallback((roles: UserType | UserType[]): boolean => {
    if (!user) return false;
    
    const roleArray = Array.isArray(roles) ? roles : [roles];
    return roleArray.includes(user.userType);
  }, [user]);

  const isAuthenticated = useMemo(() => !!user, [user]);

  const value = useMemo(() => ({
    user,
    loading,
    isAuthenticated,
    setUser,
    logout,
    refreshUser,
    hasRole,
  }), [user, loading, isAuthenticated, setUser, logout, refreshUser, hasRole]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
