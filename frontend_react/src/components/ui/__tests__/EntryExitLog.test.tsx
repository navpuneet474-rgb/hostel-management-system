import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntryExitLog, type EntryLogItem } from '../EntryExitLog';
import * as endpoints from '../../../api/endpoints';

// Mock the API endpoints
vi.mock('../../../api/endpoints', () => ({
  getGuestEntryLog: vi.fn()
}));

const mockGetGuestEntryLog = vi.mocked(endpoints.getGuestEntryLog);

describe('EntryExitLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLogEntries: EntryLogItem[] = [
    {
      id: '1',
      guest_name: 'John Doe',
      student_name: 'Alice Smith',
      room_number: '201A',
      action: 'entry',
      timestamp: new Date().toISOString(),
      verification_code: 'ABC12345',
      verified_by: 'Security Guard 1'
    },
    {
      id: '2',
      guest_name: 'Jane Smith',
      student_name: 'Bob Johnson',
      room_number: '102B',
      action: 'exit',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      verification_code: 'XYZ98765',
      verified_by: 'Security Guard 2'
    }
  ];

  it('renders loading state initially', () => {
    mockGetGuestEntryLog.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<EntryExitLog />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders entry/exit log correctly', async () => {
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Entry/Exit Log')).toBeInTheDocument();
    });

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Entered • Visiting Alice Smith (Room 201A)')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Exited • Visiting Bob Johnson (Room 102B)')).toBeInTheDocument();
  });

  it('shows entry and exit badges correctly', async () => {
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('ENTRY')).toBeInTheDocument();
      expect(screen.getByText('EXIT')).toBeInTheDocument();
    });
  });

  it('shows verification codes and verified by information', async () => {
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Code: ABC12345')).toBeInTheDocument();
      expect(screen.getByText('Verified by Security Guard 1')).toBeInTheDocument();
      expect(screen.getByText('Code: XYZ98765')).toBeInTheDocument();
      expect(screen.getByText('Verified by Security Guard 2')).toBeInTheDocument();
    });
  });

  it('filters entries by date when date filter is applied', async () => {
    const user = userEvent.setup();
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Entry/Exit Log')).toBeInTheDocument();
    });

    const dateInput = screen.getByDisplayValue('');
    await user.type(dateInput, '2024-03-18');

    await waitFor(() => {
      expect(mockGetGuestEntryLog).toHaveBeenCalledWith({ limit: 20, date: '2024-03-18' });
    });
  });

  it('clears date filter when clear button is clicked', async () => {
    const user = userEvent.setup();
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Entry/Exit Log')).toBeInTheDocument();
    });

    const dateInput = screen.getByDisplayValue('');
    
    // Type a date to show the clear button
    await user.type(dateInput, '2024-03-18');
    expect(dateInput).toHaveValue('2024-03-18');

    // Wait for the clear button to appear
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
    });

    // Click the clear button
    const clearButton = screen.getByRole('button', { name: /clear/i });
    await user.click(clearButton);

    // The clear button should disappear when the date is cleared
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
    });
  });

  it('shows empty state when no entries are found', async () => {
    mockGetGuestEntryLog.mockResolvedValue({ entries: [] });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('No entry/exit records found')).toBeInTheDocument();
    });
  });

  it('shows filtered empty state when no entries found for date', async () => {
    const user = userEvent.setup();
    mockGetGuestEntryLog
      .mockResolvedValueOnce({ entries: mockLogEntries })
      .mockResolvedValueOnce({ entries: [] });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Entry/Exit Log')).toBeInTheDocument();
    });

    const dateInput = screen.getByDisplayValue('');
    await user.type(dateInput, '2024-01-01');

    await waitFor(() => {
      expect(screen.getByText('No entries found for selected date')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    mockGetGuestEntryLog.mockRejectedValue(new Error('Network error'));
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText(/failed to load entry log/i)).toBeInTheDocument();
    });
  });

  it('refreshes data when refresh button is clicked', async () => {
    const user = userEvent.setup();
    mockGetGuestEntryLog.mockResolvedValue({ entries: mockLogEntries });
    
    render(<EntryExitLog />);
    
    await waitFor(() => {
      expect(screen.getByText('Entry/Exit Log')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockGetGuestEntryLog).toHaveBeenCalledTimes(2);
  });
});