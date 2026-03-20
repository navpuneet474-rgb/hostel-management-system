// API Configuration
export const API_CONFIG = {
  // Base URL for the Django backend
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  
  // API endpoints
  ENDPOINTS: {
    AUTH: {
      LOGIN: '/auth/login/',
      LOGOUT: '/auth/logout/',
      CSRF: '/auth/csrf/',
      CHANGE_PASSWORD: '/auth/change-password/',
    },
    API: {
      DASHBOARD_DATA: '/api/dashboard-data/',
      DIGITAL_PASSES: '/api/digital-passes/',
      ABSENCE_RECORDS: '/api/absence-records/',
      GUEST_REQUESTS: '/api/guest-requests/',
      MAINTENANCE_REQUESTS: '/api/maintenance-requests/',
      SUBMIT_LEAVE_REQUEST: '/api/submit-leave-request/',
      APPROVE_REQUEST: '/api/approve-request/',
      REJECT_REQUEST: '/api/reject-request/',
      PASS_HISTORY: '/api/pass-history/',
      VERIFY_PASS: '/api/verify-pass/',
      VERIFY_GUEST: '/api/verify-guest/',
      GUEST_ENTRY_LOG: '/api/guest-entry-log/',
      ACTIVE_GUESTS: '/api/active-guests/',
      COMPLAINTS: '/api/complaints/',
      SUBMIT_COMPLAINT: '/api/submit-complaint/',
    }
  },
  
  // Request timeout in milliseconds
  TIMEOUT: 10000,
  
  // Default headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
  }
} as const;