# Hostel Management System Frontend

A React-based frontend application for managing hostel operations with role-based interfaces for students, wardens, security, maintenance, and admin users.

## Features

- **Role-based Authentication**: Secure login with role-specific dashboard redirection
- **Mobile-first Design**: Optimized for mobile devices with responsive layouts
- **TypeScript Support**: Full type safety and better development experience
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **React Router**: Client-side routing with protected routes
- **Axios Integration**: HTTP client configured for Django backend communication

## Technology Stack

- **React 18+** with functional components and hooks
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **React Router v6** for navigation
- **Axios** for API communication
- **Ant Design** for UI components
- **Vite** for build tooling

## Project Structure

```
src/
├── api/                 # API client and endpoints
├── components/          # Reusable components
│   ├── ui/             # UI components (buttons, forms, etc.)
│   ├── layout/         # Layout components
│   ├── forms/          # Form components
│   └── routing/        # Route protection components
├── config/             # Configuration files
├── context/            # React context providers
├── pages/              # Page components
├── types/              # TypeScript type definitions
└── styles.css          # Global styles
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Django backend running on http://localhost:8000

### Installation

1. Install dependencies:

```bash
npm install
```

2. Copy environment configuration:

```bash
cp .env.example .env
```

3. Update `.env` with your configuration:

```env
VITE_API_BASE_URL=http://localhost:8000
```

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at http://localhost:5173

### Building

Build for production:

```bash
npm run build
```

## Routes Migrated

### Public Routes

- `/login` - User authentication

### Student Routes

- `/student/dashboard` - Student dashboard
- `/student/profile` - Student profile management
- `/student/debug` - Debug interface

### Warden Routes

- `/warden/dashboard` - Warden dashboard
- `/warden/profile` - Warden profile management

### Security Routes

- `/security/dashboard` - Security dashboard
- `/security/active-passes` - Active pass monitoring
- `/security/profile` - Security profile management

### Maintenance Routes

- `/maintenance/dashboard` - Maintenance dashboard
- `/maintenance/profile` - Maintenance profile management

### Admin Routes

- `/admin/dashboard` - Admin dashboard

### Shared Routes

- `/chat` - AI-powered chat interface
- `/auth/change-password` - Password change

### Template Routes

- `/passes/digital-template` - Digital pass templates
- `/emails/*` - Email templates

## User Roles

The application supports the following user roles:

- **Student**: Access to leave requests, complaints, and guest management
- **Warden**: Approval workflows and hostel management
- **Security**: Guest verification and entry/exit monitoring
- **Maintenance**: Complaint resolution and maintenance tasks
- **Admin**: Full system access and administration

## API Configuration

The frontend communicates with a Django backend. API endpoints are configured in `src/config/api.ts` and can be customized via environment variables.

### Role-based Routing

Protected routes automatically redirect users to their appropriate dashboards based on their role:

- Students → `/student/dashboard`
- Wardens → `/warden/dashboard`
- Security → `/security/dashboard`
- Maintenance → `/maintenance/dashboard`
- Admin → `/admin/dashboard`

## Backend Integration

The Vite dev server is configured to work with the Django backend at `http://localhost:8000`.
Make sure the Django backend is running before starting the frontend development server.

## Development Guidelines

- Follow TypeScript best practices
- Use functional components with hooks
- Implement responsive design with Tailwind CSS
- Ensure accessibility compliance
- Write meaningful component and function names
- Add proper error handling for API calls

## Contributing

1. Follow the existing code structure and naming conventions
2. Ensure TypeScript compilation passes without errors
3. Test responsive design on multiple screen sizes
4. Verify role-based access control works correctly
