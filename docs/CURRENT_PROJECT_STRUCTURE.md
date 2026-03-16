# Current Project Structure

This document reflects the actual current folder structure of the Hostel Management System project.

```
hostel_coordination/
├── .env                           # Environment variables (not in git)
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── manage.py                      # Django management script
├── pytest.ini                     # Pytest configuration
├── README.md                      # Project documentation
├── render.yaml                    # Render deployment configuration
├── requirements.txt               # Python dependencies
├── runtime.txt                    # Python runtime version
├── CURRENT_PROJECT_STRUCTURE.md   # This file
├── UI_IMPROVEMENTS_SUMMARY.md     # UI improvements documentation
│
├── .git/                          # Git repository data
├── .hypothesis/                   # Hypothesis testing cache
│   ├── examples/                  # Generated test examples
│   └── unicode_data/              # Unicode data cache
│
├── .pytest_cache/                 # Pytest cache
├── .vscode/                       # VS Code settings
│   └── settings.json
│
├── core/                          # Main Django application
│   ├── __init__.py
│   ├── admin.py                   # Django admin configuration
│   ├── apps.py                    # App configuration
│   ├── auth_views.py              # Authentication views
│   ├── authentication.py         # Custom authentication classes
│   ├── models.py                  # Data models (Student, Staff, Message, etc.)
│   ├── security.py                # Security middleware and utilities
│   ├── serializers.py             # DRF serializers for data validation
│   ├── SUPABASE_SETUP.md          # Supabase setup documentation
│   ├── tests.py                   # Basic tests
│   ├── urls.py                    # URL routing configuration
│   ├── utils.py                   # Utility functions
│   ├── views.py                   # REST API endpoints and view logic
│   │
│   ├── __pycache__/               # Python bytecode cache
│   │
│   ├── management/                # Django management commands
│   │   ├── __init__.py
│   │   ├── __pycache__/
│   │   └── commands/
│   │       ├── __init__.py
│   │       ├── __pycache__/
│   │       ├── create_test_users.py
│   │       ├── generate_daily_summary.py
│   │       ├── send_daily_summary_email.py
│   │       ├── send_urgent_sms.py
│   │       ├── setup_supabase_schema.py
│   │       └── test_leave_emails.py
│   │
│   ├── migrations/                # Database migrations
│   │   ├── __init__.py
│   │   ├── __pycache__/
│   │   ├── 0001_initial.py
│   │   ├── 0002_alter_auditlog_action_type_maintenancerequest.py
│   │   ├── 0003_add_authentication_fields.py
│   │   ├── 0004_alter_staff_email_alter_student_email.py
│   │   ├── 0005_digitalpass_alter_auditlog_action_type_and_more.py
│   │   ├── 0006_conversationcontext.py
│   │   ├── 0007_add_guest_relationship.py
│   │   └── 0008_remove_student_roll_number.py
│   │
│   ├── services/                  # Business logic layer
│   │   ├── __init__.py
│   │   ├── __pycache__/
│   │   ├── ai_engine_service.py           # AI processing service
│   │   ├── auto_approval_service.py       # Auto-approval rule engine
│   │   ├── daily_summary_service.py       # Daily report generation
│   │   ├── dashboard_service.py           # Dashboard data aggregation
│   │   ├── email_service.py               # Email notification service
│   │   ├── followup_bot_service.py        # Conversation management
│   │   ├── gemini_service.py              # Google Gemini AI integration
│   │   ├── leave_request_service.py       # Leave processing workflow
│   │   ├── message_router_service.py      # Message routing and processing
│   │   ├── notification_service.py        # Multi-channel notifications
│   │   ├── pdf_generation_service.py      # Digital pass PDF generation
│   │   ├── rule_engine_service.py         # Rule evaluation engine
│   │   └── supabase_service.py            # Database operations
│   │
│   ├── sql/                       # Database schemas
│   │   └── supabase_schema.sql    # Supabase PostgreSQL schema
│   │
│   └── tests/                     # Comprehensive test suite
│       ├── __init__.py
│       ├── __pycache__/
│       ├── test_api_endpoints.py
│       ├── test_authentication_helper.py
│       ├── test_comprehensive_e2e.py
│       ├── test_dashboard_service.py
│       ├── test_digital_pass_display.py
│       ├── test_email_notifications.py
│       ├── test_end_to_end_chat_workflow.py
│       └── test_security.py
│
├── hostel_coordination/           # Django project settings
│   ├── __init__.py
│   ├── __pycache__/
│   ├── asgi.py                    # ASGI application
│   ├── settings.py                # Main configuration
│   ├── urls.py                    # Root URL configuration
│   └── wsgi.py                    # WSGI application
│
├── logs/                          # Application logs
│   └── django.log                 # Django application log
│
├── media/                         # User uploaded files
│   ├── chat_uploads/              # Chat file uploads (empty)
│   └── passes/                    # Generated PDF passes
│       ├── pass_LP-20260129-0514_SEC001.pdf
│       ├── pass_LP-20260129-0859_DEV001.pdf
│       ├── pass_LP-20260129-0973_DEV001.pdf
│
├── static/                        # Static files (development)
│   ├── css/
│   │   └── chat.css               # Chat interface styles
│   └── js/
│       ├── chat-fix.js            # Chat bug fixes
│       ├── chat.js                # Chat functionality
│       ├── pass-history.js        # Pass history interface
│       ├── staff-dashboard.js     # Staff dashboard functionality
│       └── sw.js                  # Service worker
│
├── staticfiles/                   # Collected static files (production)
│   ├── admin/                     # Django admin static files
│   │   ├── css/
│   │   ├── img/
│   │   └── js/
│   ├── css/
│   │   └── chat.css
│   ├── js/
│   │   ├── chat-fix.js
│   │   ├── chat.js
│   │   ├── pass-history.js
│   │   ├── staff-dashboard.js
│   │   └── sw.js
│   └── rest_framework/            # Django REST Framework static files
│       ├── css/
│       ├── docs/
│       ├── fonts/
│       ├── img/
│       └── js/
│
├── templates/                     # HTML templates
│   ├── base.html                  # Base template (improved design)
│   │
│   ├── auth/                      # Authentication pages
│   │   ├── change_password.html   # Password change form
│   │   └── login.html             # Login page
│   │
│   ├── chat/                      # Chat interface
│   │   └── index.html             # Main chat interface
│   │
│   ├── emails/                    # Email templates
│   │   ├── leave_auto_approval.html
│   │   ├── leave_escalation.html
│   │   ├── leave_rejection.html
│   │   ├── leave_warden_approval.html
│   │   └── maintenance_status_update.html
│   │
│   ├── maintenance/               # Maintenance staff interface
│   │   └── dashboard.html         # Maintenance dashboard
│   │
│   ├── passes/                    # Pass templates
│   │   └── digital_pass_template.html  # PDF pass template
│   │
│   ├── security/                  # Security interface
│   │   ├── active_passes.html     # Active passes view
│   │   └── dashboard.html         # Security dashboard (improved)
│   │
│   ├── staff/                     # Staff interface
│   │   ├── dashboard.html         # Staff dashboard (improved)
│   │   ├── pass_history.html      # Pass history view
│   │   ├── profile.html           # Staff profile
│   │   └── query_interface.html   # Natural language query interface
│   │
│   └── student/                   # Student interface
│       ├── dashboard.html         # Student dashboard (improved)
│       ├── profile.html           # Student profile
│       └── studentDebug.html      # Debug interface
│
└── venv/                          # Python virtual environment
    ├── bin/                       # Executable files
    ├── include/                   # Header files
    ├── lib/                       # Python packages
    ├── lib64/                     # 64-bit libraries (symlink)
    ├── share/                     # Shared data
    └── pyvenv.cfg                 # Virtual environment configuration
```

## Key Differences from README Documentation

### Additional Directories/Files (Not in README):

- `logs/` - Application logging directory
- `media/` - User uploaded files and generated passes
- `templates/maintenance/` - Maintenance staff interface
- `templates/student/studentDebug.html` - Debug interface
- `render.yaml` - Deployment configuration
- `runtime.txt` - Python runtime specification
- `UI_IMPROVEMENTS_SUMMARY.md` - UI improvements documentation
- `CURRENT_PROJECT_STRUCTURE.md` - This file

### Missing from Current Structure (Documented in README):

- `templates/security/verification_dashboard.html` - Not implemented

### Notes:

1. **UI Improvements**: The templates have been improved with a new design system
2. **Generated Files**: Many PDF passes in `media/passes/` from testing
3. **Cache Directories**: Various `__pycache__/` directories for Python bytecode
4. **Development Files**: `.hypothesis/`, `.pytest_cache/`, `.vscode/` for development tools
5. **Virtual Environment**: Complete `venv/` directory with all dependencies

This structure represents the actual current state of the project as of the latest updates.
