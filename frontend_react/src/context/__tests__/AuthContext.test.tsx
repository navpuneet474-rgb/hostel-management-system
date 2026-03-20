import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import type { AuthUser } from '../../types';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock API
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Test component to access auth context
const TestComponent = () => {
  const { user, isAuthenticated, loading, hasRole } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading.toString()}</div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="user">{user ? user.name : 'null'}</div>
      <div data-testid="has-student-role">{hasRole('student').toString()}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it('should provide initial state with no user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('user')).toHaveTextContent('null');
    expect(screen.getByTestId('has-student-role')).toHaveTextContent('false');
  });

  it('should load user from localStorage', async () => {
    const mockUser: AuthUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      userType: 'student',
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('user')).toHaveTextContent('Test User');
    expect(screen.getByTestId('has-student-role')).toHaveTextContent('true');
  });

  it('should handle role checking correctly', async () => {
    const mockUser: AuthUser = {
      id: '1',
      name: 'Test Warden',
      email: 'warden@example.com',
      userType: 'warden',
    };

    localStorageMock.getItem.mockReturnValue(JSON.stringify(mockUser));

    const TestRoleComponent = () => {
      const { hasRole } = useAuth();
      
      return (
        <div>
          <div data-testid="has-warden-role">{hasRole('warden').toString()}</div>
          <div data-testid="has-student-role">{hasRole('student').toString()}</div>
          <div data-testid="has-multiple-roles">{hasRole(['warden', 'admin']).toString()}</div>
        </div>
      );
    };

    render(
      <AuthProvider>
        <TestRoleComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('has-warden-role')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('has-student-role')).toHaveTextContent('false');
    expect(screen.getByTestId('has-multiple-roles')).toHaveTextContent('true');
  });
});