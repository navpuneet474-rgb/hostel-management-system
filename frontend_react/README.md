# frontend_react

React + TypeScript migration for the existing HTML/CSS/JS frontend.

## Stack
- React 18 + TypeScript
- Vite
- Ant Design (antd)
- React Hooks
- Tailwind CSS (configured) + custom CSS

## Routes Migrated
- `/` login
- `/auth/change-password`
- `/student/dashboard`
- `/student/profile`
- `/staff`
- `/staff/pass-history`
- `/staff/query`
- `/staff/profile`
- `/security/dashboard`
- `/security/active-passes`
- `/security/profile`
- `/maintenance/dashboard`
- `/maintenance/profile`
- `/chat`
- `/passes/digital-template`
- `/emails/leave-warden-approval`
- `/emails/leave-escalation`
- `/emails/leave-rejection`
- `/emails/maintenance-status-update`
- `/emails/leave-auto-approval`

## Start
```bash
cd frontend_react
npm install
npm run dev
```

## Backend integration
The Vite dev server proxies backend routes to `http://127.0.0.1:8000`.
Make sure Django backend is running first.
