import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestRequestForm } from '../GuestRequestForm';

// Mock QRCode library
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code')
  }
}));

describe('GuestRequestForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields correctly', () => {
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByLabelText(/guest name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guest phone number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/purpose of visit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/visit start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/visit end time/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /generate guest qr code/i });
    
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/guest name must be at least 2 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/guest phone number is required/i)).toBeInTheDocument();
      expect(screen.getByText(/please provide a detailed purpose/i)).toBeInTheDocument();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('validates phone number format', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const phoneInput = screen.getByLabelText(/guest phone number/i);
    
    await user.type(phoneInput, '123');
    await user.tab(); // Trigger validation

    await waitFor(() => {
      expect(screen.getByText(/please enter a valid phone number/i)).toBeInTheDocument();
    });
  });

  it('validates visit duration', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const now = new Date();
    const fromTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const toTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now (invalid)

    const fromInput = screen.getByLabelText(/visit start time/i);
    const toInput = screen.getByLabelText(/visit end time/i);

    await user.type(fromInput, fromTime.toISOString().slice(0, 16));
    await user.type(toInput, toTime.toISOString().slice(0, 16));

    await waitFor(() => {
      expect(screen.getByText(/visit end time must be after start time/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data and shows QR code', async () => {
    const user = userEvent.setup();
    const mockResult = {
      qr_code: 'GUEST_123456',
      verification_code: 'ABC12345',
      id: 'guest-1'
    };
    
    mockOnSubmit.mockResolvedValue(mockResult);
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill form with valid data
    await user.type(screen.getByLabelText(/guest name/i), 'John Doe');
    await user.type(screen.getByLabelText(/guest phone number/i), '+1 555 123 4567');
    await user.type(screen.getByLabelText(/purpose of visit/i), 'Family visit for birthday celebration');

    const now = new Date();
    const fromTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
    const toTime = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now

    await user.type(screen.getByLabelText(/visit start time/i), fromTime.toISOString().slice(0, 16));
    await user.type(screen.getByLabelText(/visit end time/i), toTime.toISOString().slice(0, 16));

    const submitButton = screen.getByRole('button', { name: /generate guest qr code/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        guest_name: 'John Doe',
        guest_phone: '+1 555 123 4567',
        purpose: 'Family visit for birthday celebration',
        from_time: fromTime.toISOString().slice(0, 16),
        to_time: toTime.toISOString().slice(0, 16),
        guest_photo: undefined
      });
    });

    // Check if success state is shown
    await waitFor(() => {
      expect(screen.getByText(/guest request approved/i)).toBeInTheDocument();
      expect(screen.getByText(/qr code generated successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/ABC12345/)).toBeInTheDocument();
    });
  });

  it('handles form submission errors', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Network error');
    
    mockOnSubmit.mockRejectedValue(mockError);
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Fill form with valid data
    await user.type(screen.getByLabelText(/guest name/i), 'John Doe');
    await user.type(screen.getByLabelText(/guest phone number/i), '+1 555 123 4567');
    await user.type(screen.getByLabelText(/purpose of visit/i), 'Family visit');

    const now = new Date();
    const fromTime = new Date(now.getTime() + 60 * 60 * 1000);
    const toTime = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    await user.type(screen.getByLabelText(/visit start time/i), fromTime.toISOString().slice(0, 16));
    await user.type(screen.getByLabelText(/visit end time/i), toTime.toISOString().slice(0, 16));

    const submitButton = screen.getByRole('button', { name: /generate guest qr code/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to submit guest request/i)).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <GuestRequestForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});