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
import type { Complaint, ComplaintCategory, ComplaintPriority } from '../../types';

export interface ComplaintFormData {
  category: ComplaintCategory;
  title: string;
  description: string;
  priority: ComplaintPriority;
  photos?: File[];
  room_number?: string;
}

export interface ComplaintFormProps {
  onSubmit: (data: ComplaintFormData) => Promise<{ ticket_number?: string; id?: string }>;
  loading?: boolean;
  initialData?: Partial<ComplaintFormData>;
  onCancel?: () => void;
  userRoomNumber?: string;
}

interface FormErrors {
  category?: string;
  title?: string;
  description?: string;
  priority?: string;
  photos?: string;
  room_number?: string;
  general?: string;
}

const COMPLAINT_CATEGORIES: { value: ComplaintCategory; label: string; icon: string }[] = [
  { value: 'electrical', label: 'Electrical Issues', icon: '⚡' },
  { value: 'plumbing', label: 'Plumbing & Water', icon: '🚿' },
  { value: 'furniture', label: 'Furniture & Fixtures', icon: '🪑' },
  { value: 'cleaning', label: 'Cleaning & Hygiene', icon: '🧹' },
  { value: 'internet', label: 'Internet & WiFi', icon: '📶' },
  { value: 'security', label: 'Security & Safety', icon: '🔒' },
  { value: 'other', label: 'Other Issues', icon: '📝' }
];

const PRIORITY_LEVELS: { value: ComplaintPriority; label: string; description: string; color: string }[] = [
  { 
    value: 'low', 
    label: 'Low Priority', 
    description: 'Minor issues that can wait', 
    color: 'text-green-600 bg-green-50 border-green-200' 
  },
  { 
    value: 'medium', 
    label: 'Medium Priority', 
    description: 'Issues affecting daily comfort', 
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200' 
  },
  { 
    value: 'high', 
    label: 'High Priority', 
    description: 'Issues affecting basic functionality', 
    color: 'text-orange-600 bg-orange-50 border-orange-200' 
  },
  { 
    value: 'urgent', 
    label: 'Urgent', 
    description: 'Safety hazards or complete failures', 
    color: 'text-red-600 bg-red-50 border-red-200' 
  }
];

const ComplaintForm: React.FC<ComplaintFormProps> = ({
  onSubmit,
  loading = false,
  initialData,
  onCancel,
  userRoomNumber
}) => {
  const [formData, setFormData] = useState<ComplaintFormData>({
    category: initialData?.category || 'other',
    title: initialData?.title || '',
    description: initialData?.description || '',
    priority: initialData?.priority || 'medium',
    photos: initialData?.photos || [],
    room_number: initialData?.room_number || userRoomNumber || ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string>('');

  // Progress steps
  const steps: ProgressStep[] = [
    {
      id: 'category',
      label: 'Category',
      description: 'Issue type'
    },
    {
      id: 'details',
      label: 'Details',
      description: 'Description & priority'
    },
    {
      id: 'evidence',
      label: 'Evidence',
      description: 'Photos & location'
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

    // Category validation
    if (!formData.category) {
      newErrors.category = 'Please select an issue category';
    }

    // Title validation
    if (!formData.title || formData.title.trim().length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }

    if (formData.title && formData.title.length > 100) {
      newErrors.title = 'Title cannot exceed 100 characters';
    }

    // Description validation
    if (!formData.description || formData.description.trim().length < 10) {
      newErrors.description = 'Please provide a detailed description (minimum 10 characters)';
    }

    if (formData.description && formData.description.length > 1000) {
      newErrors.description = 'Description cannot exceed 1000 characters';
    }

    // Priority validation
    if (!formData.priority) {
      newErrors.priority = 'Please select a priority level';
    }

    // Room number validation
    if (!formData.room_number || formData.room_number.trim().length === 0) {
      newErrors.room_number = 'Room number is required';
    }

    return newErrors;
  };

  // Auto-advance steps based on form completion
  useEffect(() => {
    const newErrors = validateForm();
    
    if (!newErrors.category && formData.category && currentStep === 0) {
      setCurrentStep(1);
    }

    if (!newErrors.title && !newErrors.description && !newErrors.priority && 
        formData.title && formData.description && formData.priority && currentStep === 1) {
      setCurrentStep(2);
    }

    if (!newErrors.room_number && formData.room_number && currentStep === 2) {
      setCurrentStep(3);
    }
  }, [formData.category, formData.title, formData.description, formData.priority, formData.room_number, currentStep]);

  const handleInputChange = (field: keyof ComplaintFormData, value: string | File[]) => {
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
      const result = await onSubmit(formData);
      setTicketNumber(result.ticket_number || '');
      setSubmitSuccess(true);
    } catch (error) {
      setErrors({
        general: 'Failed to submit complaint. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryIcon = (category: ComplaintCategory) => {
    return COMPLAINT_CATEGORIES.find(cat => cat.value === category)?.icon || '📝';
  };

  const getPriorityColor = (priority: ComplaintPriority) => {
    return PRIORITY_LEVELS.find(p => p.value === priority)?.color || 'text-gray-600 bg-gray-50 border-gray-200';
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
          Complaint Submitted Successfully!
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Your complaint has been registered and assigned to the maintenance team.
        </p>
        {ticketNumber && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-sm mx-auto">
            <p className="text-sm font-medium text-blue-900">Ticket Number</p>
            <p className="text-lg font-mono font-bold text-blue-700">{ticketNumber}</p>
            <p className="text-xs text-blue-600 mt-1">
              Save this number to track your complaint status
            </p>
          </div>
        )}
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

      <Form onSubmit={handleSubmit} spacing="lg">
        {/* Step 1: Category Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Issue Category</h3>
          
          <FormField>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              What type of issue are you reporting? *
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMPLAINT_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  onClick={() => handleInputChange('category', category.value)}
                  className={`
                    relative p-4 border rounded-lg text-left transition-all duration-200
                    hover:border-brand-300 hover:bg-brand-50
                    focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500
                    ${formData.category === category.value
                      ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500'
                      : 'border-gray-200 bg-white'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {category.label}
                      </p>
                    </div>
                  </div>
                  {formData.category === category.value && (
                    <div className="absolute top-2 right-2">
                      <svg className="h-5 w-5 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-sm text-red-600 mt-2">{errors.category}</p>
            )}
          </FormField>
        </div>

        {/* Step 2: Issue Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Issue Details</h3>
          
          <FormField>
            <InputField
              name="title"
              type="text"
              label="Issue Title"
              placeholder="Brief summary of the issue"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              error={errors.title}
              helperText={`${formData.title.length}/100 characters`}
              required
              maxLength={100}
            />
          </FormField>

          <FormField>
            <Textarea
              name="description"
              label="Detailed Description"
              placeholder="Please provide a detailed description of the issue, including when it started, what you've tried, and how it affects you..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={errors.description}
              helperText={`${formData.description.length}/1000 characters`}
              required
              rows={5}
              maxLength={1000}
            />
          </FormField>

          <FormField>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Priority Level *
            </label>
            <div className="space-y-2">
              {PRIORITY_LEVELS.map((priority) => (
                <button
                  key={priority.value}
                  type="button"
                  onClick={() => handleInputChange('priority', priority.value)}
                  className={`
                    w-full p-3 border rounded-lg text-left transition-all duration-200
                    hover:border-opacity-80 focus:outline-none focus:ring-2 focus:ring-brand-500
                    ${formData.priority === priority.value
                      ? `${priority.color} border-opacity-100 ring-2 ring-current ring-opacity-20`
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{priority.label}</p>
                      <p className="text-sm opacity-75">{priority.description}</p>
                    </div>
                    {formData.priority === priority.value && (
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
            {errors.priority && (
              <p className="text-sm text-red-600 mt-2">{errors.priority}</p>
            )}
          </FormField>
        </div>

        {/* Step 3: Evidence and Location */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Evidence & Location</h3>
          
          <FormField>
            <InputField
              name="room_number"
              type="text"
              label="Room Number"
              placeholder="e.g., A-201, B-105"
              value={formData.room_number}
              onChange={(e) => handleInputChange('room_number', e.target.value)}
              error={errors.room_number}
              required
            />
          </FormField>

          <FormField>
            <FileUpload
              label="Photos (Optional but Recommended)"
              helperText="Upload photos of the issue to help maintenance understand the problem better"
              accept="image/*"
              multiple
              maxFiles={5}
              maxSize={5 * 1024 * 1024} // 5MB
              onFilesChange={(files) => handleInputChange('photos', files)}
              error={errors.photos}
            />
          </FormField>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg className="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-900">Photo Tips</h4>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• Take clear, well-lit photos of the issue</li>
                  <li>• Include multiple angles if helpful</li>
                  <li>• Show the overall area and close-up details</li>
                  <li>• Photos help maintenance prepare the right tools</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Step 4: Review */}
        {currentStep >= 3 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Review Your Complaint</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getCategoryIcon(formData.category)}</span>
                <div>
                  <p className="text-sm font-medium text-gray-700">Category</p>
                  <p className="text-sm text-gray-900">
                    {COMPLAINT_CATEGORIES.find(cat => cat.value === formData.category)?.label}
                  </p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Issue Title</p>
                <p className="text-sm text-gray-900">{formData.title}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700">Description</p>
                <p className="text-sm text-gray-900">{formData.description}</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Priority</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(formData.priority)}`}>
                    {PRIORITY_LEVELS.find(p => p.value === formData.priority)?.label}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Room</p>
                  <p className="text-sm text-gray-900">{formData.room_number}</p>
                </div>
              </div>
              
              {formData.photos && formData.photos.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Photos Attached</p>
                  <p className="text-sm text-gray-900">{formData.photos.length} photo(s) uploaded</p>
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
            {isSubmitting ? 'Submitting Complaint...' : 'Submit Complaint'}
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

export { ComplaintForm };