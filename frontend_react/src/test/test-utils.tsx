import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import type { AuthUser } from '../types';

// Mock localStorage for tests
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock API client
vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Test wrapper with all necessary providers
interface TestProvidersProps {
  children: React.ReactNode;
  initialUser?: AuthUser | null;
  initialRoute?: string;
}

const TestProviders = ({ 
  children, 
  initialUser = null,
  initialRoute = '/'
}: TestProvidersProps) => {
  // Mock the auth context if needed
  if (initialUser) {
    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(initialUser));
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        {children}
      </AuthProvider>
    </BrowserRouter>
  );
};

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialUser?: AuthUser | null;
  initialRoute?: string;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialUser, initialRoute, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestProviders initialUser={initialUser} initialRoute={initialRoute}>
      {children}
    </TestProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock user data for tests
export const mockStudentUser: AuthUser = {
  id: 'test-student-1',
  name: 'Test Student',
  email: 'student@test.com',
  userType: 'student',
  profile: {
    firstName: 'Test',
    lastName: 'Student',
    phone: '1234567890',
    studentId: 'STU001',
    roomNumber: 'A101',
  },
};

export const mockWardenUser: AuthUser = {
  id: 'test-warden-1',
  name: 'Test Warden',
  email: 'warden@test.com',
  userType: 'warden',
  profile: {
    firstName: 'Test',
    lastName: 'Warden',
    phone: '1234567890',
    employeeId: 'WAR001',
    department: 'Administration',
  },
};

// Common test data
export const mockDashboardData = {
  passes: [
    {
      id: 1,
      pass_number: 'PASS001',
      status: 'active',
      created_at: '2024-03-19T10:00:00Z',
    },
  ],
  absences: [
    {
      id: 1,
      from_date: '2024-03-20',
      to_date: '2024-03-22',
      status: 'approved',
      reason: 'Family visit',
    },
  ],
  guests: [
    {
      id: 1,
      guest_name: 'John Doe',
      status: 'pending',
      created_at: '2024-03-19T10:00:00Z',
    },
  ],
  maintenance: [
    {
      id: 1,
      issue_type: 'electrical',
      status: 'open',
      description: 'Light not working',
    },
  ],
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';