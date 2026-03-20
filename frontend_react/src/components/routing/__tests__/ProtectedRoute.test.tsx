import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProtectedRoute } from '../ProtectedRoute';
import { AuthProvider } from '../../../context/AuthContext';
import type { AuthUser } from '../../../types';

// Mock the useAuth hook
const mockAuthContext = {
  user: null as AuthUser | null,
  loading: false,
  isAuthenticated: false,
  setUser: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  hasRole: vi.fn(() => false),
};

vi.mock('../../../context/AuthContext', async () => {
  const actual = await vi.importActual('../../../context/AuthContext');
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

const TestComponent = () => <div data-testid="protected-content">Protected Content</div>;

describe('ProtectedRoute', () => {
  it('should show loading spinner when loading', () => {
    mockAuthContext.loading = true;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.user = null;

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should redirect to login when not authenticated', () => {
    mockAuthContext.loading = false;
    mockAuthContext.isAuthenticated = false;
    mockAuthContext.user = null;

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    // Should not render protected content
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('should render children when authenticated and no role restrictions', () => {
    const mockUser: AuthUser = {
      id: '1',
      name: 'Test User',
      email: 'test@example.com',
      userType: 'student',
    };

    mockAuthContext.loading = false;
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.user = mockUser;
    mockAuthContext.hasRole = vi.fn(() => true);

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('should redirect when user lacks required role', () => {
    const mockUser: AuthUser = {
      id: '1',
      name: 'Test Student',
      email: 'student@example.com',
      userType: 'student',
    };

    mockAuthContext.loading = false;
    mockAuthContext.isAuthenticated = true;
    mockAuthContext.user = mockUser;
    mockAuthContext.hasRole = vi.fn(() => false); // User doesn't have required role

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <ProtectedRoute allowedRoles={['admin']}>
          <TestComponent />
        </ProtectedRoute>
      </MemoryRouter>
    );

    // Should not render protected content
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});