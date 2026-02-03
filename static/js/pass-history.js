/**
 * Pass History JavaScript
 * Handles loading, filtering, and exporting pass history data
 */

// Global state
let currentHistory = [];
let currentFilters = {};

/**
 * Get CSRF token from DOM
 */
function getCSRFToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    // Fallback to meta tag
    if (!cookieValue) {
        const element = document.querySelector('meta[name="csrf-token"]');
        if (element) {
            cookieValue = element.getAttribute('content');
        }
    }
    return cookieValue;
}

/**
 * Load pass history from the API
 */
async function loadPassHistory() {
    try {
        // Show loading state
        showLoading();
        
        // Build query parameters from filters
        const params = new URLSearchParams();
        
        if (currentFilters.startDate) {
            params.append('start_date', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('end_date', currentFilters.endDate);
        }
        if (currentFilters.studentName) {
            params.append('student_name', currentFilters.studentName);
        }
        if (currentFilters.passType) {
            params.append('pass_type', currentFilters.passType);
        }
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        
        // Make API request with CSRF token
        const response = await fetch(`/api/pass-history/?${params.toString()}`, {
            method: 'GET',
            headers: {
                'X-CSRFToken': getCSRFToken(),
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load pass history');
        }
        
        const data = await response.json();
        
        if (data.success) {
            currentHistory = data.history;
            renderHistory(data.history);
            updateStatistics(data.total_records);
        } else {
            showError('Failed to load pass history: ' + (data.error || 'Unknown error'));
        }
        
    } catch (error) {
        console.error('Error loading pass history:', error);
        showError('An error occurred while loading pass history');
    }
}

/**
 * Render history data in the table
 */
function renderHistory(history) {
    const tbody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('emptyState');
    
    // Clear existing content
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        // Show empty state
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <i class="fas fa-inbox text-4xl text-gray-300 mb-3"></i>
                        <p class="text-gray-500">No records found</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Render each record
    history.forEach(record => {
        const row = createHistoryRow(record);
        tbody.appendChild(row);
    });
}

/**
 * Create a table row for a history record
 */
function createHistoryRow(record) {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50 transition-colors';
    
    // Type badge
    const typeBadge = record.type === 'digital_pass' 
        ? '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Digital Pass</span>'
        : '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Leave Request</span>';
    
    // Status badge
    const statusBadge = getStatusBadge(record.status);
    
    // Format dates
    const fromDate = formatDate(record.from_date);
    const toDate = formatDate(record.to_date);
    const createdAt = formatDateTime(record.created_at);
    
    row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
            ${typeBadge}
        </td>
        <td class="px-6 py-4">
            <div class="text-sm font-medium text-gray-900">${escapeHtml(record.student_name)}</div>
            <div class="text-sm text-gray-500">${escapeHtml(record.student_id)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${escapeHtml(record.room_number)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm font-mono text-gray-900">${escapeHtml(record.pass_number)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            <div class="text-sm text-gray-900">${fromDate}</div>
            <div class="text-sm text-gray-500">to ${toDate}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${record.total_days} ${record.total_days === 1 ? 'day' : 'days'}
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
            ${statusBadge}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
            ${escapeHtml(record.approved_by)}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${createdAt}
        </td>
    `;
    
    return row;
}

/**
 * Get status badge HTML
 */
function getStatusBadge(status) {
    const badges = {
        'approved': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Approved</span>',
        'rejected': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejected</span>',
        'pending': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span>',
        'active': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Active</span>',
        'expired': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Expired</span>',
        'cancelled': '<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Cancelled</span>'
    };
    
    return badges[status] || `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">${status}</span>`;
}

/**
 * Apply filters and reload history
 */
function applyFilters() {
    // Get filter values
    currentFilters = {
        startDate: document.getElementById('startDate').value,
        endDate: document.getElementById('endDate').value,
        studentName: document.getElementById('studentName').value.trim(),
        passType: document.getElementById('passType').value,
        status: document.getElementById('statusFilter').value
    };
    
    // Reload history with filters
    loadPassHistory();
}

/**
 * Clear all filters
 */
function clearFilters() {
    // Clear filter inputs
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    document.getElementById('studentName').value = '';
    document.getElementById('passType').value = '';
    document.getElementById('statusFilter').value = '';
    
    // Clear filter state
    currentFilters = {};
    
    // Reload history
    loadPassHistory();
}

/**
 * Refresh history data
 */
function refreshHistory() {
    loadPassHistory();
}

/**
 * Export history to CSV
 */
async function exportHistory() {
    try {
        // Build query parameters from current filters
        const params = new URLSearchParams();
        
        if (currentFilters.startDate) {
            params.append('start_date', currentFilters.startDate);
        }
        if (currentFilters.endDate) {
            params.append('end_date', currentFilters.endDate);
        }
        if (currentFilters.studentName) {
            params.append('student_name', currentFilters.studentName);
        }
        if (currentFilters.passType) {
            params.append('pass_type', currentFilters.passType);
        }
        if (currentFilters.status) {
            params.append('status', currentFilters.status);
        }
        
        // Trigger download
        window.location.href = `/api/pass-history/export/?${params.toString()}`;
        
        // Show success message
        showSuccess('Export started. Your download should begin shortly.');
        
    } catch (error) {
        console.error('Error exporting history:', error);
        showError('Failed to export pass history');
    }
}

/**
 * Update statistics display
 */
function updateStatistics(totalRecords) {
    document.getElementById('totalRecords').textContent = totalRecords;
    document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
}

/**
 * Show loading state
 */
function showLoading() {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                    <i class="fas fa-spinner fa-spin text-4xl text-gray-400 mb-3"></i>
                    <p class="text-gray-500">Loading pass history...</p>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Show error message
 */
function showError(message) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="px-6 py-12 text-center">
                <div class="flex flex-col items-center justify-center">
                    <i class="fas fa-exclamation-circle text-4xl text-red-400 mb-3"></i>
                    <p class="text-red-600 font-semibold mb-2">Error</p>
                    <p class="text-gray-500">${escapeHtml(message)}</p>
                </div>
            </td>
        </tr>
    `;
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${escapeHtml(message)}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Format date string
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Format datetime string
 */
function formatDateTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add event listeners for filter inputs (apply on Enter key)
document.addEventListener('DOMContentLoaded', function() {
    const filterInputs = ['startDate', 'endDate', 'studentName', 'passType', 'statusFilter'];
    
    filterInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    applyFilters();
                }
            });
        }
    });
    
    // Load initial pass history with default filters
    setTimeout(function() {
        loadPassHistory();
    }, 500);
});
