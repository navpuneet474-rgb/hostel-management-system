import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestVerification, type GuestVerificationData } from '../GuestVerification';

describe('GuestVerification', () => {
  const mockOnApproveEntry = vi.fn();
  const mockOnDenyEntry = vi.fn();
  const mockOnReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validGuestData: GuestVerificationData = {
    guest_name: 'John Doe',
    guest_phone: '+1 555 123 4567',
    purpose: 'Family visit',
    from_time: new Date().toISOString(),
    to_time: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    student_name: 'Alice Smith',
    room_number: '201A',
    status: 'valid',
    verification_code: 'ABC12345'
  };

  it('renders guest information correctly', () => {
    render(
      <GuestVerification
        guestData={validGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('+1 555 123 4567')).toBeInTheDocument();
    expect(screen.getByText('Family visit')).toBeInTheDocument();
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('(Room 201A)')).toBeInTheDocument();
    expect(screen.getByText('ABC12345')).toBeInTheDocument();
  });

  it('shows valid status and approve/deny buttons for valid guest', () => {
    render(
      <GuestVerification
        guestData={validGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('Valid Entry')).toBeInTheDocument();
    expect(screen.getByText(/guest verification successful/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve entry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /deny entry/i })).toBeInTheDocument();
  });

  it('shows expired status and scan another button for expired guest', () => {
    const expiredGuestData: GuestVerificationData = {
      ...validGuestData,
      status: 'expired'
    };

    render(
      <GuestVerification
        guestData={expiredGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText(/this guest pass has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /scan another code/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve entry/i })).not.toBeInTheDocument();
  });

  it('shows invalid status for invalid guest', () => {
    const invalidGuestData: GuestVerificationData = {
      ...validGuestData,
      status: 'invalid'
    };

    render(
      <GuestVerification
        guestData={invalidGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText('Invalid Code')).toBeInTheDocument();
    expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
  });

  it('shows already entered status for guest who already entered', () => {
    const enteredGuestData: GuestVerificationData = {
      ...validGuestData,
      status: 'already_entered',
      entry_time: new Date().toISOString(),
      current_status: 'inside'
    };

    render(
      <GuestVerification
        guestData={enteredGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(screen.getByText(/this guest entered the hostel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record exit/i })).toBeInTheDocument();
  });

  it('calls onApproveEntry when approve button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestVerification
        guestData={validGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    const approveButton = screen.getByRole('button', { name: /approve entry/i });
    await user.click(approveButton);

    expect(mockOnApproveEntry).toHaveBeenCalled();
  });

  it('calls onDenyEntry when deny button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestVerification
        guestData={validGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    const denyButton = screen.getByRole('button', { name: /deny entry/i });
    await user.click(denyButton);

    expect(mockOnDenyEntry).toHaveBeenCalled();
  });

  it('calls onReset when scan another code button is clicked', async () => {
    const user = userEvent.setup();
    const expiredGuestData: GuestVerificationData = {
      ...validGuestData,
      status: 'expired'
    };
    
    render(
      <GuestVerification
        guestData={expiredGuestData}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    const resetButton = screen.getByRole('button', { name: /scan another code/i });
    await user.click(resetButton);

    expect(mockOnReset).toHaveBeenCalled();
  });

  it('calls onApproveExit when record exit button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnApproveExit = vi.fn();
    const enteredGuestData: GuestVerificationData = {
      ...validGuestData,
      status: 'already_entered',
      entry_time: new Date().toISOString(),
      current_status: 'inside'
    };
    
    render(
      <GuestVerification
        guestData={enteredGuestData}
        onApproveEntry={mockOnApproveEntry}
        onApproveExit={mockOnApproveExit}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    const exitButton = screen.getByRole('button', { name: /record exit/i });
    await user.click(exitButton);

    expect(mockOnApproveExit).toHaveBeenCalled();
  });

  it('returns null when no guest data is provided', () => {
    const { container } = render(
      <GuestVerification
        guestData={null}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('displays guest photo when available', () => {
    const guestDataWithPhoto: GuestVerificationData = {
      ...validGuestData,
      guest_photo: 'data:image/jpeg;base64,mock-photo-data'
    };

    render(
      <GuestVerification
        guestData={guestDataWithPhoto}
        onApproveEntry={mockOnApproveEntry}
        onDenyEntry={mockOnDenyEntry}
        onReset={mockOnReset}
      />
    );

    const photoImg = screen.getByAltText('Photo of John Doe');
    expect(photoImg).toBeInTheDocument();
    expect(photoImg).toHaveAttribute('src', 'data:image/jpeg;base64,mock-photo-data');
  });
});