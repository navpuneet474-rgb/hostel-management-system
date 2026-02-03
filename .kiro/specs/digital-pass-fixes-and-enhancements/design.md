# Design Document

## Overview

This design addresses critical bugs and enhancements in the AI Hostel Coordination System's digital pass and leave request functionality. The system currently has five critical bugs affecting core workflows and requires one new feature for audit tracking.

### Current Issues

1. **Student-Side Bugs**: Digital pass data is not user-specific, and pass generation uses hardcoded names
2. **Staff-Side Bugs**: Leave requests not visible on dashboard, mandatory reason field for approvals
3. **UUID Validation Error**: Frontend-backend ID type mismatch causing approval/rejection failures
4. **Missing Feature**: No pass history tracking for audit purposes

### Solution Approach

The fixes will focus on:

- Ensuring all user-specific data is retrieved from authenticated sessions
- Correcting database query filters for leave request visibility
- Making validation logic conditional based on action type
- Ensuring consistent UUID handling across frontend and backend
- Adding a comprehensive pass history view for staff

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Student Dashboard│         │ Staff Dashboard  │         │
│  │  - Digital Passes│         │  - Leave Requests│         │
│  │  - Pass Display  │         │  - Approval UI   │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend Layer                            │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Views Layer      │         │ Services Layer   │         │
│  │  - get_digital_  │         │  - leave_request_│         │
│  │    passes()      │         │    service       │         │
│  │  - approve_leave_│         │  - pdf_generation│         │
│  │    request()     │         │    _service      │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Data Layer                               │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │ Student Model    │         │ AbsenceRecord    │         │
│  │ DigitalPass Model│         │ Staff Model      │         │
│  └──────────────────┘         └──────────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
User Login → Session Created → User Object Stored → Views Access User Data
```

All views must access `request.user.user_object` to retrieve the authenticated user's database record.

## Components and Interfaces

### 1. Digital Pass Display Component (Student Dashboard)

**Current Implementation**:

```python
# views.py - get_digital_passes()
# BUG: Returns all passes instead of user-specific passes
digital_passes = DigitalPass.objects.filter(status='active')
```

**Fixed Implementation**:

```python
# views.py - get_digital_passes()
def get_digital_passes(request):
    # Get authenticated student
    student = request.user.user_object

    # Filter passes for this student only
    digital_passes = DigitalPass.objects.filter(
        student=student
    ).order_by('-created_at')

    return Response({
        'success': True,
        'passes': [{
            'pass_number': pass.pass_number,
            'student_name': student.name,  # From authenticated user
            'student_id': student.student_id,  # From authenticated user
            'room_number': student.room_number,  # From authenticated user
            'from_date': pass.from_date,
            'to_date': pass.to_date,
            'status': pass.status,
            'verification_code': pass.verification_code
        } for pass in digital_passes]
    })
```

**Interface**:

```python
GET /api/digital-passes/
Headers:
  - Authorization: Session token
Response:
  {
    "success": true,
    "passes": [
      {
        "pass_number": "LP-20240115-1234",
        "student_name": "<from authenticated user>",
        "student_id": "<from authenticated user>",
        "room_number": "<from authenticated user>",
        "from_date": "2024-01-15",
        "to_date": "2024-01-17",
        "status": "active",
        "verification_code": "ABC123"
      }
    ]
  }
```

### 2. Pass Generation Component

**Current Implementation**:

```python
# services/pdf_generation_service.py
# BUG: Uses hardcoded name
context = {
    'student_name': 'John Doe',  # HARDCODED
    'pass_number': digital_pass.pass_number,
    ...
}
```

**Fixed Implementation**:

```python
# services/pdf_generation_service.py
def generate_digital_pass_pdf(digital_pass: DigitalPass) -> str:
    # Get student from digital pass relationship
    student = digital_pass.student

    context = {
        'student_name': student.name,  # From database
        'student_id': student.student_id,  # From database
        'room_number': student.room_number,  # From database
        'pass_number': digital_pass.pass_number,
        'from_date': digital_pass.from_date,
        'to_date': digital_pass.to_date,
        'total_days': digital_pass.total_days,
        'verification_code': digital_pass.verification_code,
        'approved_by': digital_pass.approved_by.name if digital_pass.approved_by else 'Auto-Approved'
    }

    # Generate PDF with correct data
    return render_pdf('passes/digital_pass_template.html', context)
```

### 3. Staff Dashboard Leave Request Display

**Current Implementation**:

```python
# services/dashboard_service.py
# BUG: Incorrect status filter or missing records
pending_absence_requests = AbsenceRecord.objects.filter(
    status='pending'
).values(...)
```

**Root Cause Analysis**:
The issue is likely in the database query or caching. Need to verify:

1. Status field values are correct ('pending' vs 'Pending')
2. No caching issues preventing fresh data retrieval
3. Query includes all necessary joins

**Fixed Implementation**:

```python
# services/dashboard_service.py
def get_pending_absence_requests(self, force_refresh=False):
    # Clear cache if force refresh
    if force_refresh:
        cache.delete('pending_absence_requests')

    # Query with explicit status check (case-insensitive)
    pending_requests = AbsenceRecord.objects.filter(
        status__iexact='pending'  # Case-insensitive match
    ).select_related(
        'student',  # Eager load student data
        'approved_by'  # Eager load approver data
    ).order_by('-created_at')

    return pending_requests
```

### 4. Approval Reason Validation

**Current Implementation**:

```python
# Frontend validation (staff-dashboard.js)
// BUG: Reason required for both approve and reject
if (!reason) {
    alert('Please provide a reason');
    return;
}
```

**Fixed Implementation**:

```python
# Backend validation (views.py - approve_leave_request)
def approve_leave_request(request):
    absence_id = request.data.get('absence_id')
    approval_reason = request.data.get('reason', 'Approved by warden')  # Optional with default

    # No validation error if reason is empty for approval
    # Reason is optional for approvals

    result = leave_request_service.approve_leave_request(
        absence_record=absence_record,
        approved_by=staff_member,
        approval_reason=approval_reason or 'Approved by warden'
    )
    ...

# Backend validation (views.py - reject_leave_request)
def reject_leave_request(request):
    absence_id = request.data.get('absence_id')
    rejection_reason = request.data.get('reason')

    # Validate reason is required for rejection
    if not rejection_reason or not rejection_reason.strip():
        return Response({
            'success': False,
            'error': 'Rejection reason is required'
        }, status=status.HTTP_400_BAD_REQUEST)

    result = leave_request_service.reject_leave_request(
        absence_record=absence_record,
        rejected_by=staff_member,
        rejection_reason=rejection_reason
    )
    ...
```

**Frontend Changes**:

```javascript
// staff-dashboard.js
async handleLeaveRequestAction(absenceId, studentName, totalDays, action) {
    // ...
    if (action === 'approve') {
        message.innerHTML = `
            ...
            <p class="text-gray-600">Please provide an approval reason (optional):</p>
        `;
    } else {
        message.innerHTML = `
            ...
            <p class="text-gray-600">Please provide a rejection reason (required):</p>
        `;
    }
}

async confirmLeaveAction() {
    const { absenceId, action } = this.currentLeaveAction;
    const reason = document.getElementById('action-reason').value;

    // Only validate reason for rejection
    if (action === 'reject' && (!reason || !reason.trim())) {
        alert('Rejection reason is required');
        return;
    }

    // For approval, reason is optional
    // Continue with API call...
}
```

### 5. UUID Consistency Fix

**Problem Analysis**:

```javascript
// Frontend (staff-dashboard.js) - CURRENT BUG
// Sends numeric ID instead of UUID
data-id="${request.id}"  // This is likely a numeric ID from database

// Backend expects UUID
absence_record = AbsenceRecord.objects.get(absence_id=absence_id)
// absence_id field is UUIDField, but receives "8" (numeric string)
// Error: "8" is not a valid UUID
```

**Root Cause**:
The frontend template is using `request.id` (auto-increment primary key) instead of `request.absence_id` (UUID field).

**Fixed Implementation**:

**Backend (models.py)** - Already correct:

```python
class AbsenceRecord(models.Model):
    absence_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    # ... other fields
```

**Backend (views.py)** - Already correct:

```python
def approve_leave_request(request):
    absence_id = request.data.get('absence_id')  # Expects UUID string
    absence_record = AbsenceRecord.objects.get(absence_id=absence_id)
    ...
```

**Frontend (staff-dashboard.js)** - NEEDS FIX:

```javascript
// BEFORE (BUG):
renderRequestCard(request, type) {
    if (type === 'absence') {
        return `
            <button ... data-id="${request.id}" data-absence-id="${request.absence_id}">
                                                    ^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^
                                                    WRONG         CORRECT
        `;
    }
}

// AFTER (FIXED):
renderRequestCard(request, type) {
    if (type === 'absence') {
        return `
            <button ... data-absence-id="${request.absence_id}">
                        ^^^^^^^^^^^^^^^^^^^^
                        Use UUID field consistently
        `;
    }
}
```

**Backend (services/dashboard_service.py)** - NEEDS FIX:

```python
# Ensure serialization includes absence_id (UUID) not id (int)
def get_pending_absence_requests(self):
    pending_requests = AbsenceRecord.objects.filter(
        status__iexact='pending'
    ).values(
        'absence_id',  # Include UUID field
        'id',  # Keep for backward compatibility if needed
        'student__name',
        'student__room_number',
        'student__block',
        'start_date',
        'end_date',
        'reason',
        'emergency_contact',
        'created_at'
    )

    # Convert UUID to string for JSON serialization
    return [{
        **req,
        'absence_id': str(req['absence_id'])  # Convert UUID to string
    } for req in pending_requests]
```

### 6. Pass History Component (New Feature)

**Database Schema** - No changes needed:

```python
# Existing models already have all required fields
class DigitalPass(models.Model):
    pass_id = models.UUIDField(...)
    pass_number = models.CharField(...)
    student = models.ForeignKey(Student, ...)
    from_date = models.DateField(...)
    to_date = models.DateField(...)
    total_days = models.IntegerField(...)
    approved_by = models.ForeignKey(Staff, ...)
    status = models.CharField(...)  # active, expired, cancelled
    created_at = models.DateTimeField(...)

class AbsenceRecord(models.Model):
    absence_id = models.UUIDField(...)
    student = models.ForeignKey(Student, ...)
    start_date = models.DateTimeField(...)
    end_date = models.DateTimeField(...)
    status = models.CharField(...)  # pending, approved, rejected
    approved_by = models.ForeignKey(Staff, ...)
    created_at = models.DateTimeField(...)
```

**New View Implementation**:

```python
# views.py
@api_view(['GET'])
@permission_classes([IsStaffOnly])
def get_pass_history(request):
    """Get comprehensive pass history for staff/admin."""

    # Get filter parameters
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    student_name = request.query_params.get('student_name')
    pass_type = request.query_params.get('pass_type')  # 'digital' or 'leave'
    status = request.query_params.get('status')

    # Query digital passes
    digital_passes = DigitalPass.objects.select_related(
        'student', 'approved_by'
    ).all()

    # Query absence records (includes rejected ones)
    absence_records = AbsenceRecord.objects.select_related(
        'student', 'approved_by'
    ).all()

    # Apply filters
    if start_date:
        digital_passes = digital_passes.filter(from_date__gte=start_date)
        absence_records = absence_records.filter(start_date__gte=start_date)

    if end_date:
        digital_passes = digital_passes.filter(to_date__lte=end_date)
        absence_records = absence_records.filter(end_date__lte=end_date)

    if student_name:
        digital_passes = digital_passes.filter(student__name__icontains=student_name)
        absence_records = absence_records.filter(student__name__icontains=student_name)

    if status:
        digital_passes = digital_passes.filter(status=status)
        absence_records = absence_records.filter(status=status)

    # Combine and format results
    history = []

    # Add digital passes
    if not pass_type or pass_type == 'digital':
        for pass_obj in digital_passes:
            history.append({
                'type': 'digital_pass',
                'student_name': pass_obj.student.name,
                'student_id': pass_obj.student.student_id,
                'room_number': pass_obj.student.room_number,
                'pass_number': pass_obj.pass_number,
                'from_date': pass_obj.from_date.isoformat(),
                'to_date': pass_obj.to_date.isoformat(),
                'total_days': pass_obj.total_days,
                'status': pass_obj.status,
                'approved_by': pass_obj.approved_by.name if pass_obj.approved_by else 'Auto-Approved',
                'created_at': pass_obj.created_at.isoformat()
            })

    # Add absence records (including rejected)
    if not pass_type or pass_type == 'leave':
        for absence in absence_records:
            history.append({
                'type': 'leave_request',
                'student_name': absence.student.name,
                'student_id': absence.student.student_id,
                'room_number': absence.student.room_number,
                'pass_number': f"LR-{absence.absence_id}",
                'from_date': absence.start_date.date().isoformat(),
                'to_date': absence.end_date.date().isoformat(),
                'total_days': (absence.end_date.date() - absence.start_date.date()).days + 1,
                'status': absence.status,
                'approved_by': absence.approved_by.name if absence.approved_by else 'Pending',
                'created_at': absence.created_at.isoformat()
            })

    # Sort by created_at (newest first)
    history.sort(key=lambda x: x['created_at'], reverse=True)

    return Response({
        'success': True,
        'total_records': len(history),
        'history': history
    })
```

**Export Functionality**:

```python
# views.py
@api_view(['GET'])
@permission_classes([IsStaffOnly])
def export_pass_history(request):
    """Export pass history as CSV."""
    import csv
    from django.http import HttpResponse

    # Get history data (reuse get_pass_history logic)
    history_data = get_pass_history_data(request)

    # Create CSV response
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="pass_history.csv"'

    writer = csv.writer(response)
    writer.writerow([
        'Type', 'Student Name', 'Student ID', 'Room Number',
        'Pass Number', 'From Date', 'To Date', 'Total Days',
        'Status', 'Approved By', 'Created At'
    ])

    for record in history_data:
        writer.writerow([
            record['type'],
            record['student_name'],
            record['student_id'],
            record['room_number'],
            record['pass_number'],
            record['from_date'],
            record['to_date'],
            record['total_days'],
            record['status'],
            record['approved_by'],
            record['created_at']
        ])

    return response
```

**Frontend Template** (templates/staff/pass_history.html):

```html
<div class="bg-white rounded-xl shadow-sm p-6">
  <div class="flex items-center justify-between mb-6">
    <h3 class="text-xl font-semibold text-gray-800">Pass History</h3>
    <div class="flex space-x-3">
      <button
        onclick="exportHistory()"
        class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
      >
        <i class="fas fa-download mr-2"></i>Export CSV
      </button>
      <button
        onclick="refreshHistory()"
        class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        <i class="fas fa-sync-alt mr-2"></i>Refresh
      </button>
    </div>
  </div>

  <!-- Filters -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <input
      type="date"
      id="startDate"
      placeholder="Start Date"
      class="px-3 py-2 border rounded-lg"
    />
    <input
      type="date"
      id="endDate"
      placeholder="End Date"
      class="px-3 py-2 border rounded-lg"
    />
    <input
      type="text"
      id="studentName"
      placeholder="Student Name"
      class="px-3 py-2 border rounded-lg"
    />
    <select id="statusFilter" class="px-3 py-2 border rounded-lg">
      <option value="">All Statuses</option>
      <option value="approved">Approved</option>
      <option value="rejected">Rejected</option>
      <option value="active">Active</option>
      <option value="expired">Expired</option>
    </select>
  </div>

  <!-- History Table -->
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Student
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Room
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Pass Type
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Dates
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Days
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Status
          </th>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            Approved By
          </th>
        </tr>
      </thead>
      <tbody id="historyTableBody" class="bg-white divide-y divide-gray-200">
        <!-- Populated by JavaScript -->
      </tbody>
    </table>
  </div>
</div>
```

## Data Models

### Existing Models (No Changes Required)

All necessary fields already exist in the current models:

```python
class Student(models.Model):
    student_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    room_number = models.CharField(max_length=10)
    block = models.CharField(max_length=5)
    # ... other fields

class AbsenceRecord(models.Model):
    absence_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)
    approval_reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    # ... other fields

class DigitalPass(models.Model):
    pass_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    pass_number = models.CharField(max_length=20, unique=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    absence_record = models.OneToOneField(AbsenceRecord, on_delete=models.CASCADE)
    from_date = models.DateField()
    to_date = models.DateField()
    total_days = models.IntegerField()
    approved_by = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, default='active')
    verification_code = models.CharField(max_length=10)
    created_at = models.DateTimeField(auto_now_add=True)
    # ... other fields

class Staff(models.Model):
    staff_id = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    # ... other fields
```

### Data Flow for User-Specific Data

```
1. User Login
   ↓
2. Session Created (request.user.user_object = Student/Staff instance)
   ↓
3. View Accesses Authenticated User
   student = request.user.user_object
   ↓
4. Query Filtered by User
   DigitalPass.objects.filter(student=student)
   ↓
5. Response Contains User-Specific Data
   {student_name: student.name, room_number: student.room_number}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees._

### Property Reflection

After analyzing all acceptance criteria, I've identified the following consolidations:

**Redundancy Group 1 - User-Specific Data Display**:

- Properties 1.1, 1.2, and 1.3 all test that pass data is user-specific and not hardcoded
- These can be combined into one comprehensive property: "For any authenticated student, all displayed pass data must match that student's database record"

**Redundancy Group 2 - Pass Generation with Correct Data**:

- Properties 2.1, 2.2, 2.3, and 2.4 all test that pass generation uses authenticated user data
- These can be combined into one property: "For any pass generation, all student fields must come from the authenticated user's database record"

**Redundancy Group 3 - Leave Request Visibility**:

- Properties 3.1, 3.3, and 3.4 all test correct filtering of pending leave requests
- These can be combined into one property: "For any staff dashboard access, all and only pending leave requests must be visible"

**Redundancy Group 4 - Reason Field Validation**:

- Properties 4.1, 4.2, 4.3, and 4.4 all test conditional validation of the reason field
- These can be combined into one property: "For any approval/rejection action, reason validation must match the action type"

**Redundancy Group 5 - UUID Format Consistency**:

- Properties 5.1, 5.2, 5.4, 5.5, 8.1, 8.2, 8.3, 8.4, and 8.5 all test UUID handling
- These can be combined into two properties:
  1. "For any request ID, the system must use UUID format consistently across frontend and backend"
  2. "For any invalid UUID input, the system must reject with a descriptive error"

**Redundancy Group 6 - Pass History Display**:

- Properties 6.1 and 6.2 both test that history includes all required data
- These can be combined into one property: "For any pass history query, all passes (approved and rejected) with all required fields must be returned"

After consolidation, we have 12 unique properties instead of 35+ redundant ones.

### Correctness Properties

Property 1: User-Specific Pass Filtering
_For any_ authenticated student, when retrieving digital passes, the system should return only passes where the student field matches the authenticated user's ID, and all returned passes should have student_name, student_id, and room_number matching the authenticated user's database record.
**Validates: Requirements 1.1, 1.2, 1.3**

Property 2: Pass Generation Uses Authenticated User Data
_For any_ pass generation request, the generated pass (including PDF) should contain the student_name, student_id, and room_number from the authenticated user's database record, not hardcoded values.
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 3: Pending Leave Requests Visibility
_For any_ staff dashboard access, the system should return all and only leave requests with status "pending", regardless of creation date, and the filter should not exclude any valid pending requests.
**Validates: Requirements 3.1, 3.3, 3.4**

Property 4: Conditional Reason Validation
_For any_ leave request approval, the system should accept requests without a reason field (or with empty reason), but for any rejection, the system should require a non-empty reason field and reject requests with empty or whitespace-only reasons.
**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

Property 5: UUID Format Consistency
_For any_ leave request approval or rejection, the request ID sent from frontend to backend should be a valid UUID string, and the backend should successfully process it without UUID validation errors.
**Validates: Requirements 5.1, 5.2, 8.1, 8.2, 8.3, 8.4, 8.5**

Property 6: UUID Validation Error Messages
_For any_ API request with an invalid UUID (numeric ID, malformed string, etc.), the system should reject the request and return an error message indicating that a valid UUID format is required.
**Validates: Requirements 5.4, 5.5**

Property 7: UUID Serialization
_For any_ API response containing model data with UUID fields, the UUIDs should be serialized as strings (not UUID objects), and the string format should be valid UUID format.
**Validates: Requirements 7.5**

Property 8: Pass History Completeness
_For any_ pass history query by staff, the system should return all historical passes (both approved and rejected) with all required fields: student_name, student_id, room_number, pass_type, from_date, to_date, status, and approver_name.
**Validates: Requirements 6.1, 6.2**

Property 9: Pass History Filtering
_For any_ pass history query with filters (date range, student name, pass type, status), the system should return only records matching all specified filter criteria, and all matching records should be included.
**Validates: Requirements 6.3**

Property 10: Audit Trail Recording
_For any_ pass approval or rejection action, the system should record the staff member who performed the action in the approved_by field, and this field should be populated with the authenticated staff user's ID.
**Validates: Requirements 6.4**

Property 11: Pass History Sort Order
_For any_ pass history query, the results should be sorted in reverse chronological order by created_at timestamp, with the newest records appearing first.
**Validates: Requirements 6.5**

Property 12: Pass History Export Format
_For any_ pass history export request, the system should generate output in the requested format (CSV or PDF) containing all the same fields as the history display.
**Validates: Requirements 6.6**

Property 13: Pass History Access Control
_For any_ pass history access attempt, the system should allow access only if the authenticated user has role "staff" or "admin", and should reject access attempts from student users.
**Validates: Requirements 6.7**

## Error Handling

### Error Scenarios and Responses

1. **Unauthenticated Access**
   - Scenario: User attempts to access digital passes without authentication
   - Response: HTTP 401 Unauthorized with message "Authentication required"
   - Handling: Redirect to login page

2. **Invalid UUID Format**
   - Scenario: Frontend sends numeric ID instead of UUID for approval/rejection
   - Response: HTTP 400 Bad Request with message "Invalid UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
   - Handling: Display error to user, log for debugging

3. **Leave Request Not Found**
   - Scenario: Staff attempts to approve/reject non-existent leave request
   - Response: HTTP 404 Not Found with message "Leave request not found"
   - Handling: Refresh dashboard, show error notification

4. **Missing Rejection Reason**
   - Scenario: Staff attempts to reject without providing reason
   - Response: HTTP 400 Bad Request with message "Rejection reason is required"
   - Handling: Show validation error on form, prevent submission

5. **Unauthorized Access to Pass History**
   - Scenario: Student user attempts to access pass history endpoint
   - Response: HTTP 403 Forbidden with message "Access restricted to staff and admin users"
   - Handling: Redirect to appropriate dashboard

6. **Database Query Failure**
   - Scenario: Database connection error during pass retrieval
   - Response: HTTP 500 Internal Server Error with message "Unable to retrieve passes. Please try again later."
   - Handling: Log error, show user-friendly message, retry mechanism

7. **PDF Generation Failure**
   - Scenario: Error during digital pass PDF generation
   - Response: HTTP 500 Internal Server Error with message "Failed to generate pass PDF"
   - Handling: Log error with stack trace, notify admin, allow retry

### Error Logging Strategy

```python
# All errors should be logged with context
logger.error(
    f"Error in {function_name}: {error_message}",
    extra={
        'user_id': user.id,
        'user_type': user.user_type,
        'request_id': request_id,
        'error_type': type(error).__name__,
        'stack_trace': traceback.format_exc()
    }
)
```

### Validation Error Responses

All validation errors should follow consistent format:

```json
{
  "success": false,
  "error": "Human-readable error message",
  "field": "field_name", // Optional: which field caused the error
  "code": "ERROR_CODE" // Optional: machine-readable error code
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions

- Test empty pass list display
- Test rejection without reason (should fail)
- Test approval without reason (should succeed)
- Test invalid UUID formats (specific examples like "8", "abc", "")
- Test unauthenticated access attempts

**Property-Based Tests**: Verify universal properties across all inputs

- Test user-specific filtering with randomly generated students and passes
- Test pass generation with random student data
- Test UUID consistency with randomly generated UUIDs
- Test pass history filtering with random filter combinations
- Test sort order with random timestamps

**Property Test Configuration**:

- Use `pytest` with `hypothesis` library for Python property-based testing
- Each property test should run minimum 100 iterations
- Each test must reference its design document property in a comment
- Tag format: `# Feature: digital-pass-fixes-and-enhancements, Property N: <property text>`

### Test Organization

```
tests/
├── test_digital_pass_display.py
│   ├── test_user_specific_filtering()  # Unit test
│   ├── test_empty_pass_list()  # Unit test (edge case)
│   └── property_test_user_specific_filtering()  # Property test for Property 1
│
├── test_pass_generation.py
│   ├── test_pass_uses_authenticated_user()  # Unit test
│   ├── test_pdf_contains_correct_name()  # Unit test
│   └── property_test_pass_generation_data()  # Property test for Property 2
│
├── test_leave_request_visibility.py
│   ├── test_pending_requests_visible()  # Unit test
│   ├── test_old_requests_visible()  # Unit test
│   ├── test_empty_pending_list()  # Unit test (edge case)
│   └── property_test_pending_filtering()  # Property test for Property 3
│
├── test_reason_validation.py
│   ├── test_approval_without_reason()  # Unit test
│   ├── test_rejection_requires_reason()  # Unit test
│   └── property_test_conditional_validation()  # Property test for Property 4
│
├── test_uuid_consistency.py
│   ├── test_valid_uuid_accepted()  # Unit test
│   ├── test_numeric_id_rejected()  # Unit test
│   ├── test_invalid_uuid_error_message()  # Unit test
│   ├── property_test_uuid_consistency()  # Property test for Property 5
│   └── property_test_uuid_validation_errors()  # Property test for Property 6
│
└── test_pass_history.py
    ├── test_history_includes_all_fields()  # Unit test
    ├── test_history_includes_rejected()  # Unit test
    ├── test_history_filtering()  # Unit test
    ├── test_history_sort_order()  # Unit test
    ├── test_history_access_control()  # Unit test
    ├── property_test_history_completeness()  # Property test for Property 8
    ├── property_test_history_filtering()  # Property test for Property 9
    └── property_test_history_sort_order()  # Property test for Property 11
```

### Example Property Test

```python
from hypothesis import given, strategies as st
import pytest

# Feature: digital-pass-fixes-and-enhancements, Property 1: User-Specific Pass Filtering
@given(
    student_count=st.integers(min_value=2, max_value=10),
    passes_per_student=st.integers(min_value=0, max_value=5)
)
def property_test_user_specific_filtering(student_count, passes_per_student):
    """
    Property: For any authenticated student, when retrieving digital passes,
    the system should return only passes where the student field matches
    the authenticated user's ID.
    """
    # Setup: Create random students and passes
    students = [create_random_student() for _ in range(student_count)]
    for student in students:
        for _ in range(passes_per_student):
            create_random_pass(student)

    # Test: For each student, verify they only see their own passes
    for student in students:
        client = authenticate_as(student)
        response = client.get('/api/digital-passes/')

        assert response.status_code == 200
        passes = response.json()['passes']

        # All returned passes should belong to this student
        for pass_data in passes:
            assert pass_data['student_id'] == student.student_id
            assert pass_data['student_name'] == student.name
            assert pass_data['room_number'] == student.room_number

        # Count should match database
        expected_count = DigitalPass.objects.filter(student=student).count()
        assert len(passes) == expected_count
```

### Integration Testing

Integration tests should verify end-to-end workflows:

1. Student submits leave request → Staff sees it on dashboard → Staff approves → Digital pass generated → Student sees pass
2. Staff filters pass history by date range → Correct records returned → Export to CSV → File contains correct data
3. Frontend sends approval with UUID → Backend processes → Database updated → Response contains updated data

### Manual Testing Checklist

Before deployment, manually verify:

- [ ] Login as different students, verify each sees only their own passes
- [ ] Generate pass as Student A, verify it shows Student A's name (not hardcoded)
- [ ] Submit leave request, verify it appears on staff dashboard immediately
- [ ] Approve request without reason, verify it succeeds
- [ ] Reject request without reason, verify it fails with error
- [ ] Approve/reject with valid UUID, verify no validation errors
- [ ] Access pass history as staff, verify all fields present
- [ ] Filter pass history by various criteria, verify correct results
- [ ] Export pass history to CSV, verify format and content
- [ ] Attempt to access pass history as student, verify access denied

## Implementation Notes

### Critical Changes Summary

1. **views.py - get_digital_passes()**
   - Add filter: `.filter(student=request.user.user_object)`
   - Use authenticated user data in response

2. **services/pdf_generation_service.py - generate_digital_pass_pdf()**
   - Replace hardcoded name with `digital_pass.student.name`
   - Use student relationship for all student fields

3. **services/dashboard_service.py - get_pending_absence_requests()**
   - Use case-insensitive status filter: `status__iexact='pending'`
   - Add cache invalidation on force refresh
   - Add eager loading with `select_related()`

4. **views.py - reject_leave_request()**
   - Add validation: require non-empty reason for rejections
   - Return 400 error if reason is missing or whitespace-only

5. **views.py - approve_leave_request()**
   - Make reason optional with default value
   - No validation error if reason is empty

6. **static/js/staff-dashboard.js - renderRequestCard()**
   - Use `request.absence_id` instead of `request.id`
   - Ensure UUID is passed to backend

7. **services/dashboard_service.py - get_pending_absence_requests()**
   - Include `absence_id` in values() call
   - Convert UUID to string in response

8. **views.py - get_pass_history()** (NEW)
   - Create new endpoint for pass history
   - Implement filtering by date, student, type, status
   - Combine digital passes and absence records
   - Sort by created_at descending

9. **views.py - export_pass_history()** (NEW)
   - Create CSV export endpoint
   - Include all required fields
   - Restrict to staff/admin only

10. **templates/staff/pass_history.html** (NEW)
    - Create pass history UI
    - Add filter controls
    - Add export button
    - Display results in table

### Database Migration Requirements

No database migrations required - all necessary fields already exist in current schema.

### Deployment Considerations

1. **Cache Invalidation**: Clear dashboard cache after deployment to ensure fresh data
2. **Session Verification**: Verify authentication middleware is properly configured
3. **Permission Checks**: Verify IsStaffOnly permission class is applied to pass history endpoints
4. **Frontend Assets**: Ensure updated JavaScript is deployed and cached properly
5. **Logging**: Monitor error logs for UUID validation errors during initial rollout
6. **Rollback Plan**: Keep previous version available for quick rollback if issues arise

### Performance Considerations

1. **Database Queries**: Use `select_related()` to avoid N+1 queries when loading student/staff data
2. **Pass History Pagination**: Consider adding pagination for large pass history datasets
3. **Cache Strategy**: Maintain existing cache strategy for dashboard data
4. **Index Usage**: Verify database indexes exist on frequently queried fields (status, created_at, student_id)

### Security Considerations

1. **Authentication**: All endpoints must verify user is authenticated
2. **Authorization**: Pass history endpoints must verify user has staff/admin role
3. **Data Isolation**: Students must only see their own data (enforced by filtering)
4. **Input Validation**: UUID validation prevents SQL injection and malformed data
5. **Audit Logging**: All approval/rejection actions are logged with staff member ID
