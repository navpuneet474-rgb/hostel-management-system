# Requirements Document

## Introduction

This specification addresses critical bugs in the AI Hostel Coordination System's digital pass and leave request functionality, along with adding a comprehensive pass history tracking feature. The system currently suffers from hardcoded data issues, validation errors, and missing visibility features that prevent proper operation of core workflows.

## Glossary

- **Digital_Pass**: An electronic pass document generated for students to leave the hostel premises
- **Leave_Request**: A formal request submitted by a student to take leave from the hostel
- **Authenticated_User**: A logged-in user with verified credentials and session data
- **Staff_Dashboard**: The administrative interface used by hostel staff and wardens
- **Pass_History**: A comprehensive audit trail of all generated passes and their approval status
- **UUID**: Universally Unique Identifier used as primary key in database models
- **Session_Data**: User-specific information stored during an authenticated session

## Requirements

### Requirement 1: User-Specific Digital Pass Display

**User Story:** As a student, I want to see only my own digital passes in the Digital Pass section, so that I can view my personal pass history without seeing other students' data.

#### Acceptance Criteria

1. WHEN a student accesses the Digital Pass section, THE System SHALL retrieve and display only passes associated with that student's authenticated user ID
2. WHEN displaying pass information, THE System SHALL populate name, room number, and student ID from the authenticated user's database record
3. THE System SHALL NOT display hardcoded values for any user-specific fields in the Digital Pass section
4. WHEN no passes exist for a student, THE System SHALL display an appropriate empty state message

### Requirement 2: Authenticated User Name in Pass Generation

**User Story:** As a student, I want my actual name to appear on generated passes, so that the pass accurately identifies me as the requester.

#### Acceptance Criteria

1. WHEN a student generates a hostel pass, THE System SHALL retrieve the student's name from the authenticated user's database record
2. WHEN a student generates a digital pass, THE System SHALL populate the pass document with the authenticated user's full name
3. THE System SHALL NOT use hardcoded names in any pass generation workflow
4. WHEN generating a pass PDF, THE System SHALL include the authenticated user's name in all relevant fields

### Requirement 3: Leave Request Visibility for Staff

**User Story:** As a staff member, I want to see all pending leave requests on my dashboard, so that I can review and process them in a timely manner.

#### Acceptance Criteria

1. WHEN a staff member accesses the dashboard, THE System SHALL retrieve all leave requests with status "pending"
2. WHEN a leave request is submitted, THE System SHALL make it visible to staff users within 1 minute
3. THE System SHALL display leave requests regardless of submission date
4. WHEN filtering leave requests, THE System SHALL correctly apply status filters without excluding valid pending requests
5. WHEN no pending requests exist, THE System SHALL display an appropriate empty state message

### Requirement 4: Optional Reason Field for Approvals

**User Story:** As a staff member, I want the reason field to be optional when approving requests, so that I can quickly approve valid requests without unnecessary data entry.

#### Acceptance Criteria

1. WHEN a staff member approves a leave request, THE System SHALL allow submission without a reason field
2. WHEN a staff member rejects a leave request, THE System SHALL require a reason field before submission
3. THE System SHALL validate that rejection requests contain a non-empty reason
4. WHEN approving with an optional reason, THE System SHALL store the reason if provided

### Requirement 5: Consistent UUID Handling in Request Processing

**User Story:** As a staff member, I want to approve or reject requests without encountering validation errors, so that I can efficiently process student requests.

#### Acceptance Criteria

1. WHEN the frontend sends an approval or rejection request, THE System SHALL use the correct UUID format for the request identifier
2. WHEN the backend receives a request ID, THE System SHALL validate it as a proper UUID
3. THE System SHALL use consistent ID types (UUID) across all database models for leave requests and digital passes
4. WHEN a validation error occurs, THE System SHALL return a descriptive error message indicating the expected format
5. THE System SHALL NOT accept numeric IDs when UUID format is required

### Requirement 6: Pass History Tracking System

**User Story:** As a staff member, I want to view a comprehensive history of all digital passes and leave passes, so that I can audit student leave patterns and maintain accountability.

#### Acceptance Criteria

1. WHEN a staff member accesses the Pass History section, THE System SHALL display all historical passes with student name, student ID, room number, pass type, from date, to date, status, and approver name
2. WHEN displaying pass history, THE System SHALL include both approved and rejected passes
3. THE System SHALL allow filtering pass history by date range, student name, pass type, and status
4. WHEN a pass is approved or rejected, THE System SHALL record the staff member who performed the action
5. THE System SHALL display pass history in reverse chronological order (newest first)
6. WHEN exporting pass history, THE System SHALL provide data in CSV or PDF format
7. THE System SHALL restrict pass history access to staff and admin roles only

### Requirement 7: Database Model Consistency

**User Story:** As a system administrator, I want all database models to use consistent identifier types, so that the system operates reliably without type mismatch errors.

#### Acceptance Criteria

1. THE System SHALL use UUID as the primary key type for LeaveRequest model
2. THE System SHALL use UUID as the primary key type for DigitalPass model
3. WHEN creating foreign key relationships, THE System SHALL use UUID references consistently
4. THE System SHALL migrate existing numeric IDs to UUID format if necessary
5. WHEN serializing model data for API responses, THE System SHALL convert UUIDs to string format

### Requirement 8: Frontend-Backend ID Consistency

**User Story:** As a developer, I want the frontend and backend to use matching ID formats, so that API requests succeed without validation errors.

#### Acceptance Criteria

1. WHEN the frontend retrieves a request ID from the DOM or API response, THE System SHALL preserve the UUID format
2. WHEN sending approval or rejection requests, THE Frontend SHALL include the request ID as a UUID string
3. THE System SHALL validate that API endpoints expect and document UUID parameters
4. WHEN displaying request IDs in the UI, THE System SHALL use the full UUID value in data attributes
5. THE System SHALL NOT truncate or modify UUID values during frontend processing
