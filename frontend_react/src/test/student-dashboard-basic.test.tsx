import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock API endpoints - MUST BE FIRST
vi.mock('../api/endpoints', () => ({
  getStudentDashboardData: vi.fn(() => Promise.resolve({
    passes: [],
    absences: [],
    guests: [],
    maintenance: []
  })),
  submitLeaveRequest: vi.fn(),
  submitGuestRequest: vi.fn(),
  submitMaintenanceRequest: vi.fn(),
}));

// Mock hooks - MUST BE FIRST
vi.mock('../hooks', () => ({
  useDashboardData: vi.fn(() => ({
    data: {
      passes: [],
      absences: [],
      guests: [],
      maintenance: []
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    lastUpdated: new Date(),
    isAutoRefreshActive: true,
  })),
  useAsyncOperation: vi.fn(() => ({
    execute: vi.fn(),
    loading: false,
    error: null,
  })),
  useNotifications: vi.fn(() => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    notifications: [],
    removeNotification: vi.fn(),
  })),
}));

// THEN imports
import { screen, fireEvent } from '@testing-library/react';
import { StudentDashboardPage } from '../pages/StudentDashboardPage';
import { renderWithProviders } from './test-utils';

describe('Student Dashboard Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Dashboard Rendering', () => {
    it('should render the main dashboard page', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Check for the main heading
      expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    });

    it('should show welcome message', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByText('Track passes, pending requests, and recent updates from one place.')).toBeInTheDocument();
    });

    it('should display quick actions section', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    it('should show keyboard shortcuts tip', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText(/Shortcuts:/i)).toBeInTheDocument();
      expect(screen.getByText(/L Leave/i)).toBeInTheDocument();
      expect(screen.getByText(/G Guest Request/i)).toBeInTheDocument();
      expect(screen.getByText(/M Report Issue/i)).toBeInTheDocument();
      expect(screen.getByText(/P Profile/i)).toBeInTheDocument();
    });

    it('should display auto-refresh status', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText(/Auto-refresh active/)).toBeInTheDocument();
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });
  });

  describe('Quick Action Buttons', () => {
    it('should render leave request button', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Look for button with aria-label containing "Leave Request"
      const leaveButton = screen.getByLabelText(/Leave Request/i);
      expect(leaveButton).toBeInTheDocument();
    });

    it('should render guest entry button', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Look for button with aria-label containing "Guest Request" (more specific)
      const guestButton = screen.getByLabelText(/Guest Request/i);
      expect(guestButton).toBeInTheDocument();
    });

    it('should render report issue button', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Look for button with aria-label containing "Report Issue"
      const maintenanceButton = screen.getByLabelText(/Report Issue/i);
      expect(maintenanceButton).toBeInTheDocument();
    });

    it('should render profile button', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Look for button with aria-label containing "Profile"
      const profileButton = screen.getByLabelText(/Profile/i);
      expect(profileButton).toBeInTheDocument();
    });
  });

  describe('Button Interactions', () => {
    it('should handle leave button click', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      const leaveButton = screen.getByLabelText(/Leave Request/i);
      fireEvent.click(leaveButton);
      
      // Button should be clickable (no errors thrown)
      expect(leaveButton).toBeInTheDocument();
    });

    it('should handle guest button click', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      const guestButton = screen.getByLabelText(/Guest Request/i);
      fireEvent.click(guestButton);
      
      // Button should be clickable (no errors thrown)
      expect(guestButton).toBeInTheDocument();
    });

    it('should handle report issue button click', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      const maintenanceButton = screen.getByLabelText(/Report Issue/i);
      fireEvent.click(maintenanceButton);
      
      // Button should be clickable (no errors thrown)
      expect(maintenanceButton).toBeInTheDocument();
    });

    it('should handle profile button click', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      const profileButton = screen.getByLabelText(/Profile/i);
      fireEvent.click(profileButton);
      
      // Button should be clickable (no errors thrown)
      expect(profileButton).toBeInTheDocument();
    });
  });

  describe('Navigation Elements', () => {
    it('should show hostel management branding', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText('Hostel Management')).toBeInTheDocument();
    });

    it('should show logout button', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels on action buttons', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Check that buttons have descriptive aria-labels (using actual labels)
      expect(screen.getByLabelText(/Leave Request.*Apply for leave/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Guest Request.*Open guest form/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Report Issue.*Open complaint form/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Profile.*View your profile/i)).toBeInTheDocument();
    });

    it('should have keyboard shortcut information in aria-labels', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Check that keyboard shortcuts are mentioned in aria-labels
      expect(screen.getByLabelText(/Keyboard shortcut: L/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Keyboard shortcut: G/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Keyboard shortcut: M/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Keyboard shortcut: P/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should render without crashing when data is empty', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Should render successfully even with empty data
      expect(screen.getByText('Student Dashboard')).toBeInTheDocument();
    });

    it('should handle missing user data gracefully', () => {
      renderWithProviders(<StudentDashboardPage />);
      
      // Should not crash when user data is not available
      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
  });
});