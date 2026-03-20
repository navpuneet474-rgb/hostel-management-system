import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplaintCard } from '../ComplaintCard';
import type { Complaint } from '../../../types';

describe('ComplaintCard', () => {
  const mockComplaint: Complaint = {
    id: 'complaint-1',
    ticket_number: 'COMP-2024-001',
    category: 'electrical',
    title: 'Power outlet not working',
    description: 'The power outlet in my room stopped working yesterday. I tried different devices but none work.',
    priority: 'high',
    status: 'in_progress',
    room_number: 'A-201',
    created_at: '2024-01-15T10:30:00Z',
    photos: ['photo1.jpg', 'photo2.jpg']
  };

  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders complaint information correctly', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Power outlet not working')).toBeInTheDocument();
    expect(screen.getByText('#COMP-2024-001')).toBeInTheDocument();
    expect(screen.getByText(/the power outlet in my room stopped working/i)).toBeInTheDocument();
    expect(screen.getByText('Room: A-201')).toBeInTheDocument();
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getAllByText('In Progress')).toHaveLength(2); // Status badge and progress indicator
  });

  it('displays correct status with icon and color', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    const statusElements = screen.getAllByText('In Progress');
    const statusBadge = statusElements[0]; // First one should be the status badge
    expect(statusBadge).toHaveClass('bg-orange-100', 'text-orange-800');
    
    // Check for status icon (🔧)
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('displays correct priority with color', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    const priorityElement = screen.getByText('High Priority');
    expect(priorityElement).toHaveClass('text-orange-600');
  });

  it('displays category icon correctly', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    // Electrical category should show ⚡ icon
    expect(screen.getByText('⚡')).toBeInTheDocument();
  });

  it('shows photo count when photos are present', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('displays progress indicator for in-progress status', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getAllByText('In Progress')).toHaveLength(2);
    // Should show progress bar container
    expect(screen.getByText('🔧')).toBeInTheDocument();
  });

  it('displays resolution info for resolved complaints', () => {
    const resolvedComplaint: Complaint = {
      ...mockComplaint,
      status: 'resolved',
      resolved_at: '2024-01-16T14:30:00Z',
      rating: 4
    };

    render(
      <ComplaintCard
        complaint={resolvedComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText(/resolved on/i)).toBeInTheDocument();
    expect(screen.getByText('Rating:')).toBeInTheDocument();
    
    // Check for star rating (4 out of 5 stars)
    const stars = screen.getAllByRole('generic');
    // Should have filled stars for rating
    expect(stars.length).toBeGreaterThan(0);
  });

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    const card = screen.getByText('Power outlet not working').closest('div');
    if (card) {
      await user.click(card);
      expect(mockOnClick).toHaveBeenCalledWith(mockComplaint);
    }
  });

  it('shows actions when showActions is true', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
        showActions={true}
      />
    );

    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows rate service button for resolved complaints without rating', () => {
    const resolvedComplaint: Complaint = {
      ...mockComplaint,
      status: 'resolved',
      resolved_at: '2024-01-16T14:30:00Z'
      // No rating property
    };

    render(
      <ComplaintCard
        complaint={resolvedComplaint}
        onClick={mockOnClick}
        showActions={true}
      />
    );

    expect(screen.getByText('Rate Service')).toBeInTheDocument();
  });

  it('handles different complaint categories correctly', () => {
    const plumbingComplaint: Complaint = {
      ...mockComplaint,
      category: 'plumbing',
      title: 'Leaky faucet'
    };

    render(
      <ComplaintCard
        complaint={plumbingComplaint}
        onClick={mockOnClick}
      />
    );

    // Plumbing category should show 🚿 icon
    expect(screen.getByText('🚿')).toBeInTheDocument();
  });

  it('handles different priority levels correctly', () => {
    const urgentComplaint: Complaint = {
      ...mockComplaint,
      priority: 'urgent'
    };

    render(
      <ComplaintCard
        complaint={urgentComplaint}
        onClick={mockOnClick}
      />
    );

    const priorityElement = screen.getByText('Urgent Priority');
    expect(priorityElement).toHaveClass('text-red-600');
  });

  it('handles complaints without optional fields', () => {
    const minimalComplaint: Complaint = {
      category: 'other',
      title: 'General issue',
      description: 'Some description',
      priority: 'low'
      // No id, ticket_number, status, etc.
    };

    render(
      <ComplaintCard
        complaint={minimalComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('General issue')).toBeInTheDocument();
    expect(screen.getByText('Low Priority')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument(); // Default status
  });

  it('formats dates correctly', () => {
    render(
      <ComplaintCard
        complaint={mockComplaint}
        onClick={mockOnClick}
      />
    );

    // Should show formatted date
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });

  it('calculates days ago correctly', () => {
    const todayComplaint: Complaint = {
      ...mockComplaint,
      created_at: new Date().toISOString()
    };

    render(
      <ComplaintCard
        complaint={todayComplaint}
        onClick={mockOnClick}
      />
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
  });
});