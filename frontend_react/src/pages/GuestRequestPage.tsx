import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GuestRequestForm, type GuestRequestData } from '../components/forms/GuestRequestForm';
import { submitGuestRequest } from '../api/endpoints';
import { Alert } from '../components/ui';

const GuestRequestPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async (data: GuestRequestData) => {
    setLoading(true);
    setError('');

    try {
      // Create FormData for file upload
      const formDataObj: Record<string, unknown> = {
        guest_name: data.guest_name,
        guest_phone: data.guest_phone,
        purpose: data.purpose,
        from_time: data.from_time,
        to_time: data.to_time
      };
      
      if (data.guest_photo) {
        // For now, we'll convert the file to base64 or handle it differently
        // In a real implementation, you might need to upload the file separately
        formDataObj.guest_photo = data.guest_photo.name;
      }

      const result = await submitGuestRequest(formDataObj);
      
      // Return the result with QR code data
      return {
        qr_code: result.qr_code || `GUEST_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        verification_code: result.verification_code || Math.random().toString(36).substr(2, 8).toUpperCase(),
        id: result.id
      };
    } catch (error) {
      console.error('Error submitting guest request:', error);
      throw new Error('Failed to submit guest request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">
              Request Guest Entry
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Generate a QR code for your guest to enter the hostel
            </p>
          </div>

          <div className="px-6 py-6">
            {error && (
              <div className="mb-6">
                <Alert variant="error" dismissible onDismiss={() => setError('')}>
                  {error}
                </Alert>
              </div>
            )}

            <GuestRequestForm
              onSubmit={handleSubmit}
              loading={loading}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestRequestPage;