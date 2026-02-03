# Supabase Schema Setup Guide

This guide explains how to set up the Supabase database schema for the AI-Powered Hostel Coordination System.

## Prerequisites

1. Supabase project created
2. Environment variables configured in `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (anon key)
   - `SUPABASE_SERVICE_KEY` (service role key)

## Setup Methods

### Method 1: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `core/sql/supabase_schema.sql`
4. Paste and execute the SQL in the Supabase SQL Editor

### Method 2: Using Django Management Command

```bash
# View the SQL that would be executed
python manage.py setup_supabase_schema --dry-run

# Execute the setup (limited functionality via API)
python manage.py setup_supabase_schema
```

**Note**: The management command has limitations due to Supabase API restrictions. For full schema setup, use Method 1.

## Schema Overview

The schema includes the following tables:

### Core Tables

- **students**: Student information and violation tracking
- **staff**: Staff members with role-based permissions
- **messages**: Natural language messages from students
- **guest_requests**: Guest stay requests and approvals
- **absence_records**: Student absence requests and approvals
- **audit_logs**: Comprehensive audit trail of all AI decisions

### Security Features

- **Row Level Security (RLS)** enabled on all tables
- **Role-based access policies**:
  - Students can only access their own data
  - Staff can access data based on their role (warden, admin, security, maintenance)
  - Admins have full access to audit logs
- **Data validation** through database constraints
- **Referential integrity** with foreign key relationships

### Performance Optimizations

- **Indexes** on frequently queried columns
- **Triggers** for automatic `updated_at` timestamp updates
- **Constraints** for data validation at the database level

## Sample Data

The schema includes sample data for testing:

- 3 sample students (STU001, STU002, STU003)
- 3 sample staff members with different roles (warden, security, admin)

## Verification

After setup, verify the schema by:

1. Checking tables exist in Supabase dashboard
2. Running Django tests: `python manage.py test core.tests.ModelTestCase`
3. Testing Supabase service connection: `python manage.py shell`

```python
from core.services.supabase_service import supabase_service
print(supabase_service.is_configured())  # Should return True
```

## Troubleshooting

### Common Issues

1. **Permission Errors**: Ensure you're using the service role key for schema setup
2. **Connection Errors**: Verify SUPABASE_URL and keys are correct
3. **RLS Policy Errors**: Policies may need to be created manually if automated setup fails

### Manual RLS Policy Creation

If RLS policies fail to create automatically, you can create them manually in the Supabase SQL Editor using the policy definitions in `supabase_schema.sql`.

## Security Considerations

1. **Service Role Key**: Keep the service role key secure and only use it for admin operations
2. **RLS Policies**: Test policies thoroughly to ensure proper data isolation
3. **API Keys**: Rotate keys regularly and monitor usage
4. **Audit Logs**: Monitor audit logs for suspicious activity

## Next Steps

After schema setup:

1. Test the Django models with the Supabase backend
2. Implement the AI Engine Service (Task 3)
3. Set up authentication integration
4. Configure real-time subscriptions for live updates
