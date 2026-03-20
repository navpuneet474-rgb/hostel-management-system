import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ActiveGuestsList, type ActiveGuest } from '../ActiveGuestsList';
import * as endpoints from '../../../api/endpoints';

// Mock the API endpoints
vi.mock('../../../api/endpoints', () => ({
  getActiveGuests: vi.fn()
}));

const mockGetActiveGuests = vi.mocked(endpoints.getActiveGuests);

describe('ActiveGuestsList', () => {
  const mockOnGuestSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockActiveGuests: ActiveGuest[] = [
    {
      id: '1',
      guest_name: 'John Doe',
      guest_phone: '+1 555 123 4567',
      student_name: 'Alice Smith',
      room_number: '201A',
      entry_time: new Date().toISOString(),
      expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      verification_code: 'ABC12345',
      status: 'inside'
    },
    {
      id: '2',
      guest_name: 'Jane Smith',
      guest_phone: '+1 555 987 6543',
      student_name: 'Bob Johnson',
      room_number: '102B',
      entry_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      expires_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago (expired)
      verification_code: 'XYZ98765',
      status: 'expired'
    }
  ];

  it('renders loading state initially', () => {
    mockGetActiveGuests.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<ActiveGuestsList />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders active guests list correctly', async () => {
    mockGetActiveGuests.mockResolvedValue({ guests: mockActiveGuests });
    
    render(<ActiveGuestsList onGuestSelect={mockOnGuestSelect} />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Guests (2)')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Visiting Alice Smith (Room 201A)')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Visiting Bob Johnson (Room 102B)')).toBeInTheDocument();
  });

  it('shows expired status for expired guests', async () => {
    mockGetActiveGuests.mockResolvedValue({ guests: mockActiveGuests });
    
    render(<ActiveGuestsList />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Expired')).toHaveLength(2); // One in status text, one in badge
    });
  });

  it('shows expiring soon warning for guests expiring within 30 minutes', async () => {
    const expiringSoonGuest: ActiveGuest = {
      ...mockActiveGuests[0],
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes from now
    };
    
    mockGetActiveGuests.mockResolvedValue({ guests: [expiringSoonGuest] });
    
    render(<ActiveGuestsList />);
    
    await waitFor(() => {
      expect(screen.getByText('Expiring Soon')).toBeInTheDocument();
    });
  });

  it('calls onGuestSelect when view button is clicked', async () => {
    const user = userEvent.setup();
    mockGetActiveGuests.mockResolvedValue({ guests: [mockActiveGuests[0]] });
    
    render(<ActiveGuestsList onGuestSelect={mockOnGuestSelect} />);
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    await user.click(viewButton);

    expect(mockOnGuestSelect).toHaveBeenCalledWith(mockActiveGuests[0]);
  });

  it('shows empty state when no guests are active', async () => {
    mockGetActiveGuests.mockResolvedValue({ guests: [] });
    
    render(<ActiveGuestsList />);
    
    await waitFor(() => {
      expect(screen.getByText('No active guests in the hostel')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockGetActiveGuests.mockRejectedValue(new Error('Network error'));
    
    render(<ActiveGuestsList />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load active guests/i)).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    mockGetActiveGuests.mockResolvedValue({ guests: mockActiveGuests });
    
    render(<ActiveGuestsList />);
    
    await waitFor(() => {
      expect(screen.getByText('Active Guests (2)')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockGetActiveGuests).toHaveBeenCalledTimes(2);
  });
});