import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplaintHistory } from '../ComplaintHistory';
import type { Complaint } from '../../../types';

describe('ComplaintHistory', () => {
  const mockComplaints: Complaint[] = [
    {
      id: 'complaint-1',
      ticket_number: 'COMP-2024-001',
      category: 'electrical',
      title: 'Power outlet not working',
      description: 'The power outlet in my room stopped working yesterday.',
      priority: 'high',
      status: 'in_progress',
      room_number: 'A-201',
      created_at: '2024-01-15T10:30:00Z',
      photos: ['photo1.jpg']
    },
    {
      id: 'complaint-2',
      ticket_number: 'COMP-2024-002',
      category: 'plumbing',
      title: 'Leaky faucet',
      description: 'The bathroom faucet has been leaking for two days.',
      priority: 'medium',
      status: 'resolved',
      room_number: 'A-202',
      created_at: '2024-01-14T09:15:00Z',
      resolved_at: '2024-01-16T14:30:00Z',
      rating: 4
    },
    {
      id: 'complaint-3',
      ticket_number: 'COMP-2024-003',
      category: 'cleaning',
      title: 'Dirty common area',
      description: 'The common area needs cleaning.',
      priority: 'low',
      status: 'submitted',
      room_number: 'A-203',
      created_at: '2024-01-16T16:45:00Z'
    }
  ];

  const mockOnComplaintClick = vi.fn();
  const mockOnRefresh = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders complaints correctly', () => {
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
    expect(screen.getByText('Leaky faucet')).toBeInTheDocument();
    expect(screen.getByText('Dirty common area')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    render(
      <ComplaintHistory
        complaints={[]}
        loading={true}
        onComplaintClick={mockOnComplaintClick}
      />
    );

    expect(screen.getAllByText('Loading complaints...')).toHaveLength(2); // One visible, one for screen readers
  });

  it('displays error state with retry button', () => {
    render(
      <ComplaintHistory
        complaints={[]}
        error="Failed to load complaints"
        onComplaintClick={mockOnComplaintClick}
        onRefresh={mockOnRefresh}
      />
    );

    expect(screen.getByText('Failed to load complaints')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('calls onRefresh when retry button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={[]}
        error="Failed to load complaints"
        onComplaintClick={mockOnComplaintClick}
        onRefresh={mockOnRefresh}
      />
    );

    const retryButton = screen.getByText('Try Again');
    await user.click(retryButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });

  it('filters complaints by search text', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search complaints/i);
    await user.type(searchInput, 'power');

    // Should show only the power outlet complaint
    expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
    expect(screen.queryByText('Leaky faucet')).not.toBeInTheDocument();
    expect(screen.queryByText('Dirty common area')).not.toBeInTheDocument();
  });

  it('filters complaints by status', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const statusSelect = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusSelect, 'resolved');

    // Should show only resolved complaints
    expect(screen.queryByText('Power outlet not working')).not.toBeInTheDocument();
    expect(screen.getByText('Leaky faucet')).toBeInTheDocument();
    expect(screen.queryByText('Dirty common area')).not.toBeInTheDocument();
  });

  it('filters complaints by category', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const categorySelect = screen.getByDisplayValue('All Categories');
    await user.selectOptions(categorySelect, 'electrical');

    // Should show only electrical complaints
    expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
    expect(screen.queryByText('Leaky faucet')).not.toBeInTheDocument();
    expect(screen.queryByText('Dirty common area')).not.toBeInTheDocument();
  });

  it('filters complaints by priority', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const prioritySelect = screen.getByDisplayValue('All Priorities');
    await user.selectOptions(prioritySelect, 'high');

    // Should show only high priority complaints
    expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
    expect(screen.queryByText('Leaky faucet')).not.toBeInTheDocument();
    expect(screen.queryByText('Dirty common area')).not.toBeInTheDocument();
  });

  it('sorts complaints by date', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const sortSelect = screen.getByDisplayValue('Date');
    expect(sortSelect).toBeInTheDocument();

    // Default should be descending (newest first)
    const complaintCards = screen.getAllByText(/COMP-2024-/);
    expect(complaintCards[0]).toHaveTextContent('COMP-2024-003'); // Newest
  });

  it('toggles sort order', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    const sortOrderButton = screen.getByTitle(/sort ascending/i);
    await user.click(sortOrderButton);

    // Should now be ascending (oldest first)
    const complaintCards = screen.getAllByText(/COMP-2024-/);
    expect(complaintCards[0]).toHaveTextContent('COMP-2024-002'); // Oldest
  });

  it('clears all filters', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    // Apply some filters
    const searchInput = screen.getByPlaceholderText(/search complaints/i);
    await user.type(searchInput, 'power');

    const statusSelect = screen.getByDisplayValue('All Status');
    await user.selectOptions(statusSelect, 'in_progress');

    // Should show filter indicator
    await waitFor(() => {
      expect(screen.getByText(/showing 1 of 3 complaints/i)).toBeInTheDocument();
    });

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    await user.click(clearButton);

    // Should show all complaints again
    await waitFor(() => {
      expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
      expect(screen.getByText('Leaky faucet')).toBeInTheDocument();
      expect(screen.getByText('Dirty common area')).toBeInTheDocument();
    });
  });

  it('calls onComplaintClick when complaint card is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
      />
    );

    const complaintCard = screen.getByText('Power outlet not working');
    await user.click(complaintCard);

    expect(mockOnComplaintClick).toHaveBeenCalledWith(mockComplaints[0]);
  });

  it('shows empty state when no complaints', () => {
    render(
      <ComplaintHistory
        complaints={[]}
        onComplaintClick={mockOnComplaintClick}
      />
    );

    expect(screen.getByText('No complaints found')).toBeInTheDocument();
    expect(screen.getByText(/you haven't submitted any complaints yet/i)).toBeInTheDocument();
  });

  it('shows filtered empty state', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    // Apply filter that matches nothing
    const searchInput = screen.getByPlaceholderText(/search complaints/i);
    await user.type(searchInput, 'nonexistent');

    await waitFor(() => {
      expect(screen.getByText('No complaints match your filters')).toBeInTheDocument();
      expect(screen.getByText(/try adjusting your search criteria/i)).toBeInTheDocument();
    });
  });

  it('displays complaint count correctly', () => {
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={true}
      />
    );

    expect(screen.getByText('3 complaints')).toBeInTheDocument();
  });

  it('hides filters when showFilters is false', () => {
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        showFilters={false}
      />
    );

    expect(screen.queryByPlaceholderText(/search complaints/i)).not.toBeInTheDocument();
  });

  it('calls onRefresh when refresh button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintHistory
        complaints={mockComplaints}
        onComplaintClick={mockOnComplaintClick}
        onRefresh={mockOnRefresh}
        showFilters={true}
      />
    );

    const refreshButton = screen.getByText('Refresh');
    await user.click(refreshButton);

    expect(mockOnRefresh).toHaveBeenCalled();
  });
});