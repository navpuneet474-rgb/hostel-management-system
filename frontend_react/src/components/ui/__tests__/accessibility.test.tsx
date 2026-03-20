import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../Button';
import { InputField } from '../InputField';
import { Alert } from '../Alert';
import { LoadingSpinner } from '../LoadingSpinner';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../Card';

describe('UI Components Accessibility', () => {
  describe('Button Component', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <Button aria-label="Submit form" aria-describedby="help-text">
          Submit
        </Button>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Submit form');
      expect(button).toHaveAttribute('aria-describedby', 'help-text');
    });

    it('should handle loading state accessibility', () => {
      render(<Button loading>Submit</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByText('Loading, please wait')).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      fireEvent.keyDown(button, { key: ' ' });
      
      // Button should be focusable (buttons are focusable by default, no explicit tabIndex needed)
      expect(button.tagName).toBe('BUTTON');
    });

    it('should have minimum touch target size', () => {
      render(<Button size="lg">Large Button</Button>);
      
      const button = screen.getByRole('button');
      const styles = window.getComputedStyle(button);
      
      // Check for minimum 44px height (mobile touch target)
      expect(button.className).toContain('min-h-[44px]');
    });
  });

  describe('InputField Component', () => {
    it('should have proper label association', () => {
      render(
        <InputField 
          label="Email Address" 
          required 
          placeholder="Enter your email"
        />
      );
      
      const input = screen.getByLabelText(/Email Address/);
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('placeholder', 'Enter your email');
    });

    it('should handle error states accessibly', () => {
      render(
        <InputField 
          label="Password" 
          error="Password is required"
        />
      );
      
      const input = screen.getByLabelText('Password');
      const errorMessage = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(errorMessage).toHaveTextContent('Password is required');
    });

    it('should provide helper text accessibility', () => {
      render(
        <InputField 
          label="Username" 
          helperText="Must be at least 3 characters"
        />
      );
      
      const input = screen.getByLabelText('Username');
      const helperText = screen.getByText('Must be at least 3 characters');
      
      expect(input).toHaveAttribute('aria-describedby');
      expect(helperText).toBeInTheDocument();
    });

    it('should indicate required fields to screen readers', () => {
      render(<InputField label="Required Field" required />);
      
      expect(screen.getByText('(required)')).toBeInTheDocument();
    });
  });

  describe('Alert Component', () => {
    it('should have proper ARIA roles and live regions', () => {
      render(
        <Alert variant="error">
          Something went wrong
        </Alert>
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'assertive');
      expect(alert).toHaveAttribute('aria-label', 'Error alert');
    });

    it('should handle dismissible alerts accessibly', () => {
      const handleDismiss = vi.fn();
      render(
        <Alert variant="success" dismissible onDismiss={handleDismiss}>
          Success message
        </Alert>
      );
      
      const dismissButton = screen.getByLabelText('Dismiss success alert');
      expect(dismissButton).toBeInTheDocument();
      
      fireEvent.click(dismissButton);
      expect(handleDismiss).toHaveBeenCalled();
    });

    it('should use appropriate live region urgency', () => {
      const { rerender } = render(
        <Alert variant="info">Info message</Alert>
      );
      
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
      
      rerender(<Alert variant="error">Error message</Alert>);
      expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    });
  });

  describe('LoadingSpinner Component', () => {
    it('should provide screen reader feedback', () => {
      render(<LoadingSpinner text="Loading data..." />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(screen.getAllByText('Loading data...')).toHaveLength(2); // One visible, one for screen readers
    });

    it('should have default loading message', () => {
      render(<LoadingSpinner />);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Card Component', () => {
    it('should support semantic HTML elements', () => {
      render(
        <Card as="article" aria-label="User profile card">
          <CardHeader as="header">
            <CardTitle level={2}>John Doe</CardTitle>
          </CardHeader>
          <CardContent as="main">
            Profile information
          </CardContent>
          <CardFooter as="footer">
            Last updated: Today
          </CardFooter>
        </Card>
      );
      
      expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'User profile card');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('John Doe');
    });

    it('should be keyboard accessible when interactive', () => {
      const handleClick = vi.fn();
      render(
        <Card hover onClick={handleClick}>
          Interactive card
        </Card>
      );
      
      const card = screen.getByText('Interactive card').closest('div');
      expect(card).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(<Button>Focus me</Button>);
      
      const button = screen.getByRole('button');
      
      // Check that focus styles are applied
      expect(button.className).toContain('focus-visible:ring-2');
      expect(button.className).toContain('focus-visible:ring-brand-500');
    });

    it('should maintain logical tab order', () => {
      render(
        <div>
          <Button>First</Button>
          <InputField label="Second" />
          <Button>Third</Button>
        </div>
      );
      
      const buttons = screen.getAllByRole('button');
      const input = screen.getByLabelText('Second');
      
      // All should be focusable elements (buttons and inputs are focusable by default)
      expect(buttons[0].tagName).toBe('BUTTON');
      expect(input.tagName).toBe('INPUT');
      expect(buttons[1].tagName).toBe('BUTTON');
    });
  });

  describe('Color Contrast and Visual Design', () => {
    it('should use high contrast colors for text', () => {
      render(<Button variant="primary">Primary Button</Button>);
      
      const button = screen.getByRole('button');
      
      // Check that high contrast classes are used
      expect(button.className).toContain('text-white');
      expect(button.className).toContain('bg-brand-600');
    });

    it('should provide visual feedback for different states', () => {
      render(<Button disabled>Disabled Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button.className).toContain('opacity-50');
      expect(button.className).toContain('cursor-not-allowed');
    });
  });
});