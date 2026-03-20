import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StaffDashboardPage } from '../StaffDashboardPage';
import * as endpoints from '../../api/endpoints';

// Mock the API endpoints
vi.mock('../../api/endpoints', () => ({
  getStaffDashboard: vi.fn(),
  getDailySummary: vi.fn(),
  getStudentsPresentDetails: vi.fn(),
  approveRequest: vi.fn(),
  rejectRequest: vi.fn(),
}));

// Mock the AppShell layout
vi.mock('../../layouts/AppShell', () => ({
  AppShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div data-testid="app-shell" data-title={title}>
      {children}
    </div>
  ),
}));

const mockStaffDashboardData = {
  data: {
    stats: {
      total_pending_requests: 5,
      present_students: 120,
      total_students: 150,
      active_guests: 8,
    },
    pending_requests: {
      guest_requests: [
        {
          id: 1,
          request_id: 'REQ001',
          guest_name: 'John Doe',
          student__name: 'Alice Smith',
          status: 'pending',
          purpose: 'Family visit',
          from_time: '2024-01-15T10:00:00Z',
          to_time: '2024-01-15T18:00:00Z',
          created_at: '2024-01-14T15:30:00Z',
        },
        {
          id: 2,
          request_id: 'REQ002',
          guest_name: 'Jane Wilson',
          student__name: 'Bob Johnson',
          status: 'pending',
          purpose: 'Academic meeting',
          from_time: '2024-01-16T14:00:00Z',
          to_time: '2024-01-16T16:00:00Z',
          created_at: '2024-01-15T09:15:00Z',
        },
      ],
    },
  },
};

describe('StaffDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (endpoints.getStaffDashboard as any).mockResolvedValue(mockStaffDashboardData);
    (endpoints.getDailySummary as any).mockResolvedValue({ summary: 'Daily report data' });
    (endpoints.getStudentsPresentDetails as any).mockResolvedValue({
      data: {
        students: [
          { name: 'Alice Smith', student_id: 'STU001', room_number: '101' },
          { name: 'Bob Johnson', student_id: 'STU002', room_number: '102' },
        ],
      },
    });
  });

  it('renders staff dashboard with statistics', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
    });

    // Check statistics cards
    expect(screen.getByText('5')).toBeInTheDocument(); // Pending requests
    expect(screen.getByText('120')).toBeInTheDocument(); // Present students
    expect(screen.getByText('150')).toBeInTheDocument(); // Total students
    expect(screen.getByText('8')).toBeInTheDocument(); // Active guests
  });

  it('displays guest requests in enhanced table with filtering', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Wilson')).toBeInTheDocument();
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    });

    // Check enhanced columns
    expect(screen.getByText('Family visit')).toBeInTheDocument();
    expect(screen.getByText('Academic meeting')).toBeInTheDocument();
  });

  it('filters requests by search term', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Search for specific guest
    const searchInput = screen.getByPlaceholderText('Search by guest name, student, or purpose...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Wait for filtering to take effect
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    // Jane Wilson should still be visible since filtering is case-insensitive and "John" doesn't filter her out
    // Let's search for something more specific
    fireEvent.change(searchInput, { target: { value: 'Family visit' } });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Wilson')).not.toBeInTheDocument();
    });
  });

  it('filters requests by status', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Filter by status
    const statusFilter = screen.getByDisplayValue('All Status');
    fireEvent.change(statusFilter, { target: { value: 'pending' } });

    // Both requests should still be visible as they are pending
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Wilson')).toBeInTheDocument();
  });

  it('shows confirmation dialog before approving request', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click approve button
    const approveButtons = screen.getAllByText('Approve');
    fireEvent.click(approveButtons[0]);

    // Check confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Approve Guest Request')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to approve the guest request for John Doe/)).toBeInTheDocument();
    });
  });

  it('shows confirmation dialog before rejecting request', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click reject button
    const rejectButtons = screen.getAllByText('Reject');
    fireEvent.click(rejectButtons[0]);

    // Check confirmation dialog
    await waitFor(() => {
      expect(screen.getByText('Reject Guest Request')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to reject the guest request for John Doe/)).toBeInTheDocument();
    });
  });

  it('displays recent activity feed', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    // Check for activity items (mocked in component)
    expect(screen.getByText(/Guest request approved for John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/New maintenance complaint submitted/)).toBeInTheDocument();
    expect(screen.getByText(/Leave request submitted by Alice Smith/)).toBeInTheDocument();
  });

  it('displays quick actions section', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    });

    // Check quick action buttons
    expect(screen.getByText('Generate Daily Report')).toBeInTheDocument();
    expect(screen.getByText('View Present Students')).toBeInTheDocument();
    expect(screen.getByText('View Pending Requests')).toBeInTheDocument();
    expect(screen.getByText('Refresh Dashboard')).toBeInTheDocument();
  });

  it('clears filters when clear button is clicked', async () => {
    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Apply search filter
    const searchInput = screen.getByPlaceholderText('Search by guest name, student, or purpose...');
    fireEvent.change(searchInput, { target: { value: 'John' } });

    // Apply status filter
    const statusFilter = screen.getByDisplayValue('All Status');
    fireEvent.change(statusFilter, { target: { value: 'pending' } });

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    // Check that filters are cleared
    expect(searchInput).toHaveValue('');
    expect(statusFilter).toHaveValue('all');
  });

  it('handles API errors gracefully', async () => {
    (endpoints.getStaffDashboard as any).mockRejectedValue(new Error('API Error'));

    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Unable to load staff dashboard')).toBeInTheDocument();
    });
  });

  it('calls approve API when confirmation is accepted', async () => {
    (endpoints.approveRequest as any).mockResolvedValue({});

    render(<StaffDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Click approve and confirm
    const approveButtons = screen.getAllByText('Approve');
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Approve Guest Request')).toBeInTheDocument();
    });

    // Find the confirm button in the modal (not in the table)
    const confirmButtons = screen.getAllByRole('button', { name: 'Approve' });
    const modalConfirmButton = confirmButtons.find(button => 
      button.closest('[role="dialog"]') || button.closest('.modal')
    ) || confirmButtons[confirmButtons.length - 1]; // Last one should be in modal
    
    fireEvent.click(modalConfirmButton);

    await waitFor(() => {
      expect(endpoints.approveRequest).toHaveBeenCalledWith({
        request_id: 'REQ001',
        request_type: 'guest',
      });
    });
  });
});