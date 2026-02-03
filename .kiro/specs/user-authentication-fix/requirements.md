# User Authentication Fix - Requirements

## Problem Statement

When users log in (e.g., as "vikash"), the system is not properly associating them with their Student or Staff records. Instead, it falls back to a hardcoded development student (DEV001 - "Development Student") with hardcoded details (room 101, Block A). This causes:

1. Digital passes showing wrong student information
2. Leave requests being created for the wrong student
3. Users seeing data for "Development Student" instead of their own data

## Root Cause

The system has **two authentication mechanisms** that are not properly integrated:

1. **Session-based authentication** (`core/auth_views.py`):
   - Used by the login form
   - Stores `user_id`, `user_type`, `user_email` in Django session
   - Works correctly for dashboard views

2. **Supabase JWT authentication** (`core/authentication.py`):
   - Sets `request.user.user_object` to the Student/Staff instance
   - Used by API views for leave requests, digital passes, etc.

**The Problem:**

- When you log in via the form (session auth), the session is created correctly
- But API views check for `request.user.user_object` which is only set by JWT auth
- Since session-based logins don't set `request.user.user_object`, it's `None`
- Views then fall back to creating/using the hardcoded DEV001 student
- This causes digital passes to show DEV001's information instead of the logged-in user's data

## User Stories

### 1. Proper User-to-Record Matching

**As a** logged-in user  
**I want** the system to correctly identify my Student or Staff record  
**So that** I see my own data and not hardcoded development data

**Acceptance Criteria:**
1.1. When a user logs in via session-based auth (login form), API views should retrieve the Student/Staff record from the session
1.2. The system should not fall back to DEV001 when a valid session exists with `user_id` and `user_type`
1.3. API views should check session data (`request.session.get('user_id')`) when `request.user.user_object` is None
1.4. Both authentication mechanisms (session and JWT) should work seamlessly for all API endpoints

### 2. Digital Pass Accuracy

**As a** student requesting leave  
**I want** my digital pass to show my actual name, student ID, and room number  
**So that** security can verify my identity correctly

**Acceptance Criteria:**
2.1. Digital passes must display the actual logged-in student's name
2.2. Digital passes must display the actual logged-in student's student ID
2.3. Digital passes must display the actual logged-in student's room number and block
2.4. No hardcoded values (DEV001, Development Student, Room 101) should appear on passes for authenticated users

### 3. Development Mode Fallback

**As a** developer  
**I want** the system to only use development fallback data when no user is authenticated  
**So that** testing is possible without breaking production user flows

**Acceptance Criteria:**
3.1. DEV001 fallback should only be used when both `request.user.user_object` is None AND `request.session.get('user_id')` is None
3.2. DEV001 fallback should only be used when no authentication (session or JWT) is provided
3.3. Authenticated users (via either session or JWT) should never see DEV001 data
3.4. Clear logging should indicate when DEV001 fallback is used and why

## Technical Requirements

### Session Authentication Integration

- Create a middleware or helper function to populate `request.user` from session data
- Ensure API views can retrieve Student/Staff objects from session when JWT auth is not used
- Add a unified `get_authenticated_user()` helper that checks both session and JWT auth

### View Layer Updates

- Update all API views to use the unified authentication helper
- Remove DEV001 fallback logic when session authentication is present
- Add proper error responses (401 Unauthorized) when no authentication is found
- Log warnings when DEV001 fallback is used

### Authentication Enhancement

- Keep both authentication mechanisms (session and JWT) functional
- Ensure they work independently and don't conflict
- Add clear documentation on when each auth method is used

### Data Integrity

- Ensure Student and Staff records exist for all users who can log in
- Add validation to prevent orphaned sessions (session exists but no Student/Staff record)

## Out of Scope

- Creating new authentication providers
- Changing the Supabase integration
- Modifying the login UI/UX
- Password reset functionality

## Success Metrics

- Zero instances of DEV001 data appearing for authenticated users
- 100% of digital passes showing correct student information
- Proper user-to-record matching for all login attempts
