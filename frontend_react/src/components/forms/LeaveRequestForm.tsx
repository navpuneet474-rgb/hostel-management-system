import React, { useState, useEffect } from 'react';
import { 
  Form, 
  FormField, 
  InputField, 
  Textarea, 
  Button, 
  Alert,
  LoadingSpinner,
  ProgressIndicator
} from '../ui';
import { FileUpload } from '../ui/FileUpload';
import type { ProgressStep } from '../ui/ProgressIndicator';

export interface LeaveRequestData {
  from_date: string;
  to_date: string;
  reason: string;
  supporting_documents?: File[];
  emergency?: boolean;
}

export interface LeaveRequestFormProps {
  onSubmit: (data: LeaveRequestData) => Promise<void>;
  loading?: boolean;
  initialData?: Partial<LeaveRequestData>;
  onCancel?: () => void;
}

interface FormErrors {
  from_date?: string;
  to_date?: string;
  reason?: string;
  supporting_documents?: string;
  general?: string;
}

const LeaveRequestForm: React.FC<LeaveRequestFormProps> = ({
  onSubmit,
  loading = false,
  initialData,
  onCancel
}) => {
  const [formData, setFormData] = useState<LeaveRequestData>({
    from_date: initialData?.from_date || '',
    to_date: initialData?.to_date || '',
    reason: initialData?.reason || '',
    supporting_documents: initialData?.supporting_documents || [],
    emergency: initialData?.emergency || false
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Progress steps
  const steps: ProgressStep[] = [
    {
      id: 'dates',
      label: 'Dates',
      description: 'Select leave period'
    },
    {
      id: 'details',
      label: 'Details',
      description: 'Reason & documents'
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Confirm & submit'
    }
  ];

  // Form validation
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Date validation
    if (!formData.from_date) {
      newErrors.from_date = 'From date is required';
    }

    if (!formData.to_date) {
      newErrors.to_date = 'To date is required';
    }

    if (formData.from_date && formData.to_date) {
      const fromDate = new Date(formData.from_date);
      const toDate = new Date(formData.to_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (fromDate < today && !formData.emergency) {
        newErrors.from_date = 'From date cannot be in the past';
      }

      if (toDate < fromDate) {
        newErrors.to_date = 'To date must be after from date';
      }

      // Check for reasonable leave duration (max 30 days for regular leave)
      const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30 && !formData.emergency) {
        newErrors.to_date = 'Leave duration cannot exceed 30 days';
      }
    }

    // Reason validation
    if (!formData.reason || formData.reason.trim().length < 10) {
      newErrors.reason = 'Please provide a detailed reason (minimum 10 characters)';
    }

    if (formData.reason && formData.reason.length > 500) {
      newErrors.reason = 'Reason cannot exceed 500 characters';
    }

    return newErrors;
  };

  // Auto-advance steps based on form completion
  useEffect(() => {
    const newErrors = validateForm();
    
    if (!newErrors.from_date && !newErrors.to_date && formData.from_date && formData.to_date) {
      if (currentStep === 0) {
        setCurrentStep(1);
      }
    }

    if (!newErrors.reason && formData.reason && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [formData.from_date, formData.to_date, formData.reason, currentStep]);

  const handleInputChange = (field: keyof LeaveRequestData, value: string | boolean | File[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field-specific errors
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      setErrors(prev => ({
        ...prev,
        general: 'Please fix the errors above before submitting'
      }));
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(formData);
      setSubmitSuccess(true);
    } catch (error) {
      setErrors({
        general: 'Failed to submit leave request. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateDuration = () => {
    if (!formData.from_date || !formData.to_date) return '';
    
    const fromDate = new Date(formData.from_date);
    const toDate = new Date(formData.to_date);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    return `${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
  };

  // Success state
  if (submitSuccess) {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Leave Request Submitted Successfully!
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Your request has been sent for approval. You'll receive notifications about status updates.
        </p>
        <Button
          variant="primary"
          onClick={onCancel}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <ProgressIndicator
        steps={steps}
        currentStep={currentStep}
        size="sm"
      />

      {/* General Error Alert */}
      {errors.general && (
        <Alert variant="error" dismissible onDismiss={() => setErrors(prev => ({ ...prev, general: undefined }))}>
          {errors.general}
        </Alert>
      )}

      {/* Emergency Leave Toggle */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="emergency"
            checked={formData.emergency}
            onChange={(e) => handleInputChange('emergency', e.target.checked)}
            className="mt-1 h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
          />
          <div className="flex-1">
            <label htmlFor="emergency" className="text-sm font-medium text-yellow-800">
              Emergency Leave Request
            </label>
            <p className="text-xs text-yellow-700 mt-1">
              Check this for same-day or urgent leave requests that require immediate processing
            </p>
          </div>
        </div>
      </div>

      <Form onSubmit={handleSubmit} spacing="lg">
        {/* Step 1: Dates */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Leave Dates</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <InputField
                name="from_date"
                type="date"
                label="From Date"
                value={formData.from_date}
                onChange={(e) => handleInputChange('from_date', e.target.value)}
                error={errors.from_date}
                required
                min={formData.emergency ? undefined : new Date().toISOString().split('T')[0]}
              />
            </FormField>

            <FormField>
              <InputField
                name="to_date"
                type="date"
                label="To Date"
                value={formData.to_date}
                onChange={(e) => handleInputChange('to_date', e.target.value)}
                error={errors.to_date}
                required
                min={formData.from_date || new Date().toISOString().split('T')[0]}
              />
            </FormField>
          </div>

          {/* Duration display */}
          {formData.from_date && formData.to_date && !errors.from_date && !errors.to_date && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Duration:</strong> {calculateDuration()}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                From {formatDate(formData.from_date)} to {formatDate(formData.to_date)}
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Leave Details</h3>
          
          <FormField>
            <Textarea
              name="reason"
              label="Reason for Leave"
              placeholder="Please provide a detailed reason for your leave request..."
              value={formData.reason}
              onChange={(e) => handleInputChange('reason', e.target.value)}
              error={errors.reason}
              helperText={`${formData.reason.length}/500 characters`}
              required
              rows={4}
              maxLength={500}
            />
          </FormField>

          <FormField>
            <FileUpload
              label="Supporting Documents (Optional)"
              helperText="Upload any supporting documents like medical certificates, travel tickets, etc."
              accept="image/*,.pdf,.doc,.docx"
              multiple
              maxFiles={3}
              maxSize={5 * 1024 * 1024} // 5MB
              onFilesChange={(files) => handleInputChange('supporting_documents', files)}
              error={errors.supporting_documents}
            />
          </FormField>
        </div>

        {/* Step 3: Review */}
        {currentStep >= 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Review Your Request</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">From Date</p>
                  <p className="text-sm text-gray-900">{formatDate(formData.from_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">To Date</p>
                  <p className="text-sm text-gray-900">{formatDate(formData.to_date)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Duration</p>
                <p className="text-sm text-gray-900">{calculateDuration()}</p>
              </div>

              {formData.emergency && (
                <div>
                  <p className="text-sm font-medium text-red-700">Emergency Request</p>
                  <p className="text-xs text-red-600">This request will be prioritized for immediate processing</p>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-700">Reason</p>
                <p className="text-sm text-gray-900">{formData.reason}</p>
              </div>
              
              {formData.supporting_documents && formData.supporting_documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Supporting Documents</p>
                  <ul className="text-sm text-gray-900 list-disc list-inside">
                    {formData.supporting_documents.map((file, index) => (
                      <li key={index}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="flex space-x-3 pt-4 border-t border-gray-200">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting || loading}
            disabled={Object.keys(validateForm()).length > 0}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Leave Request'}
          </Button>
          
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onCancel}
            disabled={isSubmitting || loading}
          >
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
};

export { LeaveRequestForm };