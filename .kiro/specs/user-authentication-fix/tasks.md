# User Authentication Fix - Implementation Tasks

## Phase 1: Core Authentication Helper

### 1. Create Unified Authentication Helper

- [x] 1.1 Add `get_authenticated_user()` function to `core/authentication.py`
  - Check JWT authentication first (request.user.user_object)
  - Check session authentication second (request.session)
  - Return tuple of (user_object, auth_type)
  - Handle Student.DoesNotExist and Staff.DoesNotExist exceptions
  - Add logging for authentication decisions

- [x] 1.2 Add helper function unit tests
  - Test JWT authentication returns correct user
  - Test session authentication for students
  - Test session authentication for staff
  - Test no authentication returns (None, 'none')
  - Test invalid session returns (None, 'session_invalid')
  - Test JWT takes precedence over session

## Phase 2: Update Critical Views

### 2. Fix Leave Request View

- [ ] 2.1 Update `request_leave()` in `core/views.py`
  - Replace DEV001 fallback with `get_authenticated_user()`
  - Add proper error responses for unauthenticated requests
  - Add validation that user is a Student
  - Add logging for authentication method used
  - Test with session authentication
  - Test with JWT authentication
  - Test with no authentication (should return 401)

### 3. Fix Message Creation View

- [ ] 3.1 Update `MessageViewSet.create()` in `core/views.py`
  - Replace DEV001 fallback logic (lines ~115-180)
  - Use `get_authenticated_user()` helper
  - Handle staff messages appropriately
  - Add proper error responses
  - Test message creation with session auth
  - Test message creation with JWT auth

### 4. Fix Staff Query View

- [ ] 4.1 Update `staff_query()` in `core/views.py`
  - Replace DEV001 fallback (line ~650)
  - Use `get_authenticated_user()` helper
  - Validate user is Staff
  - Add proper error responses
  - Test with session authentication
  - Test with JWT authentication

## Phase 3: Update Remaining Views

### 5. Fix Student Pass Views

- [ ] 5.1 Update `get_student_passes()` in `core/views.py`
  - Replace DEV001 fallback (line ~1112)
  - Use `get_authenticated_user()` helper
  - Validate user is Student
  - Test pass retrieval with session auth

- [ ] 5.2 Update `download_pass_pdf()` in `core/views.py`
  - Replace DEV001 fallback (line ~1430)
  - Use `get_authenticated_user()` helper
  - Add proper authorization checks
  - Test PDF download with session auth

- [ ] 5.3 Update `view_pass_html()` in `core/views.py`
  - Replace DEV001 fallback (line ~1962)
  - Use `get_authenticated_user()` helper
  - Add proper authorization checks
  - Test HTML view with session auth

### 6. Fix Other API Views

- [ ] 6.1 Search for all remaining DEV001 fallbacks
  - Use grep to find all instances
  - Update each view to use `get_authenticated_user()`
  - Add proper error handling
  - Add tests for each updated view

## Phase 4: Testing

### 7. Integration Tests

- [ ] 7.1 Create `test_authentication_helper.py`
  - Test helper function with various scenarios
  - Test with mock requests
  - Test error handling

- [ ] 7.2 Create `test_leave_request_auth.py`
  - Test leave request with session auth
  - Test leave request with JWT auth
  - Test leave request without auth (401)
  - Test digital pass shows correct student info
  - Verify no DEV001 data in responses

- [ ] 7.3 Create `test_e2e_authentication.py`
  - Test full flow: login → request leave → get pass
  - Verify correct student data throughout
  - Test with multiple different students
  - Verify PDF contains correct information

### 8. Manual Testing

- [ ] 8.1 Test login and leave request flow
  - Login as student "vikash"
  - Request leave via chat
  - Verify digital pass shows correct info
  - Verify no DEV001 data

- [ ] 8.2 Test with different students
  - Create multiple test students
  - Login as each student
  - Request leave for each
  - Verify each pass shows correct student

- [ ] 8.3 Test error scenarios
  - Try to request leave without login
  - Try to access staff endpoints as student
  - Try to access student endpoints as staff
  - Verify proper error messages

## Phase 5: Cleanup and Documentation

### 9. Remove DEV001 Fallback

- [ ] 9.1 Restrict DEV001 usage
  - Only allow DEV001 in DEBUG mode
  - Add clear warnings when DEV001 is used
  - Update logging to track DEV001 usage

- [ ] 9.2 Add authentication documentation
  - Document the two authentication methods
  - Add code examples for developers
  - Update API documentation

### 10. Monitoring and Logging

- [ ] 10.1 Add comprehensive logging
  - Log authentication method for each request
  - Log DEV001 fallback usage (should be zero)
  - Log authentication failures
  - Add metrics for monitoring

- [ ] 10.2 Create monitoring dashboard
  - Track authentication errors
  - Track DEV001 usage
  - Track session vs JWT usage
  - Set up alerts for issues

## Phase 6: Deployment

### 11. Deployment Preparation

- [ ] 11.1 Review all changes
  - Code review for authentication helper
  - Code review for view updates
  - Review test coverage
  - Review documentation

- [ ] 11.2 Prepare rollback plan
  - Document rollback steps
  - Test rollback procedure
  - Prepare monitoring for deployment

### 12. Deploy to Production

- [ ] 12.1 Deploy Phase 1 (Helper function)
  - Deploy authentication helper
  - Monitor for issues
  - Verify no breaking changes

- [ ] 12.2 Deploy Phase 2 (Critical views)
  - Deploy leave request fix
  - Deploy message creation fix
  - Monitor authentication logs
  - Verify correct student data in passes

- [ ] 12.3 Deploy Phase 3 (Remaining views)
  - Deploy all remaining view updates
  - Monitor for issues
  - Verify no DEV001 usage for authenticated users

## Success Criteria Checklist

- [ ] ✅ Helper function created and tested
- [ ] ✅ All critical views updated
- [ ] ✅ All remaining views updated
- [ ] ✅ Integration tests passing
- [ ] ✅ Manual testing completed
- [ ] ✅ No DEV001 data for authenticated users
- [ ] ✅ Digital passes show correct student info
- [ ] ✅ Proper error messages for auth failures
- [ ] ✅ Documentation updated
- [ ] ✅ Monitoring in place
- [ ] ✅ Deployed to production

## Notes

- Prioritize Phase 1 and Phase 2 as they fix the critical issue
- Phase 3 can be done incrementally
- Test thoroughly before each deployment
- Monitor logs closely after deployment
- Be ready to rollback if issues occur
