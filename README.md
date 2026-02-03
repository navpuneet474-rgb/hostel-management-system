# Hostel Coordination System

## Problem Statement

Traditional hostel management systems require students and staff to navigate complex forms, rigid workflows, and structured interfaces. This creates friction in communication, delays in request processing, and administrative overhead. Students often struggle with:

- Filling out multiple forms for simple requests (guest permissions, leave applications, maintenance issues)
- Waiting for manual staff approval even for routine requests
- Understanding complex hostel rules and policies
- Tracking the status of their requests

Staff members face challenges with:

- Processing high volumes of routine requests manually
- Answering repetitive questions about hostel rules
- Generating daily reports and summaries
- Detecting conflicts and rule violations manually

## Solution Overview

This system transforms unstructured human communication into structured hostel management actions. The core philosophy is **"Let humans talk naturally. Let the system do the structuring."**

### How It Works

1. **Natural Language Interface**: Students send requests in plain English through a WhatsApp-like chat interface
2. **Intent Extraction**: The system analyzes messages to extract intent, dates, and relevant information
3. **Intelligent Routing**: Requests are routed to appropriate handlers based on extracted intent
4. **Auto-Approval Engine**: Routine requests (short leaves, guest permissions, maintenance) are processed automatically
5. **Digital Pass Generation**: Approved leave requests automatically generate PDF passes with QR codes
6. **Staff Dashboard**: Complex requests are escalated to staff with all information pre-structured
7. **Audit Trail**: Every decision is logged with reasoning for transparency and accountability

### Key Assumptions

1. **Natural Language Capability**: Students can express their needs in conversational English
2. **Rule-Based Auto-Approval**: Simple requests (≤2 day leaves, 1-night guests) can be safely auto-approved
3. **Internet Connectivity**: System requires stable internet for API calls and database access
4. **Email Delivery**: Students have access to email for receiving digital passes
5. **Mobile Access**: Primary interface is web-based, accessible from mobile devices

## Technology Stack

- **Backend**: Django 4.2.7 with Django REST Framework
- **Database**: SQLite (development) or PostgreSQL via Supabase (production)
- **AI/NLP**: Google Gemini AI for natural language processing (requires API key)
- **PDF Generation**: ReportLab and WeasyPrint for digital pass creation
- **Frontend**: HTML5, CSS, Vanilla JavaScript
- **Testing**: Pytest with Hypothesis for property-based testing
- **Email**: SMTP integration for notifications
- **SMS Notifications**: Twilio integration (optional, requires configuration)

## Core Features

### 1. Natural Language Processing (Requires Gemini API Key)

- Students send requests in plain English through chat interface
- System uses Google Gemini AI to extract intent, dates, names, and entities
- Confidence scoring ensures accuracy
- Clarification questions for ambiguous requests
- **Note**: Requires GEMINI_API_KEY configuration in .env file

### 2. Auto-Approval Engine

- Leaves ≤2 days: Auto-approved instantly
- Guest stays ≤1 night: Auto-approved for students with clean records
- Maintenance requests: Auto-routed to appropriate staff
- All decisions logged with reasoning

### 3. Digital Pass Management

- Automatic PDF generation with QR codes
- Pass verification system for security
- Email delivery of approved passes
- Pass history tracking and audit trail

### 4. Dual-Role Authentication

- Student login with profile management
- Staff login with role-based permissions
- First-time password change enforcement
- Session-based authentication

### 5. Staff Dashboard

- Real-time view of pending requests
- Natural language query system
- Daily summary generation
- Pass history with CSV export

### 6. Security & Audit

- Comprehensive audit logging
- Row-level security in database
- Input validation and sanitization
- Rate limiting and CSRF protection

### 7. Notification System

- Email notifications for leave approvals/rejections
- SMS alerts via Twilio (optional, requires configuration)

---

## Setup Instructions

### Prerequisites

- Python 3.10 or higher
- SQLite (included with Python) or PostgreSQL via Supabase (optional)
- SMTP server access (for email notifications)
- Google Gemini API key (for AI-powered natural language processing)
- Twilio account (optional, for SMS notifications)

### 1. Clone and Setup Environment

```bash
# Clone the repository
git clone <your-repository-url>
cd hostel_coordination

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Django Configuration
SECRET_KEY=your-django-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1

# Database Configuration (Optional - defaults to SQLite)
# Uncomment and configure for PostgreSQL via Supabase
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_KEY=your-supabase-anon-key
# SUPABASE_SERVICE_KEY=your-supabase-service-key
# DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Google Gemini AI Configuration (Required for NLP features)
GEMINI_API_KEY=your-gemini-api-key-here

# Email Configuration (for pass delivery)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# Twilio Configuration (Optional - for SMS notifications)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

### 3. Database Setup

```bash
# Run Django migrations (uses SQLite by default)
python manage.py migrate

# (Optional) Create Django superuser for admin access
python manage.py createsuperuser
```

**Note**: The system uses SQLite by default for development. To use PostgreSQL via Supabase, configure DATABASE_URL in your .env file.

### 4. Run the Application

```bash
# Start Django development server
python manage.py runserver

# Access the application at:
# http://localhost:8000/
```

### 5. Access the System

- **Student Dashboard**: http://localhost:8000/student/dashboard/
- **Staff Dashboard**: http://localhost:8000/staff/dashboard/
- **Login Page**: http://localhost:8000/auth/login/
- **Admin Panel**: http://localhost:8000/admin/

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Student    │  │    Staff     │  │   Security   │          │
│  │  Dashboard   │  │  Dashboard   │  │  Dashboard   │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         └─────────────────┴─────────────────┘                    │
└─────────────────────────────┼──────────────────────────────────┘
                              │
┌─────────────────────────────┼──────────────────────────────────┐
│                    Django REST API Layer                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Views (core/views.py)                        │  │
│  │  - MessageViewSet, GuestRequestViewSet                    │  │
│  │  - AbsenceRecordViewSet, MaintenanceRequestViewSet        │  │
│  │  - Authentication endpoints, Dashboard endpoints          │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │         Serializers (core/serializers.py)                 │  │
│  │         - Data validation and transformation              │  │
│  └────────────────────┬──────────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────────────────────┐
│                  Business Logic Layer                            │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │    Message Router (message_router_service.py)             │  │
│  │    - Routes messages to appropriate handlers              │  │
│  │    - Manages conversation context                         │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │    Auto Approval (auto_approval_service.py)               │  │
│  │    - Rule-based request processing                        │  │
│  │    - Automatic decision making                            │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │    Leave Request (leave_request_service.py)               │  │
│  │    - Leave processing and approval workflow               │  │
│  │    - Digital pass generation                              │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │    PDF Generation (pdf_generation_service.py)             │  │
│  │    - Digital pass PDF creation with QR codes              │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │    Email Service (email_service.py)                       │  │
│  │    - Email notifications for approvals/rejections         │  │
│  └────────────────────┬──────────────────────────────────────┘  │
└────────────────────────┼─────────────────────────────────────────┘
                         │
┌────────────────────────┼─────────────────────────────────────────┐
│                    Data Layer                                    │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │           Django Models (core/models.py)                  │  │
│  │  - Student, Staff, Message, GuestRequest                  │  │
│  │  - AbsenceRecord, MaintenanceRequest, DigitalPass         │  │
│  │  - AuditLog, SecurityRecord, ConversationContext          │  │
│  └────────────────────┬──────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────┴──────────────────────────────────────┐  │
│  │         Supabase PostgreSQL Database                      │  │
│  │         - Persistent data storage with RLS                │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Data Models

#### Core Entities

**Student**

- `student_id` (PK): Unique identifier
- `name`, `email`, `password_hash`: Authentication
- `room_number`, `block`: Location
- `violation_count`, `last_violation_date`: Behavior tracking
- `is_first_login`: Password change enforcement

**Staff**

- `staff_id` (PK): Unique identifier
- `name`, `email`, `password_hash`: Authentication
- `role`: warden, security, admin, maintenance
- `permissions`: JSON field for role-based access

**Message**

- `message_id` (PK): UUID
- `sender` (FK): Student reference
- `content`: Natural language text
- `status`: pending, processing, processed, failed
- `confidence_score`: Confidence level (0.0-1.0)
- `extracted_intent`: JSON with intent and entities

**AbsenceRecord (Leave Request)**

- `absence_id` (PK): UUID
- `student` (FK): Student reference
- `start_date`, `end_date`: Leave period
- `reason`: Leave justification
- `status`: pending, approved, rejected, expired
- `auto_approved`: Boolean flag
- `approved_by` (FK): Staff reference

**DigitalPass**

- `pass_id` (PK): UUID
- `pass_number`: Unique verification number
- `student` (FK): Student reference
- `absence_record` (FK): Related leave request
- `from_date`, `to_date`, `total_days`: Pass validity
- `status`: active, expired, cancelled
- `verification_code`: Short code for security
- `pdf_path`: Generated PDF location

**GuestRequest**

- `request_id` (PK): UUID
- `student` (FK): Student reference
- `guest_name`, `guest_phone`: Guest details
- `start_date`, `end_date`: Visit period
- `purpose`: Reason for visit
- `status`: pending, approved, rejected
- `auto_approved`: Boolean flag

**MaintenanceRequest**

- `request_id` (PK): UUID
- `student` (FK): Student reference
- `room_number`: Location
- `issue_type`: electrical, plumbing, furniture, other
- `description`: Issue details
- `priority`: low, medium, high, urgent
- `status`: pending, in_progress, resolved, closed

---

## Project Structure

```
hostel_coordination/
├── core/                          # Main Django application
│   ├── models.py                 # Data models (Student, Staff, Message, etc.)
│   ├── views.py                  # REST API endpoints and view logic
│   ├── serializers.py            # DRF serializers for data validation
│   ├── urls.py                   # URL routing configuration
│   ├── authentication.py         # Custom authentication classes
│   ├── security.py               # Security middleware and utilities
│   │
│   ├── services/                 # Business logic layer
│   │   ├── message_router_service.py      # Message routing and processing
│   │   ├── auto_approval_service.py       # Auto-approval rule engine
│   │   ├── leave_request_service.py       # Leave processing workflow
│   │   ├── pdf_generation_service.py      # Digital pass PDF generation
│   │   ├── email_service.py               # Email notification service
│   │   ├── notification_service.py        # Multi-channel notifications
│   │   ├── dashboard_service.py           # Dashboard data aggregation
│   │   ├── daily_summary_service.py       # Daily report generation
│   │   ├── followup_bot_service.py        # Conversation management
│   │   ├── rule_engine_service.py         # Rule evaluation engine
│   │   └── supabase_service.py            # Database operations
│   │
│   ├── management/commands/      # Django management commands
│   │   ├── generate_daily_summary.py      # Generate daily reports
│   │   ├── send_daily_summary_email.py    # Email daily summaries
│   │   ├── send_urgent_sms.py             # SMS notifications
│   │   ├── setup_supabase_schema.py       # Database schema setup
│   │   └── test_leave_emails.py           # Email template testing
│   │
│   ├── tests/                    # Test suite
│   │   ├── test_api_endpoints.py          # API endpoint tests
│   │   ├── test_authentication_helper.py  # Authentication tests
│   │   ├── test_dashboard_service.py      # Dashboard logic tests
│   │   ├── test_digital_pass_display.py   # Pass display tests
│   │   ├── test_security.py               # Security feature tests
│   │   ├── test_email_notifications.py    # Email service tests
│   │   ├── test_comprehensive_e2e.py      # End-to-end tests
│   │   └── test_end_to_end_chat_workflow.py  # Chat workflow tests
│   │
│   ├── sql/                      # Database schemas
│   │   └── supabase_schema.sql   # Supabase PostgreSQL schema
│   │
│   └── migrations/               # Django database migrations
│
├── hostel_coordination/          # Django project settings
│   ├── settings.py              # Main configuration
│   ├── urls.py                  # Root URL configuration
│   ├── wsgi.py                  # WSGI application
│   └── asgi.py                  # ASGI application
│
├── templates/                   # HTML templates
│   ├── auth/                    # Authentication pages
│   │   ├── login.html
│   │   └── change_password.html
│   ├── student/                 # Student interface
│   │   ├── dashboard.html
│   │   └── profile.html
│   ├── staff/                   # Staff interface
│   │   ├── dashboard.html
│   │   ├── pass_history.html
│   │   ├── profile.html
│   │   └── query_interface.html
│   ├── security/                # Security interface
│   │   ├── dashboard.html
│   │   └── verification_dashboard.html
│   ├── chat/                    # Chat interface
│   │   └── index.html
│   ├── passes/                  # Pass templates
│   │   └── digital_pass_template.html
│   ├── emails/                  # Email templates
│   │   ├── leave_auto_approval.html
│   │   ├── leave_warden_approval.html
│   │   ├── leave_rejection.html
│   │   └── leave_escalation.html
│   └── base.html                # Base template
│
├── static/                      # Static files
│   ├── css/
│   │   └── chat.css
│   └── js/
│       ├── chat.js
│       ├── staff-dashboard.js
│       └── pass-history.js
│
├── media/                       # User-uploaded and generated files
│   ├── passes/                  # Generated PDF passes
│   └── chat_uploads/            # Chat file uploads
│
├── logs/                        # Application logs
│   └── django.log
│
├── requirements.txt             # Python dependencies
├── pytest.ini                   # Pytest configuration
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── manage.py                    # Django management script
└── README.md                    # This file
```

---

## API Documentation

### Authentication

**Login Endpoint**: `POST /auth/login/`

```json
{
  "user_id": "STU001",
  "password": "password123",
  "user_type": "student"
}
```

### Message Processing

#### Send Message

`POST /api/messages/`

```json
{
  "content": "I want to go home tomorrow for 2 days",
  "user_context": {
    "user_id": "STU001",
    "name": "Mukesh Kumar",
    "role": "student",
    "room_number": "101"
  }
}
```

#### Get Messages

`GET /api/messages/`

### Leave Requests

#### Get Absence Records

`GET /api/absence-records/`

#### Approve Leave Request (Staff Only)

`POST /api/approve-leave-request/`

```json
{
  "absence_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Valid reason provided (optional)"
}
```

#### Reject Leave Request (Staff Only)

`POST /api/reject-leave-request/`

```json
{
  "absence_id": "550e8400-e29b-41d4-a716-446655440000",
  "reason": "Insufficient documentation (required)"
}
```

### Digital Passes

#### Get Digital Passes

`GET /api/digital-passes/`

### Pass History (Staff Only)

#### Get Pass History

`GET /api/pass-history/`

**Query Parameters**:

- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)
- `student_name`: Filter by student name
- `pass_type`: Filter by type (digital, leave)
- `status`: Filter by status (approved, rejected, active, expired)

#### Export Pass History

`GET /api/pass-history/export/`

Returns CSV file with pass history data.

### Guest Requests

#### Create Guest Request

`POST /api/guest-requests/`

```json
{
  "guest_name": "Rahul Kumar",
  "guest_phone": "9876543210",
  "start_date": "2026-02-01T18:00:00Z",
  "end_date": "2026-02-02T10:00:00Z",
  "purpose": "Family visit"
}
```

#### Get Guest Requests

`GET /api/guest-requests/`

### Maintenance Requests

#### Create Maintenance Request

`POST /api/maintenance-requests/`

```json
{
  "room_number": "101",
  "issue_type": "electrical",
  "description": "Light not working in bedroom",
  "priority": "medium"
}
```

### Dashboard Data

#### Get Dashboard Data

`GET /api/dashboard-data/`

---

## Testing

### Test Structure

```
core/tests/
├── test_api_endpoints.py              # API endpoint tests
├── test_authentication_helper.py      # Authentication logic tests
├── test_dashboard_service.py          # Dashboard data tests
├── test_digital_pass_display.py       # Pass display tests
├── test_security.py                   # Security feature tests
├── test_email_notifications.py        # Email service tests
├── test_comprehensive_e2e.py          # End-to-end workflow tests
└── test_end_to_end_chat_workflow.py   # Chat interaction tests
```

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=core --cov-report=html

# Run specific test file
pytest core/tests/test_api_endpoints.py

# Run with verbose output
pytest -v

# Run tests matching pattern
pytest -k "test_leave"
```

### Property-Based Testing

The project uses Hypothesis for property-based testing:

```python
@given(
    start_date=dates(),
    duration=integers(min_value=1, max_value=30)
)
def test_leave_duration_property(start_date, duration):
    """Property: end_date - start_date should always equal duration"""
    end_date = start_date + timedelta(days=duration)
    absence = AbsenceRecord(start_date=start_date, end_date=end_date)
    assert absence.duration_days == duration
```

---

## Management Commands

```bash
# Generate daily summary
python manage.py generate_daily_summary

# Send summary emails
python manage.py send_daily_summary_email

# Send urgent SMS
python manage.py send_urgent_sms

# Setup database schema
python manage.py setup_supabase_schema

# Test email templates
python manage.py test_leave_emails
```

---

## Security Considerations

### Implemented Security Features

1. **Authentication & Authorization**
   - Session-based authentication
   - Role-based access control (RBAC)
   - Password hashing with PBKDF2
   - First-time password change enforcement

2. **Input Validation**
   - Django form validation
   - DRF serializer validation
   - Custom input sanitization
   - SQL injection prevention (ORM)

3. **Data Protection**
   - HTTPS enforcement in production
   - Secure cookie flags (HttpOnly, Secure, SameSite)
   - CSRF protection
   - XSS prevention

**Database Security**

- Row-level security (RLS) available when using Supabase
- Prepared statements via Django ORM
- Connection encryption
- Regular backups recommended

5. **API Security**
   - CORS configuration
   - Request size limits
   - Custom security middleware

6. **Audit & Monitoring**
   - Comprehensive audit logging
   - Security event logging
   - Failed login tracking

---

## Deployment

### Production Checklist

- [ ] Set `DEBUG=False` in `.env`
- [ ] Generate strong `SECRET_KEY`
- [ ] Configure production database (PostgreSQL recommended)
- [ ] Set up SSL/HTTPS
- [ ] Configure ALLOWED_HOSTS
- [ ] Configure email service (SMTP)
- [ ] Configure Gemini API key for NLP features
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Review security settings

### Production Environment Variables

```env
# Django
SECRET_KEY=<generate-strong-key>
DEBUG=False
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Security
SECURE_SSL_REDIRECT=True
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_HOST_USER=<your-email>
EMAIL_HOST_PASSWORD=<app-password>
```

---

## Troubleshooting

### Common Issues

**Database Connection Error**

```
Error: "could not connect to server"
Solution: Check DATABASE_URL and Supabase credentials
```

**Email Not Sending**

```
Error: "SMTPAuthenticationError"
Solution: Use app-specific password for Gmail, not account password
```

**Static Files Not Loading**

```
Error: 404 on /static/css/chat.css
Solution: Run python manage.py collectstatic
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/your-feature-name`)
3. Make your changes
   - Follow PEP 8 style guide
   - Add docstrings to functions and classes
   - Write tests for new functionality
   - Update documentation
4. Run tests (`pytest`)
5. Commit your changes (`git commit -m "Add feature: description"`)
6. Push to your fork (`git push origin feature/your-feature-name`)
7. Create a Pull Request

---

## License

This project is licensed under the MIT License.

---

**Built for efficient hostel management**
