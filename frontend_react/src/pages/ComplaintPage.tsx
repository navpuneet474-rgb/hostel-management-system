import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ComplaintForm, ComplaintFormData } from '../components/forms/ComplaintForm';
import { ComplaintHistory } from '../components/ui/ComplaintHistory';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { ComplaintProgress } from '../components/ui/ComplaintStatus';
import { submitComplaint, getComplaints } from '../api/endpoints';
import type { Complaint } from '../types';

const ComplaintPage: React.FC = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Load complaints on component mount
  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getComplaints();
      setComplaints(response.data || []);
    } catch (err) {
      console.error('Error loading complaints:', err);
      setError('Failed to load complaints. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitComplaint = async (formData: ComplaintFormData) => {
    try {
      setSubmitting(true);
      
      // Create FormData for file upload
      const submitData = new FormData();
      submitData.append('category', formData.category);
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      submitData.append('priority', formData.priority);
      
      if (formData.room_number) {
        submitData.append('room_number', formData.room_number);
      }
      
      // Add photos if any
      if (formData.photos && formData.photos.length > 0) {
        formData.photos.forEach((photo, index) => {
          submitData.append(`photos`, photo);
        });
      }

      const result = await submitComplaint(submitData as any);
      
      // Refresh complaints list
      await loadComplaints();
      
      return result;
    } catch (err) {
      console.error('Error submitting complaint:', err);
      throw new Error('Failed to submit complaint. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplaintClick = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
  };

  const closeComplaintDetail = () => {
    setSelectedComplaint(null);
  };

  const closeForm = () => {
    setShowForm(false);
  };

  // Get user's room number from profile
  const userRoomNumber = user?.profile?.roomNumber;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Complaint Management
              </h1>
              <p className="text-sm text-gray-600">
                Report and track maintenance issues
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-2"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Complaint</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error alert */}
        {error && (
          <Alert variant="error" className="mb-6" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Quick stats */}
        {!loading && complaints.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            {[
              { 
                label: 'Total Complaints', 
                value: complaints.length, 
                color: 'text-blue-600',
                bgColor: 'bg-blue-50'
              },
              { 
                label: 'In Progress', 
                value: complaints.filter(c => c.status === 'in_progress').length,
                color: 'text-orange-600',
                bgColor: 'bg-orange-50'
              },
              { 
                label: 'Resolved', 
                value: complaints.filter(c => c.status === 'resolved').length,
                color: 'text-green-600',
                bgColor: 'bg-green-50'
              },
              { 
                label: 'Pending', 
                value: complaints.filter(c => ['submitted', 'assigned'].includes(c.status || 'submitted')).length,
                color: 'text-yellow-600',
                bgColor: 'bg-yellow-50'
              }
            ].map((stat, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                      <div className={`text-lg font-bold ${stat.color}`}>
                        {stat.value}
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Complaints history */}
        <Card>
          <CardHeader>
            <CardTitle>Your Complaints</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplaintHistory
              complaints={complaints}
              loading={loading}
              error={error}
              onComplaintClick={handleComplaintClick}
              onRefresh={loadComplaints}
              showFilters={true}
            />
          </CardContent>
        </Card>
      </div>

      {/* New complaint form modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title="Submit New Complaint"
        size="lg"
      >
        <ComplaintForm
          onSubmit={handleSubmitComplaint}
          loading={submitting}
          onCancel={closeForm}
          userRoomNumber={userRoomNumber}
        />
      </Modal>

      {/* Complaint detail modal */}
      <Modal
        isOpen={!!selectedComplaint}
        onClose={closeComplaintDetail}
        title="Complaint Details"
        size="lg"
      >
        {selectedComplaint && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {selectedComplaint.title}
                </h3>
                {selectedComplaint.ticket_number && (
                  <p className="text-sm text-gray-500 font-mono">
                    Ticket #{selectedComplaint.ticket_number}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">
                  Submitted {new Date(selectedComplaint.created_at || '').toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-400">
                  Room: {selectedComplaint.room_number}
                </p>
              </div>
            </div>

            {/* Status progress */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-4">Progress</h4>
              <ComplaintProgress currentStatus={selectedComplaint.status || 'submitted'} />
            </div>

            {/* Description */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {selectedComplaint.description}
              </p>
            </div>

            {/* Photos */}
            {selectedComplaint.photos && selectedComplaint.photos.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Photos</h4>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {selectedComplaint.photos.map((photo, index) => (
                    <div key={index} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                      {typeof photo === 'string' ? (
                        <img
                          src={photo}
                          alt={`Complaint photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution */}
            {selectedComplaint.resolution && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-900 mb-2">Resolution</h4>
                <p className="text-sm text-green-800">
                  {selectedComplaint.resolution}
                </p>
                {selectedComplaint.resolved_at && (
                  <p className="text-xs text-green-600 mt-2">
                    Resolved on {new Date(selectedComplaint.resolved_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={closeComplaintDetail}>
                Close
              </Button>
              {selectedComplaint.status === 'resolved' && !selectedComplaint.rating && (
                <Button variant="primary">
                  Rate Service
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export { ComplaintPage };