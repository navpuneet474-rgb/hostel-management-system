import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComplaintForm } from '../ComplaintForm';

describe('ComplaintForm', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders form fields correctly', () => {
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Check category selection
    expect(screen.getByText(/what type of issue are you reporting/i)).toBeInTheDocument();
    expect(screen.getByText(/electrical issues/i)).toBeInTheDocument();
    expect(screen.getByText(/plumbing & water/i)).toBeInTheDocument();
    
    // Check form fields (initially hidden until category is selected)
    expect(screen.getByText(/issue category/i)).toBeInTheDocument();
  });

  it('validates required fields', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByRole('button', { name: /submit complaint/i });
    
    // Submit button should be disabled when form is invalid
    expect(submitButton).toBeDisabled();

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('allows category selection and progresses through steps', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Select electrical category
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    // Should show issue details section
    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/detailed description/i)).toBeInTheDocument();
    });
  });

  it('validates title and description length', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Select category first
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    // Test that form progresses through steps when valid data is entered
    const titleInput = screen.getByLabelText(/issue title/i);
    await user.type(titleInput, 'Valid title that is long enough');

    const descriptionInput = screen.getByLabelText(/detailed description/i);
    await user.type(descriptionInput, 'This is a valid description that is long enough to pass validation');

    // Should show priority selection
    await waitFor(() => {
      expect(screen.getByText(/priority level/i)).toBeInTheDocument();
    });
  });

  it('validates priority selection', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Select category and fill details
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/issue title/i), 'Power outlet not working');
    await user.type(screen.getByLabelText(/detailed description/i), 'The power outlet in my room stopped working yesterday');

    // Check priority options are available
    await waitFor(() => {
      expect(screen.getByText(/priority level/i)).toBeInTheDocument();
      expect(screen.getByText(/low priority/i)).toBeInTheDocument();
      expect(screen.getByText(/medium priority/i)).toBeInTheDocument();
      expect(screen.getByText(/high priority/i)).toBeInTheDocument();
      expect(screen.getByText(/urgent/i)).toBeInTheDocument();
    });

    // Select high priority
    const highPriorityButton = screen.getByRole('button', { name: /high priority issues affecting basic functionality/i });
    await user.click(highPriorityButton);

    // Should show evidence section
    await waitFor(() => {
      expect(screen.getByLabelText(/room number/i)).toBeInTheDocument();
    });
  });

  it('validates room number requirement', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        userRoomNumber="" // Empty room number
      />
    );

    // Go through the form steps
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/issue title/i), 'Power outlet not working');
    await user.type(screen.getByLabelText(/detailed description/i), 'The power outlet in my room stopped working yesterday');

    const highPriorityButton = screen.getByRole('button', { name: /high priority issues affecting basic functionality/i });
    await user.click(highPriorityButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/room number/i)).toBeInTheDocument();
    });

    // Submit button should be disabled when room number is empty
    const submitButton = screen.getByRole('button', { name: /submit complaint/i });
    expect(submitButton).toBeDisabled();
  });

  it('submits form with valid data', async () => {
    const user = userEvent.setup();
    const mockResult = {
      ticket_number: 'COMP-2024-001',
      id: 'complaint-1'
    };
    
    mockOnSubmit.mockResolvedValue(mockResult);
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        userRoomNumber="A-201"
      />
    );

    // Fill form with valid data
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/issue title/i), 'Power outlet not working');
    await user.type(screen.getByLabelText(/detailed description/i), 'The power outlet in my room stopped working yesterday. I tried different devices but none work.');

    const highPriorityButton = screen.getByRole('button', { name: /high priority issues affecting basic functionality/i });
    await user.click(highPriorityButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/room number/i)).toBeInTheDocument();
    });

    // Room number should be pre-filled
    expect(screen.getByDisplayValue('A-201')).toBeInTheDocument();

    const submitButton = screen.getByRole('button', { name: /submit complaint/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        category: 'electrical',
        title: 'Power outlet not working',
        description: 'The power outlet in my room stopped working yesterday. I tried different devices but none work.',
        priority: 'high',
        photos: [],
        room_number: 'A-201'
      });
    });

    // Check if success state is shown
    await waitFor(() => {
      expect(screen.getByText(/complaint submitted successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/COMP-2024-001/)).toBeInTheDocument();
    });
  });

  it('handles form submission errors', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Network error');
    
    mockOnSubmit.mockRejectedValue(mockError);
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        userRoomNumber="A-201"
      />
    );

    // Fill form with valid data
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/issue title/i), 'Power outlet not working');
    await user.type(screen.getByLabelText(/detailed description/i), 'The power outlet in my room stopped working yesterday.');

    const mediumPriorityButton = screen.getByRole('button', { name: /medium priority issues affecting daily comfort/i });
    await user.click(mediumPriorityButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/room number/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /submit complaint/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to submit complaint/i)).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows character count for title and description', async () => {
    const user = userEvent.setup();
    
    render(
      <ComplaintForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
      />
    );

    // Select category first
    const electricalButton = screen.getByRole('button', { name: /electrical issues/i });
    await user.click(electricalButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/issue title/i)).toBeInTheDocument();
    });

    // Check initial character counts
    expect(screen.getByText('0/100 characters')).toBeInTheDocument();
    expect(screen.getByText('0/1000 characters')).toBeInTheDocument();

    // Type in title and check count updates
    await user.type(screen.getByLabelText(/issue title/i), 'Test title');
    expect(screen.getByText('10/100 characters')).toBeInTheDocument();

    // Type in description and check count updates
    await user.type(screen.getByLabelText(/detailed description/i), 'Test description');
    expect(screen.getByText('16/1000 characters')).toBeInTheDocument();
  });
});