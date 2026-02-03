# User Authentication Fix - Design Document

## Overview

This design addresses the authentication mismatch between session-based login and API authentication, ensuring that users logged in via the web form are properly recognized by API endpoints, preventing fallback to hardcoded development data (DEV001).

## Architecture

### Current State

```
User Login (Form) → Session Auth → Dashboard Views ✓
                                 ↓
                                 API Views → Check request.user.user_object → None → DEV001 Fallback ✗
```

### Target State

```
User Login (Form) → Session Auth → Dashboard Views ✓
                                 ↓
                                 API Views → Unified Auth Helper → Check JWT OR Session → Real User ✓
```

## Components

### 1. Unified Authentication Helper

**Location:** `core/authentication.py`

**Function:** `get_authenticated_user(request) -> Tuple[Optional[Union[Student, Staff]], str]`

**Purpose:** Provide a single function that checks both JWT and session authentication

**Logic:**

1. Check if `request.user.user_object` exists (JWT auth)
   - If yes, return `(user_object, 'jwt')`
2. Check if `request.session.get('user_id')` exists (session auth)
   - If yes, retrieve Student/Staff from database
   - Return `(user_object, 'session')`
3. If neither exists, return `(None, 'none')`

**Returns:**

- Tuple of (user_object, auth_type)
- user_object: Student or Staff instance, or None
- auth_type: 'jwt', 'session', or 'none'

### 2. Session Authentication Middleware (Optional Enhancement)

**Location:** `core/middleware.py` (new file)

**Class:** `SessionUserMiddleware`

**Purpose:** Automatically populate `request.user` from session data for all requests

**Logic:**

1. Check if user is already authenticated via JWT
2. If not, check session for `user_id` and `user_type`
3. If session exists, create a lightweight user object
4. Attach to `request.user`

**Note:** This is optional - the helper function approach is simpler and sufficient.

### 3. View Updates

**Affected Files:**

- `core/views.py` - All API views that currently fall back to DEV001

**Changes Required:**

#### MessageViewSet.create()

```python
# OLD CODE (lines ~115-180)
if hasattr(request.user, 'user_object') and request.user.user_object:
    if isinstance(request.user.user_object, Student):
        sender = request.user.user_object
    else:
        # Falls back to STAFF_MSG_001 or DEV001

# NEW CODE
from .authentication import get_authenticated_user

user_object, auth_type = get_authenticated_user(request)
if user_object and isinstance(user_object, Student):
    sender = user_object
elif user_object and isinstance(user_object, Staff):
    # Handle staff messages appropriately
    sender = create_staff_message_record(user_object)
else:
    # Only use DEV001 if NO authentication exists
    if auth_type == 'none':
        logger.warning("No authentication found, using DEV001 fallback")
        sender = get_or_create_dev_student()
    else:
        return Response({'error': 'User record not found'}, status=401)
```

#### Other Views to Update

- `staff_query()` - Line ~650
- `request_leave()` - Line ~1038
- `get_student_passes()` - Line ~1112
- `download_pass_pdf()` - Line ~1430
- `view_pass_html()` - Line ~1962
- All other views with DEV001 fallback

### 4. Logging Enhancement

**Purpose:** Track when and why DEV001 fallback is used

**Implementation:**

```python
import logging
logger = logging.getLogger(__name__)

def log_auth_fallback(request, reason):
    """Log when DEV001 fallback is used"""
    logger.warning(
        f"DEV001 fallback used: {reason}",
        extra={
            'path': request.path,
            'method': request.method,
            'session_user_id': request.session.get('user_id'),
            'has_jwt_auth': hasattr(request.user, 'user_object'),
        }
    )
```

## Implementation Details

### Helper Function Implementation

```python
# core/authentication.py

def get_authenticated_user(request) -> Tuple[Optional[Union[Student, Staff]], str]:
    """
    Get authenticated user from either JWT or session authentication.

    Args:
        request: Django request object

    Returns:
        Tuple of (user_object, auth_type)
        - user_object: Student or Staff instance, or None
        - auth_type: 'jwt', 'session', or 'none'
    """
    # Check JWT authentication first
    if hasattr(request.user, 'user_object') and request.user.user_object:
        return (request.user.user_object, 'jwt')

    # Check session authentication
    user_id = request.session.get('user_id')
    user_type = request.session.get('user_type')

    if user_id and user_type:
        try:
            if user_type == 'student':
                user_object = Student.objects.get(student_id=user_id)
                return (user_object, 'session')
            elif user_type == 'staff':
                user_object = Staff.objects.get(staff_id=user_id, is_active=True)
                return (user_object, 'session')
        except (Student.DoesNotExist, Staff.DoesNotExist) as e:
            logger.warning(f"Session user not found: {user_type} {user_id} - {e}")
            return (None, 'session_invalid')

    # No authentication found
    return (None, 'none')
```

### View Pattern for Student-Required Endpoints

```python
from .authentication import get_authenticated_user

@api_view(['POST'])
@permission_classes([AllowAny])
def request_leave(request):
    """Request leave endpoint"""

    # Get authenticated user
    user_object, auth_type = get_authenticated_user(request)

    # Validate user is a student
    if not user_object:
        if auth_type == 'none':
            logger.warning(f"Unauthenticated leave request from {request.META.get('REMOTE_ADDR')}")
            return Response({
                'success': False,
                'error': 'Authentication required'
            }, status=status.HTTP_401_UNAUTHORIZED)
        else:
            # Session exists but user not found
            return Response({
                'success': False,
                'error': 'User account not found. Please contact administrator.'
            }, status=status.HTTP_404_NOT_FOUND)

    if not isinstance(user_object, Student):
        return Response({
            'success': False,
            'error': 'Only students can request leave'
        }, status=status.HTTP_403_FORBIDDEN)

    # Proceed with leave request using user_object
    student = user_object
    # ... rest of the logic
```

### View Pattern for Staff-Required Endpoints

```python
@api_view(['POST'])
@permission_classes([AllowAny])
def staff_query(request):
    """Staff query endpoint"""

    # Get authenticated user
    user_object, auth_type = get_authenticated_user(request)

    # Validate user is staff
    if not user_object:
        return Response({
            'success': False,
            'error': 'Staff authentication required'
        }, status=status.HTTP_401_UNAUTHORIZED)

    if not isinstance(user_object, Staff):
        return Response({
            'success': False,
            'error': 'Staff access only'
        }, status=status.HTTP_403_FORBIDDEN)

    # Proceed with staff query using user_object
    staff_member = user_object
    # ... rest of the logic
```

## Data Flow

### Leave Request Flow (Fixed)

```
1. User "vikash" logs in via form
   → Session created: {user_id: 'VIKASH001', user_type: 'student'}

2. User requests leave via chat
   → API call to /api/leave/request/

3. View calls get_authenticated_user(request)
   → Checks request.user.user_object: None
   → Checks request.session: {user_id: 'VIKASH001', user_type: 'student'}
   → Queries: Student.objects.get(student_id='VIKASH001')
   → Returns: (Student<VIKASH001>, 'session')

4. Leave request processed with correct student
   → Digital pass created for VIKASH001
   → Pass shows: Name="Vikash Kumar", ID="VIKASH001", Room="205, Block B"
```

## Error Handling

### Scenario 1: No Authentication

- **Condition:** No JWT token, no session
- **Response:** 401 Unauthorized
- **Message:** "Authentication required"
- **Log:** Warning level

### Scenario 2: Session Exists, User Not Found

- **Condition:** Session has user_id, but Student/Staff record doesn't exist
- **Response:** 404 Not Found
- **Message:** "User account not found. Please contact administrator."
- **Log:** Warning level with session details

### Scenario 3: Wrong User Type

- **Condition:** Staff trying to access student endpoint or vice versa
- **Response:** 403 Forbidden
- **Message:** "Access denied for this user type"
- **Log:** Info level

### Scenario 4: Development Mode (Optional)

- **Condition:** DEBUG=True and no authentication
- **Response:** Use DEV001 with warning
- **Message:** Include warning in response
- **Log:** Warning level with clear indication

## Testing Strategy

### Unit Tests

**File:** `core/tests/test_authentication_helper.py`

```python
class TestGetAuthenticatedUser(TestCase):
    """Test the unified authentication helper"""

    def test_jwt_authentication(self):
        """Test JWT auth takes precedence"""
        # Create request with JWT user
        # Verify returns (user_object, 'jwt')

    def test_session_authentication_student(self):
        """Test session auth for students"""
        # Create request with session but no JWT
        # Verify returns (student, 'session')

    def test_session_authentication_staff(self):
        """Test session auth for staff"""
        # Create request with session but no JWT
        # Verify returns (staff, 'session')

    def test_no_authentication(self):
        """Test no auth returns None"""
        # Create request with no auth
        # Verify returns (None, 'none')

    def test_invalid_session(self):
        """Test session with non-existent user"""
        # Create session with invalid user_id
        # Verify returns (None, 'session_invalid')
```

### Integration Tests

**File:** `core/tests/test_leave_request_auth.py`

```python
class TestLeaveRequestAuthentication(TestCase):
    """Test leave requests with different auth methods"""

    def test_leave_request_with_session_auth(self):
        """Test leave request using session authentication"""
        # Login via form
        # Request leave via API
        # Verify correct student used (not DEV001)
        # Verify digital pass has correct info

    def test_leave_request_with_jwt_auth(self):
        """Test leave request using JWT authentication"""
        # Get JWT token
        # Request leave with token
        # Verify correct student used

    def test_leave_request_no_auth(self):
        """Test leave request without authentication"""
        # Request leave without auth
        # Verify 401 response
        # Verify no DEV001 fallback

    def test_digital_pass_shows_correct_student(self):
        """Test digital pass displays correct student info"""
        # Login as specific student
        # Request leave
        # Verify pass shows correct name, ID, room
        # Verify no hardcoded values
```

### End-to-End Tests

**File:** `core/tests/test_e2e_authentication.py`

```python
class TestEndToEndAuthentication(TestCase):
    """Test complete user flows"""

    def test_login_and_request_leave(self):
        """Test full flow: login → request leave → get pass"""
        # 1. Login via form as "vikash"
        # 2. Request leave via chat
        # 3. Download digital pass PDF
        # 4. Verify PDF contains correct student info
        # 5. Verify no DEV001 data anywhere
```

## Migration Plan

### Phase 1: Add Helper Function

1. Add `get_authenticated_user()` to `core/authentication.py`
2. Add unit tests for the helper
3. Deploy and monitor

### Phase 2: Update Critical Views

1. Update `request_leave()` view
2. Update `MessageViewSet.create()`
3. Add integration tests
4. Deploy and monitor

### Phase 3: Update Remaining Views

1. Update all other views with DEV001 fallback
2. Add comprehensive tests
3. Deploy and monitor

### Phase 4: Remove DEV001 Fallback

1. Remove or restrict DEV001 fallback to DEBUG mode only
2. Add strict error responses
3. Update documentation

## Rollback Plan

If issues occur:

1. Revert view changes
2. Keep helper function (it's non-breaking)
3. Investigate and fix issues
4. Redeploy with fixes

## Monitoring

### Metrics to Track

- Number of DEV001 fallbacks (should be zero for authenticated users)
- Authentication errors (401/403/404)
- Session vs JWT auth usage
- Failed authentication attempts

### Logging

- Log all DEV001 fallbacks with context
- Log authentication method used for each request
- Log session/user mismatches

## Security Considerations

1. **Session Validation:** Always verify session user exists in database
2. **User Type Validation:** Verify user type matches endpoint requirements
3. **No Automatic User Creation:** Never auto-create users from session data
4. **Audit Trail:** Log all authentication decisions
5. **Error Messages:** Don't leak sensitive information in error messages

## Performance Considerations

1. **Database Queries:** Helper adds one query per request (acceptable)
2. **Caching:** Consider caching user objects in session (future optimization)
3. **Middleware:** Optional middleware would eliminate per-view queries

## Documentation Updates

### Developer Documentation

- Document the two authentication methods
- Explain when to use each
- Provide code examples

### API Documentation

- Update API docs to show authentication requirements
- Document error responses
- Provide authentication examples

## Success Criteria

1. ✅ Users logged in via form see their own data in API responses
2. ✅ Digital passes show correct student information
3. ✅ Zero DEV001 fallbacks for authenticated users
4. ✅ Clear error messages for authentication failures
5. ✅ All tests passing
6. ✅ No performance degradation

## Future Enhancements

1. **Unified Authentication:** Migrate to single auth system
2. **Token Refresh:** Add token refresh for JWT auth
3. **Session Middleware:** Implement middleware for automatic user population
4. **Authentication Decorator:** Create decorator for common auth patterns
5. **Rate Limiting:** Add rate limiting per user
