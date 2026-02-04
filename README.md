# AI-Powered Hostel Operations & Access Management System

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
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **PDF Generation**: ReportLab and WeasyPrint for digital pass creation
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Testing**: Pytest with Hypothesis for property-based testing
- **Email**: SMTP integration for notifications
- **SMS Notifications**: Twilio integration for urgent alerts

## Core Features

### 1. Natural Language Processing

- Students send requests in plain English
- System extracts intent, dates, names, and other entities
- Confidence scoring ensures accuracy
- Clarification questions for ambiguous requests

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
- SMS alerts for urgent situations (via Twilio)

---

## Setup Instructions

### Prerequisites

- Python 3.10 or higher
- PostgreSQL (via Supabase) or SQLite for local development
- SMTP server access (for email notifications)
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

# Supabase Configuration (PostgreSQL Database)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_KEY=your-supabase-service-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

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
# Run Django migrations
python manage.py migrate

# (Optional) Create Django superuser for admin access
python manage.py createsuperuser
```

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
│   │
│   ├── sql/                      # Database schemas
│   │   └── supabase_schema.sql   # Supabase PostgreSQL schema
│   │
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
├── requirements.txt             # Python dependencies
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

## Deployment

### Production Checklist

- [ ] Set `DEBUG=False` in `.env`
- [ ] Generate strong `SECRET_KEY`
- [ ] Configure production database (Supabase)
- [ ] Set up SSL/HTTPS
- [ ] Configure ALLOWED_HOSTS
- [ ] Configure email service (SMTP)

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
