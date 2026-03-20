import React, { useEffect, useState } from 'react';
import { AppShell } from '../layouts/AppShell';
import { 
  LeaveRequestHistory, 
  Button, 
  Modal, 
  LeaveRequestForm,
  Alert 
} from '../components/ui';
import { 
  getStudentDashboardData, 
  submitLeaveRequest 
} from '../api/endpoints';
import type { LeaveRequest } from '../components/ui';
import type { LeaveRequestData } from '../components/ui';

export const LeaveRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    
    try {
      const data = await getStudentDashboardData();
      
      // Transform the data to match our LeaveRequest interface
      const transformedRequests: LeaveRequest[] = (data.passes?.results || data.passes || []).map((pass: any) => ({
        id: pass.id || pass.pass_number || Math.random().toString(),
        from_date: pass.from_date || pass.start_date || '',
        to_date: pass.to_date || pass.end_date || '',
        reason: pass.reason || pass.purpose || 'No reason provided',
        status: pass.status || 'pending',
        created_at: pass.created_at || new Date().toISOString(),
        updated_at: pass.updated_at,
        emergency: pass.emergency || false,
        supporting_documents: pass.supporting_documents || [],
        approval_chain: pass.approval_chain || []
      }));
      
      setRequests(transformedRequests);
    } catch (err) {
      setError('Failed to load leave requests. Please try again.');
      console.error('Error loading requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleNewRequest = async (data: LeaveRequestData) => {
    setSubmitLoading(true);
    
    try {
      // Convert File objects to FormData for API submission
      const formData = new FormData();
      formData.append('from_date', data.from_date);
      formData.append('to_date', data.to_date);
      formData.append('reason', data.reason);
      
      if (data.emergency) {
        formData.append('emergency', 'true');
      }
      
      // Add supporting documents
      if (data.supporting_documents && data.supporting_documents.length > 0) {
        data.supporting_documents.forEach((file, index) => {
          formData.append(`supporting_document_${index}`, file);
        });
      }

      await submitLeaveRequest(formData as any);
      
      setAlert({ 
        type: 'success', 
        message: 'Leave request submitted successfully!' 
      });
      
      // Reload requests to show the new one
      void loadRequests();
      
    } catch (err) {
      setAlert({ 
        type: 'error', 
        message: 'Failed to submit leave request. Please try again.' 
      });
      console.error('Error submitting request:', err);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    // TODO: Implement cancel request API call
    setAlert({ 
      type: 'info', 
      message: 'Cancel request functionality will be implemented soon.' 
    });
  };

  const handleViewDetails = (id: string) => {
    // TODO: Implement view details modal or navigation
    setAlert({ 
      type: 'info', 
      message: 'View details functionality will be implemented soon.' 
    });
  };

  return (
    <AppShell title="Leave Requests">
      <div className="space-y-6">
        {/* Alert */}
        {alert && (
          <Alert
            variant={alert.type}
            dismissible
            onDismiss={() => setAlert(null)}
          >
            {alert.message}
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and track your leave requests
            </p>
          </div>
          
          <Button
            variant="primary"
            onClick={() => setIsNewRequestOpen(true)}
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Request
          </Button>
        </div>

        {/* Leave Request History */}
        <LeaveRequestHistory
          requests={requests}
          loading={loading}
          error={error}
          onCancel={handleCancelRequest}
          onViewDetails={handleViewDetails}
          onRefresh={loadRequests}
        />

        {/* New Request Modal */}
        <Modal
          isOpen={isNewRequestOpen}
          onClose={() => setIsNewRequestOpen(false)}
          title="Submit New Leave Request"
          size="lg"
        >
          <LeaveRequestForm
            onSubmit={handleNewRequest}
            loading={submitLoading}
            onCancel={() => setIsNewRequestOpen(false)}
          />
        </Modal>
      </div>
    </AppShell>
  );
};