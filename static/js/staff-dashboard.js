/**
 * Staff Dashboard JavaScript with Caching Support
 * Enhanced dashboard with real-time statistics and intelligent caching
 */

class StaffDashboard {
    constructor() {
        this.refreshInterval = null;
        this.autoRefreshEnabled = true;
        this.autoRefreshDelay = 30000; // 30 seconds
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboardData();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadDashboardData(true); // Force refresh
        });

        // User menu dropdown
        this.setupUserMenu();

        // Add Student button
        this.setupAddStudentModal();

        // Request tabs
        document.querySelectorAll('.request-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // Staff query form
        document.getElementById('staff-query-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitStaffQuery();
        });

        // Request action buttons (approve/reject)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('approve-btn')) {
                this.handleRequestAction(e.target.getAttribute('data-id'), 
                                       e.target.getAttribute('data-type'), 'approve');
            } else if (e.target.classList.contains('reject-btn')) {
                this.handleRequestAction(e.target.getAttribute('data-id'), 
                                       e.target.getAttribute('data-type'), 'reject');
            } else if (e.target.classList.contains('approve-leave-btn') || e.target.closest('.approve-leave-btn')) {
                const btn = e.target.classList.contains('approve-leave-btn') ? e.target : e.target.closest('.approve-leave-btn');
                this.handleLeaveRequestAction(
                    btn.getAttribute('data-absence-id'),
                    btn.getAttribute('data-student-name'),
                    btn.getAttribute('data-total-days'),
                    'approve'
                );
            } else if (e.target.classList.contains('reject-leave-btn') || e.target.closest('.reject-leave-btn')) {
                const btn = e.target.classList.contains('reject-leave-btn') ? e.target : e.target.closest('.reject-leave-btn');
                this.handleLeaveRequestAction(
                    btn.getAttribute('data-absence-id'),
                    btn.getAttribute('data-student-name'),
                    btn.getAttribute('data-total-days'),
                    'reject'
                );
            }
        });

        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideModal();
        });
        document.getElementById('cancel-action').addEventListener('click', () => {
            this.hideModal();
        });
        document.getElementById('confirm-action').addEventListener('click', () => {
            this.confirmAction();
        });

        // View full summary
        document.getElementById('view-full-summary').addEventListener('click', () => {
            this.showFullSummary();
        });

        // Present students details (click on present count)
        const presentCountElement = document.getElementById('present-count');
        if (presentCountElement) {
            presentCountElement.style.cursor = 'pointer';
            presentCountElement.addEventListener('click', () => {
                this.showPresentStudentsDetails();
            });
        }
    }

    async loadDashboardData(forceRefresh = false) {
        try {
            this.showLoading();
            
            const url = `/api/dashboard-data/${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                this.updateDashboard(result.data);
                this.showCacheInfo(result.data.cache_info);
            } else {
                this.showError('Failed to load dashboard data: ' + (result.error || 'Unknown error'));
            }

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showError('Network error. Please check your connection.');
        } finally {
            this.hideLoading();
        }
    }

    updateDashboard(data) {
        // Update statistics
        this.updateStatistics(data.stats);
        
        // Update pending requests
        this.updatePendingRequests(data.pending_requests);
        
        // Update recent activity
        this.updateRecentActivity(data.recent_activity);
        
        // Update daily summary
        this.updateDailySummary(data.daily_summary);
    }

    updateStatistics(stats) {
        // Update main statistics cards
        this.updateElement('pending-count', stats.total_pending_requests || 0);
        this.updateElement('present-count', stats.present_students || 0);
        this.updateElement('students-count', stats.total_students || 0);
        this.updateElement('guests-count', stats.active_guests || 0);
        
        // Update second row statistics
        this.updateElement('absent-count', stats.absent_students || 0);
        this.updateElement('occupancy-rate', (stats.occupancy_rate || 0) + '%');
        this.updateElement('high-priority-count', stats.high_priority_maintenance || 0);
        this.updateElement('todays-activity', stats.todays_requests || 0);

        // Update tab counts
        this.updateElement('guest-tab-count', stats.pending_guest_requests || 0);
        this.updateElement('absence-tab-count', stats.pending_absence_requests || 0);
        this.updateElement('maintenance-tab-count', stats.pending_maintenance_requests || 0);

        // Add visual indicators for high values
        this.updateStatisticsIndicators(stats);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateStatisticsIndicators(stats) {
        // Highlight high priority maintenance
        const highPriorityElement = document.getElementById('high-priority-count');
        if (highPriorityElement) {
            const card = highPriorityElement.closest('.bg-white');
            if (stats.high_priority_maintenance > 0) {
                card.classList.add('ring-2', 'ring-orange-200', 'ring-opacity-50');
            } else {
                card.classList.remove('ring-2', 'ring-orange-200', 'ring-opacity-50');
            }
        }

        // Highlight low occupancy
        const occupancyElement = document.getElementById('occupancy-rate');
        if (occupancyElement) {
            const card = occupancyElement.closest('.bg-white');
            if (stats.occupancy_rate < 70) {
                card.classList.add('ring-2', 'ring-yellow-200', 'ring-opacity-50');
            } else {
                card.classList.remove('ring-2', 'ring-yellow-200', 'ring-opacity-50');
            }
        }
    }

    updatePendingRequests(requests) {
        // Update guest requests
        this.renderRequestList('guest-requests-list', requests.guest_requests, 'guest');
        
        // Update absence requests
        this.renderRequestList('absence-requests-list', requests.absence_requests, 'absence');
        
        // Update maintenance requests
        this.renderRequestList('maintenance-requests-list', requests.maintenance_requests, 'maintenance');
    }

    renderRequestList(containerId, requests, type) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!requests || requests.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-3xl mb-2"></i>
                    <p>No pending ${type} requests</p>
                </div>
            `;
            return;
        }

        container.innerHTML = requests.map(request => {
            return this.renderRequestCard(request, type);
        }).join('');
    }

    renderRequestCard(request, type) {
        const createdAt = new Date(request.created_at).toLocaleDateString();
        
        if (type === 'guest') {
            const startDate = new Date(request.start_date).toLocaleDateString();
            const endDate = new Date(request.end_date).toLocaleDateString();
            const relationship = request.relationship_display || request.relationship || 'Not specified';
            
            return `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <h4 class="font-medium text-gray-900">${request.guest_name}</h4>
                            <p class="text-sm text-purple-600 font-medium">Relationship: ${relationship}</p>
                            <p class="text-sm text-gray-600">Host: ${request.student__name || request.student_name} (Room ${request.student__room_number || request.student_room})</p>
                            <p class="text-sm text-gray-500">Stay: ${startDate} - ${endDate}</p>
                            <p class="text-xs text-gray-400">Requested: ${createdAt}</p>
                        </div>
                        <div class="flex space-x-2 ml-4">
                            <button class="approve-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm" 
                                    data-id="${request.request_id || request.id}" data-type="guest">
                                Approve
                            </button>
                            <button class="reject-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm" 
                                    data-id="${request.request_id || request.id}" data-type="guest">
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'absence') {
            const startDate = new Date(request.start_date).toLocaleDateString();
            const endDate = new Date(request.end_date).toLocaleDateString();
            const totalDays = Math.ceil((new Date(request.end_date) - new Date(request.start_date)) / (1000 * 60 * 60 * 24)) + 1;
            
            return `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <h4 class="font-medium text-gray-900">${request.student__name}</h4>
                                <span class="px-2 py-1 rounded-full text-xs ${totalDays <= 2 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                                    ${totalDays} day${totalDays > 1 ? 's' : ''}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600">Room ${request.student__room_number}, Block ${request.student__block || 'N/A'}</p>
                            <p class="text-sm text-gray-500">Leave: ${startDate} - ${endDate}</p>
                            ${request.reason ? `<p class="text-sm text-gray-500">Reason: ${request.reason}</p>` : ''}
                            ${request.emergency_contact ? `<p class="text-sm text-gray-500">Emergency Contact: ${request.emergency_contact}</p>` : ''}
                            <p class="text-xs text-gray-400">Requested: ${createdAt}</p>
                        </div>
                        <div class="flex space-x-2 ml-4">
                            <button class="approve-leave-btn bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1" 
                                    data-absence-id="${request.absence_id}" data-student-name="${request.student__name}" data-total-days="${totalDays}">
                                <i class="fas fa-check text-xs"></i>
                                <span>Approve & Generate Pass</span>
                            </button>
                            <button class="reject-leave-btn bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center space-x-1" 
                                    data-absence-id="${request.absence_id}" data-student-name="${request.student__name}">
                                <i class="fas fa-times text-xs"></i>
                                <span>Reject</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'maintenance') {
            const priorityColors = {
                'high': 'text-red-600 bg-red-100',
                'medium': 'text-yellow-600 bg-yellow-100',
                'low': 'text-green-600 bg-green-100'
            };
            
            return `
                <div class="border border-gray-200 rounded-lg p-4">
                    <div class="flex justify-between items-start">
                        <div class="flex-1">
                            <div class="flex items-center space-x-2 mb-1">
                                <h4 class="font-medium text-gray-900">Room ${request.room_number}</h4>
                                <span class="px-2 py-1 rounded-full text-xs ${priorityColors[request.priority] || 'text-gray-600 bg-gray-100'}">
                                    ${request.priority || 'medium'}
                                </span>
                            </div>
                            <p class="text-sm text-gray-600">${request.issue_type || 'General'} Issue</p>
                            <p class="text-sm text-gray-500">${request.description}</p>
                            ${request.student__name ? `<p class="text-sm text-gray-500">Reported by: ${request.student__name}</p>` : ''}
                            <p class="text-xs text-gray-400">Reported: ${createdAt}</p>
                        </div>
                        <div class="flex space-x-2 ml-4">
                            <button class="approve-btn bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm" 
                                    data-id="${request.request_id || request.id}" data-type="maintenance">
                                Assign
                            </button>
                            <button class="reject-btn bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm" 
                                    data-id="${request.request_id || request.id}" data-type="maintenance">
                                Defer
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    updateRecentActivity(activity) {
        const container = document.getElementById('recent-activity-list');
        if (!container) return;
        
        if (!activity || activity.length === 0) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p class="text-sm">No recent activity</p>
                </div>
            `;
            return;
        }

        container.innerHTML = activity.map(item => {
            const timestamp = new Date(item.timestamp).toLocaleTimeString();
            const typeIcons = {
                'message': 'fa-comment',
                'maintenance': 'fa-tools',
                'guest_approval': 'fa-user-plus',
                'absence_approval': 'fa-calendar-times'
            };
            
            const statusColors = {
                'approved': 'text-green-600',
                'rejected': 'text-red-600'
            };

            return `
                <div class="flex items-start space-x-3 pb-3 border-b border-gray-100 last:border-b-0">
                    <div class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i class="fas ${typeIcons[item.type] || 'fa-info'} text-gray-600 text-sm"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900">${item.description}</p>
                        <p class="text-xs text-gray-600 mt-0.5">${item.details}</p>
                        <div class="flex items-center justify-between mt-1">
                            <p class="text-xs text-gray-400">${item.student}${item.room ? ' • Room ' + item.room : ''}</p>
                            <p class="text-xs text-gray-400">${timestamp}</p>
                        </div>
                    </div>
                    ${item.status ? `<span class="text-xs font-medium ${statusColors[item.status] || 'text-gray-600'} whitespace-nowrap ml-2">${item.status.toUpperCase()}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    updateDailySummary(summary) {
        const container = document.getElementById('daily-summary-content');
        if (!container) return;
        
        if (!summary || summary.error) {
            container.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p class="text-sm">Unable to load summary</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="space-y-2">
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Students Present:</span>
                    <span class="text-sm font-medium">${summary.students_present || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Students Absent:</span>
                    <span class="text-sm font-medium">${summary.students_absent || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Active Guests:</span>
                    <span class="text-sm font-medium">${summary.active_guests || 0}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Occupancy Rate:</span>
                    <span class="text-sm font-medium">${summary.occupancy_rate || 0}%</span>
                </div>
                <hr class="my-2">
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Today's Requests:</span>
                    <span class="text-sm font-medium">${(summary.todays_activity?.guest_requests || 0) + (summary.todays_activity?.absence_requests || 0) + (summary.todays_activity?.maintenance_requests || 0)}</span>
                </div>
                <div class="flex justify-between">
                    <span class="text-sm text-gray-600">Approvals Today:</span>
                    <span class="text-sm font-medium">${summary.todays_activity?.approvals || 0}</span>
                </div>
            </div>
        `;
    }

    showCacheInfo(cacheInfo) {
        if (!cacheInfo) return;
        
        // Show cache status in console for debugging
        console.log('Cache Status:', {
            stats_cached: cacheInfo.stats_cached,
            requests_cached: cacheInfo.requests_cached,
            activity_cached: cacheInfo.activity_cached,
            summary_cached: cacheInfo.summary_cached,
            last_updated: cacheInfo.last_updated
        });

        // Update refresh button to show cache status
        const refreshBtn = document.getElementById('refresh-btn');
        const icon = refreshBtn.querySelector('i');
        
        if (cacheInfo.stats_cached) {
            icon.classList.add('text-green-600');
            refreshBtn.title = 'Data from cache - Click to refresh';
        } else {
            icon.classList.remove('text-green-600');
            refreshBtn.title = 'Fresh data loaded';
        }
    }

    async showPresentStudentsDetails() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/students-present/');
            const result = await response.json();

            if (result.success) {
                this.displayPresentStudentsModal(result.data);
            } else {
                this.showError('Failed to load present students details');
            }

        } catch (error) {
            console.error('Error loading present students:', error);
            this.showError('Network error loading student details');
        } finally {
            this.hideLoading();
        }
    }

    displayPresentStudentsModal(data) {
        const modal = document.getElementById('action-modal');
        const title = document.getElementById('modal-title');
        const message = document.getElementById('modal-message');
        const reasonContainer = document.getElementById('action-reason').parentElement;
        const confirmBtn = document.getElementById('confirm-action');
        const cancelBtn = document.getElementById('cancel-action');

        title.textContent = `Students Present (${data.total_present})`;
        
        let studentsHtml = '<div class="max-h-96 overflow-y-auto">';
        if (data.students && data.students.length > 0) {
            studentsHtml += data.students.map(student => `
                <div class="flex justify-between items-center py-2 border-b border-gray-100">
                    <div>
                        <span class="font-medium">${student.name}</span>
                        <span class="text-gray-500 text-sm ml-2">Room ${student.room_number}</span>
                    </div>
                    <div class="text-right">
                        ${student.active_guests > 0 ? `<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs">${student.active_guests} guest${student.active_guests > 1 ? 's' : ''}</span>` : ''}
                    </div>
                </div>
            `).join('');
        } else {
            studentsHtml += '<p class="text-gray-500 text-center py-4">No students present</p>';
        }
        studentsHtml += '</div>';

        message.innerHTML = studentsHtml;
        reasonContainer.style.display = 'none';
        confirmBtn.style.display = 'none';
        cancelBtn.textContent = 'Close';

        modal.classList.remove('hidden');
    }

    // ... (rest of the methods remain the same)
    
    switchTab(tabName) {
        // Update tab appearance
        document.querySelectorAll('.request-tab').forEach(tab => {
            tab.classList.remove('active', 'border-blue-500', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        });
        
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active', 'border-blue-500', 'text-blue-600');
            activeTab.classList.remove('border-transparent', 'text-gray-500');
        }

        // Show/hide content
        document.querySelectorAll('.request-content').forEach(content => {
            content.classList.add('hidden');
        });
        
        const targetContent = document.getElementById(`${tabName}-requests`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
        }
    }

    async submitStaffQuery() {
        const queryInput = document.getElementById('query-input');
        const responseDiv = document.getElementById('query-response');
        const responseText = document.getElementById('query-response-text');

        if (!queryInput || !responseDiv || !responseText) return;

        const query = queryInput.value.trim();
        if (!query) return;

        try {
            responseDiv.classList.remove('hidden');
            responseText.textContent = 'Processing your query...';

            const response = await fetch('/api/staff-query/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            responseText.textContent = result.response || result.error || 'No response received';
            queryInput.value = '';

        } catch (error) {
            console.error('Error submitting query:', error);
            responseText.textContent = 'Error processing query. Please try again.';
        }
    }

    async handleLeaveRequestAction(absenceId, studentName, totalDays, action) {
        this.currentLeaveAction = { absenceId, studentName, totalDays, action };
        
        const modal = document.getElementById('action-modal');
        const title = document.getElementById('modal-title');
        const message = document.getElementById('modal-message');
        const confirmBtn = document.getElementById('confirm-action');
        
        if (action === 'approve') {
            title.textContent = 'Approve Leave Request & Generate Digital Pass';
            message.innerHTML = `
                <div class="space-y-3">
                    <p class="text-gray-700">You are about to approve the leave request for:</p>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p class="font-medium text-blue-900">${studentName}</p>
                        <p class="text-sm text-blue-700">Duration: ${totalDays} day${totalDays > 1 ? 's' : ''}</p>
                    </div>
                    <div class="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div class="flex items-center space-x-2">
                            <i class="fas fa-id-card text-green-600"></i>
                            <span class="text-sm font-medium text-green-800">Digital Pass will be generated automatically</span>
                        </div>
                        <p class="text-xs text-green-600 mt-1">The student will receive their digital pass immediately and security records will be updated.</p>
                    </div>
                    <p class="text-gray-600">Please provide an approval reason <span class="text-gray-500 italic">(optional)</span>:</p>
                </div>
            `;
            confirmBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Approve & Generate Pass';
            confirmBtn.className = 'flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center';
        } else {
            title.textContent = 'Reject Leave Request';
            message.innerHTML = `
                <div class="space-y-3">
                    <p class="text-gray-700">You are about to reject the leave request for:</p>
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p class="font-medium text-red-900">${studentName}</p>
                        <p class="text-sm text-red-700">Duration: ${totalDays} day${totalDays > 1 ? 's' : ''}</p>
                    </div>
                    <p class="text-gray-600">Please provide a rejection reason <span class="text-red-600 font-medium">(required)</span>:</p>
                </div>
            `;
            confirmBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Reject Request';
            confirmBtn.className = 'flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center';
        }
        
        modal.classList.remove('hidden');
    }

    async handleRequestAction(requestId, requestType, action) {
        this.currentAction = { requestId, requestType, action };
        
        const modal = document.getElementById('action-modal');
        const title = document.getElementById('modal-title');
        const message = document.getElementById('modal-message');
        
        title.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} Request`;
        message.textContent = `Are you sure you want to ${action} this ${requestType} request?`;
        
        modal.classList.remove('hidden');
    }

    async confirmAction() {
        // Handle enhanced leave request actions
        if (this.currentLeaveAction) {
            await this.confirmLeaveAction();
            return;
        }
        
        // Handle regular request actions
        if (!this.currentAction) return;

        const { requestId, requestType, action } = this.currentAction;
        const reason = document.getElementById('action-reason').value;

        try {
            this.showLoading();
            
            const endpoint = action === 'approve' ? '/api/approve-request/' : '/api/reject-request/';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    request_id: requestId,
                    request_type: requestType,
                    reason: reason
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideModal();
                this.loadDashboardData(); // Refresh data
                this.showSuccess(`Request ${action}d successfully`);
            } else {
                this.showError(result.error || `Failed to ${action} request`);
            }

        } catch (error) {
            console.error(`Error ${action}ing request:`, error);
            this.showError(`Network error. Failed to ${action} request.`);
        } finally {
            this.hideLoading();
        }
    }

    async confirmLeaveAction() {
        if (!this.currentLeaveAction) return;

        const { absenceId, studentName, action } = this.currentLeaveAction;
        const reason = document.getElementById('action-reason').value;

        // Only validate reason for rejection
        if (action === 'reject' && (!reason || !reason.trim())) {
            alert('Rejection reason is required');
            return;
        }

        try {
            this.showLoading();
            
            const endpoint = action === 'approve' ? '/api/approve-leave-request/' : '/api/reject-leave-request/';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    absence_id: absenceId,
                    reason: reason || (action === 'approve' ? 'Approved by warden' : undefined)
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.hideModal();
                this.loadDashboardData(); // Refresh data
                
                if (action === 'approve' && result.digital_pass) {
                    // Show success message with digital pass info
                    this.showLeaveApprovalSuccess(result, studentName);
                } else {
                    this.showSuccess(`Leave request ${action}d successfully`);
                }
            } else {
                this.showError(result.error || `Failed to ${action} leave request`);
            }

        } catch (error) {
            console.error(`Error ${action}ing leave request:`, error);
            this.showError(`Network error. Failed to ${action} leave request.`);
        } finally {
            this.hideLoading();
        }
    }

    showLeaveApprovalSuccess(result, studentName) {
        const digitalPass = result.digital_pass;
        const message = `
            Leave request approved successfully!
            
            Student: ${studentName}
            Digital Pass Generated: ${digitalPass.pass_number}
            Verification Code: ${digitalPass.verification_code}
            Valid: ${digitalPass.from_date} to ${digitalPass.to_date}
            
            The student has been notified and security records have been updated.
        `;
        
        alert(message);
    }

    showFullSummary() {
        // Redirect to a detailed summary page or show expanded modal
        window.open('/api/daily-summary/', '_blank');
    }

    startAutoRefresh() {
        if (this.autoRefreshEnabled) {
            this.refreshInterval = setInterval(() => {
                this.loadDashboardData();
            }, this.autoRefreshDelay);
        }
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    hideModal() {
        const modal = document.getElementById('action-modal');
        const reasonInput = document.getElementById('action-reason');
        
        if (modal) modal.classList.add('hidden');
        if (reasonInput) reasonInput.value = '';
        this.currentAction = null;
        this.currentLeaveAction = null;
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    showError(message) {
        console.error('Dashboard Error:', message);
        alert('Error: ' + message);
    }

    showSuccess(message) {
        console.log('Dashboard Success:', message);
        // You could add a toast notification here
    }

    getCSRFToken() {
        const token = document.querySelector('meta[name="csrf-token"]');
        if (token) {
            return token.getAttribute('content');
        }
        
        // Fallback: try to get from cookie
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, 10) === 'csrftoken=') {
                    cookieValue = decodeURIComponent(cookie.substring(10));
                    break;
                }
            }
        }
        return cookieValue || '';
    }

    setupUserMenu() {
        const userMenuButton = document.getElementById('userMenuButton');
        const userMenu = document.getElementById('userMenu');
        
        if (userMenuButton && userMenu) {
            userMenuButton.addEventListener('click', (e) => {
                e.stopPropagation();
                userMenu.classList.toggle('hidden');
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!userMenuButton.contains(e.target) && !userMenu.contains(e.target)) {
                    userMenu.classList.add('hidden');
                }
            });
        }
    }

    setupAddStudentModal() {
        // Add Student button functionality
        window.openCreateStudentModal = () => {
            const modal = document.getElementById('createStudentModal');
            if (modal) {
                modal.classList.remove('hidden');
            }
        };

        window.closeCreateStudentModal = () => {
            const modal = document.getElementById('createStudentModal');
            if (modal) {
                modal.classList.add('hidden');
                const form = document.getElementById('createStudentForm');
                if (form) {
                    form.reset();
                }
                this.hideMessage('createStudentError');
                this.hideMessage('createStudentSuccess');
            }
        };

        // Handle create student form submission
        const createStudentForm = document.getElementById('createStudentForm');
        if (createStudentForm) {
            createStudentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleCreateStudent(e);
            });
        }
    }

    async handleCreateStudent(e) {
        const formData = new FormData(e.target);
        const data = {
            student_id: document.getElementById('studentId').value,
            name: document.getElementById('studentName').value,
            email: document.getElementById('studentEmail').value,
            room_number: document.getElementById('roomNumber').value,
            block: document.getElementById('block').value,
            phone: document.getElementById('phone').value
        };
        
        // Show loading state
        const btn = document.getElementById('createStudentBtn');
        const btnText = document.getElementById('createStudentBtnText');
        const btnLoading = document.getElementById('createStudentBtnLoading');
        
        if (btn && btnText && btnLoading) {
            btn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
        }
        
        this.hideMessage('createStudentError');
        this.hideMessage('createStudentSuccess');
        
        try {
            const response = await fetch('/staff/create-student/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showMessage('createStudentSuccess', result.message);
                // Show default password info
                setTimeout(() => {
                    alert(`Student created successfully!\n\nDefault Password: ${result.student.default_password}\n\nPlease share this with the student securely.`);
                    window.closeCreateStudentModal();
                    this.loadDashboardData(); // Refresh dashboard
                }, 1000);
            } else {
                this.showMessage('createStudentError', result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            this.showMessage('createStudentError', 'An error occurred while creating the student account.');
        } finally {
            if (btn && btnText && btnLoading) {
                btn.disabled = false;
                btnText.classList.remove('hidden');
                btnLoading.classList.add('hidden');
            }
        }
    }

    showMessage(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            const textElement = element.querySelector('span');
            if (textElement) {
                textElement.textContent = message;
            }
            element.classList.remove('hidden');
        }
    }

    hideMessage(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.add('hidden');
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StaffDashboard();
});