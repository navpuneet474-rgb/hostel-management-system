import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { 
  Form, 
  FormField, 
  InputField, 
  Textarea, 
  Button, 
  Alert,
  LoadingSpinner,
  ProgressIndicator,
  Card
} from '../ui';
import { FileUpload } from '../ui/FileUpload';
import type { ProgressStep } from '../ui/ProgressIndicator';
import type { GuestRequest } from '../../types';

export interface GuestRequestData {
  guest_name: string;
  guest_phone: string;
  guest_photo?: File;
  purpose: string;
  from_time: string;
  to_time: string;
}

export interface GuestRequestFormProps {
  onSubmit: (data: GuestRequestData) => Promise<{ qr_code?: string; verification_code?: string; id?: string }>;
  loading?: boolean;
  initialData?: Partial<GuestRequestData>;
  onCancel?: () => void;
}

interface FormErrors {
  guest_name?: string;
  guest_phone?: string;
  guest_photo?: string;
  purpose?: string;
  from_time?: string;
  to_time?: string;
  general?: string;
}

const GuestRequestForm: React.FC<GuestRequestFormProps> = ({
  onSubmit,
  loading = false,
  initialData,
  onCancel
}) => {
  const [formData, setFormData] = useState<GuestRequestData>({
    guest_name: initialData?.guest_name || '',
    guest_phone: initialData?.guest_phone || '',
    guest_photo: initialData?.guest_photo,
    purpose: initialData?.purpose || '',
    from_time: initialData?.from_time || '',
    to_time: initialData?.to_time || ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{
    qr_code?: string;
    verification_code?: string;
    qr_image?: string;
  }>({});

  // Progress steps
  const steps: ProgressStep[] = [
    {
      id: 'guest-info',
      label: 'Guest Info',
      description: 'Visitor details'
    },
    {
      id: 'visit-details',
      label: 'Visit Details',
      description: 'Purpose & timing'
    },
    {
      id: 'review',
      label: 'Review',
      description: 'Confirm & generate QR'
    }
  ];

  // Form validation
  const validateForm = (): FormErrors => {
    const newErrors: FormErrors = {};

    // Guest name validation
    if (!formData.guest_name || formData.guest_name.trim().length < 2) {
      newErrors.guest_name = 'Guest name must be at least 2 characters';
    }

    if (formData.guest_name && formData.guest_name.length > 100) {
      newErrors.guest_name = 'Guest name cannot exceed 100 characters';
    }

    // Phone validation
    if (!formData.guest_phone) {
      newErrors.guest_phone = 'Guest phone number is required';
    } else if (!/^\+?[\d\s\-\(\)]{10,15}$/.test(formData.guest_phone.replace(/\s/g, ''))) {
      newErrors.guest_phone = 'Please enter a valid phone number';
    }

    // Purpose validation
    if (!formData.purpose || formData.purpose.trim().length < 5) {
      newErrors.purpose = 'Please provide a detailed purpose (minimum 5 characters)';
    }

    if (formData.purpose && formData.purpose.length > 200) {
      newErrors.purpose = 'Purpose cannot exceed 200 characters';
    }

    // Time validation
    if (!formData.from_time) {
      newErrors.from_time = 'Visit start time is required';
    }

    if (!formData.to_time) {
      newErrors.to_time = 'Visit end time is required';
    }

    if (formData.from_time && formData.to_time) {
      const fromTime = new Date(formData.from_time);
      const toTime = new Date(formData.to_time);
      const now = new Date();

      if (fromTime < now) {
        newErrors.from_time = 'Visit start time cannot be in the past';
      }

      if (toTime <= fromTime) {
        newErrors.to_time = 'Visit end time must be after start time';
      }

      // Check for reasonable visit duration (max 24 hours)
      const hoursDiff = (toTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        newErrors.to_time = 'Visit duration cannot exceed 24 hours';
      }

      if (hoursDiff < 0.5) {
        newErrors.to_time = 'Visit duration must be at least 30 minutes';
      }
    }

    return newErrors;
  };

  // Auto-advance steps based on form completion
  useEffect(() => {
    const newErrors = validateForm();
    
    if (!newErrors.guest_name && !newErrors.guest_phone && formData.guest_name && formData.guest_phone) {
      if (currentStep === 0) {
        setCurrentStep(1);
      }
    }

    if (!newErrors.purpose && !newErrors.from_time && !newErrors.to_time && 
        formData.purpose && formData.from_time && formData.to_time && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [formData.guest_name, formData.guest_phone, formData.purpose, formData.from_time, formData.to_time, currentStep]);

  const handleInputChange = (field: keyof GuestRequestData, value: string | File[]) => {
    if (field === 'guest_photo' && Array.isArray(value)) {
      setFormData(prev => ({
        ...prev,
        [field]: value[0] || undefined
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }

    // Clear field-specific errors
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const generateQRCode = async (data: string): Promise<string> => {
    try {
      const qrDataURL = await QRCode.toDataURL(data, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      return qrDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
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
      
      // Generate QR code image from the returned QR code data
      if (result.qr_code) {
        const qrImage = await generateQRCode(result.qr_code);
        setQrCodeData({
          qr_code: result.qr_code,
          verification_code: result.verification_code,
          qr_image: qrImage
        });
      }
      
      setSubmitSuccess(true);
    } catch (error) {
      setErrors({
        general: 'Failed to submit guest request. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return '';
    return new Date(dateTimeString).toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = () => {
    if (!formData.from_time || !formData.to_time) return '';
    
    const fromTime = new Date(formData.from_time);
    const toTime = new Date(formData.to_time);
    const hoursDiff = (toTime.getTime() - fromTime.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff < 1) {
      const minutes = Math.round(hoursDiff * 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    const hours = Math.floor(hoursDiff);
    const minutes = Math.round((hoursDiff - hours) * 60);
    
    if (minutes === 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    
    return `${hours}h ${minutes}m`;
  };

  const shareQRCode = async () => {
    if (!qrCodeData.qr_image) return;

    try {
      if (navigator.share) {
        // Use Web Share API if available
        const response = await fetch(qrCodeData.qr_image);
        const blob = await response.blob();
        const file = new File([blob], 'guest-qr-code.png', { type: 'image/png' });
        
        await navigator.share({
          title: 'Guest Entry QR Code',
          text: `Guest entry code for ${formData.guest_name}. Verification code: ${qrCodeData.verification_code}`,
          files: [file]
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(
          `Guest entry for ${formData.guest_name}\nVerification code: ${qrCodeData.verification_code}\nValid from ${formatDateTime(formData.from_time)} to ${formatDateTime(formData.to_time)}`
        );
        alert('Guest details copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing QR code:', error);
      // Fallback: show manual sharing instructions
      alert(`Please share this verification code with your guest: ${qrCodeData.verification_code}`);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeData.qr_image) return;

    const link = document.createElement('a');
    link.download = `guest-qr-${formData.guest_name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = qrCodeData.qr_image;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Success state with QR code
  if (submitSuccess && qrCodeData.qr_image) {
    return (
      <div className="text-center py-8 space-y-6">
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
        
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Guest Request Approved!
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            QR code generated successfully. Share this with your guest for entry.
          </p>
        </div>

        {/* QR Code Display */}
        <Card className="max-w-sm mx-auto p-6">
          <div className="space-y-4">
            <img
              src={qrCodeData.qr_image}
              alt="Guest entry QR code"
              className="mx-auto w-48 h-48 border border-gray-200 rounded-lg"
            />
            
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-gray-900">
                Guest: {formData.guest_name}
              </p>
              <p className="text-xs text-gray-600">
                Valid: {formatDateTime(formData.from_time)} - {formatDateTime(formData.to_time)}
              </p>
              <p className="text-xs text-gray-500">
                Backup Code: <span className="font-mono font-medium">{qrCodeData.verification_code}</span>
              </p>
            </div>
          </div>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="primary"
            onClick={shareQRCode}
            className="flex items-center space-x-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
            </svg>
            <span>Share QR Code</span>
          </Button>
          
          <Button
            variant="secondary"
            onClick={downloadQRCode}
            className="flex items-center space-x-2"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download</span>
          </Button>
          
          <Button
            variant="outline"
            onClick={onCancel}
          >
            Close
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left max-w-md mx-auto">
          <h4 className="text-sm font-medium text-blue-900 mb-2">Instructions for your guest:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Show this QR code to security at the entrance</li>
            <li>• If QR scanner is unavailable, provide the backup code</li>
            <li>• Carry a valid ID for verification</li>
            <li>• QR code expires at the specified end time</li>
          </ul>
        </div>
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
        {/* Step 1: Guest Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Guest Information</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <InputField
                name="guest_name"
                type="text"
                label="Guest Name"
                placeholder="Enter guest's full name"
                value={formData.guest_name}
                onChange={(e) => handleInputChange('guest_name', e.target.value)}
                error={errors.guest_name}
                required
                maxLength={100}
              />
            </FormField>

            <FormField>
              <InputField
                name="guest_phone"
                type="tel"
                label="Guest Phone Number"
                placeholder="+1 (555) 123-4567"
                value={formData.guest_phone}
                onChange={(e) => handleInputChange('guest_phone', e.target.value)}
                error={errors.guest_phone}
                required
              />
            </FormField>
          </div>

          <FormField>
            <FileUpload
              label="Guest Photo (Optional)"
              helperText="Upload a photo of your guest for security verification"
              accept="image/*"
              multiple={false}
              maxFiles={1}
              maxSize={2 * 1024 * 1024} // 2MB
              onFilesChange={(files) => handleInputChange('guest_photo', files)}
              error={errors.guest_photo}
            />
          </FormField>
        </div>

        {/* Step 2: Visit Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900">Visit Details</h3>
          
          <FormField>
            <Textarea
              name="purpose"
              label="Purpose of Visit"
              placeholder="Please describe the purpose of the visit..."
              value={formData.purpose}
              onChange={(e) => handleInputChange('purpose', e.target.value)}
              error={errors.purpose}
              helperText={`${formData.purpose.length}/200 characters`}
              required
              rows={3}
              maxLength={200}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField>
              <InputField
                name="from_time"
                type="datetime-local"
                label="Visit Start Time"
                value={formData.from_time}
                onChange={(e) => handleInputChange('from_time', e.target.value)}
                error={errors.from_time}
                required
                min={new Date().toISOString().slice(0, 16)}
              />
            </FormField>

            <FormField>
              <InputField
                name="to_time"
                type="datetime-local"
                label="Visit End Time"
                value={formData.to_time}
                onChange={(e) => handleInputChange('to_time', e.target.value)}
                error={errors.to_time}
                required
                min={formData.from_time || new Date().toISOString().slice(0, 16)}
              />
            </FormField>
          </div>

          {/* Duration display */}
          {formData.from_time && formData.to_time && !errors.from_time && !errors.to_time && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Visit Duration:</strong> {calculateDuration()}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                From {formatDateTime(formData.from_time)} to {formatDateTime(formData.to_time)}
              </p>
            </div>
          )}
        </div>

        {/* Step 3: Review */}
        {currentStep >= 2 && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Review Guest Request</h3>
            
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Guest Name</p>
                  <p className="text-sm text-gray-900">{formData.guest_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Phone Number</p>
                  <p className="text-sm text-gray-900">{formData.guest_phone}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Purpose of Visit</p>
                <p className="text-sm text-gray-900">{formData.purpose}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Start Time</p>
                  <p className="text-sm text-gray-900">{formatDateTime(formData.from_time)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">End Time</p>
                  <p className="text-sm text-gray-900">{formatDateTime(formData.to_time)}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-700">Duration</p>
                <p className="text-sm text-gray-900">{calculateDuration()}</p>
              </div>
              
              {formData.guest_photo && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Guest Photo</p>
                  <p className="text-sm text-gray-900">✓ Photo uploaded</p>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <svg className="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Important Notes</h4>
                  <ul className="text-xs text-yellow-700 mt-1 space-y-1">
                    <li>• QR code will be generated after submission</li>
                    <li>• Guest must carry valid ID for verification</li>
                    <li>• QR code expires automatically at end time</li>
                    <li>• Security may ask additional questions at entry</li>
                  </ul>
                </div>
              </div>
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
            {isSubmitting ? 'Generating QR Code...' : 'Generate Guest QR Code'}
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

export { GuestRequestForm };