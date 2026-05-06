# Auth System

A full-stack authentication system with multi-factor authentication, role-based access control, and an admin dashboard.

## Features

- JWT access + refresh token rotation with HTTP-only cookie for refresh tokens
- TOTP-based MFA with backup codes
- Email verification via 6-digit codes
- Password reset flow
- Account lockout after failed login attempts
- Role-based access control (user / admin)
- Profile image upload via Cloudinary
- Rate limiting on sensitive endpoints
- Swagger API documentation (dev only)
- Audit logging of all security-relevant actions (login, MFA, password changes, admin actions)
- Cloudflare Turnstile CAPTCHA on registration and login forms

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Backend | NestJS, TypeORM, PostgreSQL, Passport, JWT, Nodemailer, Cloudinary, Cloudflare Turnstile |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod |

## Project Structure

```
auth-system/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── common/   # Guards, decorators, filters, interceptors, validators
│   │   ├── config/   # App configuration service
│   │   ├── entities/ # TypeORM entities
│   │   ├── modules/  # Feature modules (auth, users, admin, email, cloudinary, audit, captcha)
│   │   └── seed/     # Database seed scripts
│   └── test/         # E2E tests
├── frontend/         # React SPA
│   ├── src/
│   │   ├── api/      # API client & endpoint functions
│   │   ├── components/ # UI components, layouts, route guards
│   │   ├── hooks/    # React Query mutations
│   │   ├── pages/    # Route pages (auth, user, admin)
│   │   ├── routes/   # Router configuration
│   │   ├── stores/   # Zustand stores
│   │   └── types/    # TypeScript type definitions
│   └── public/       # Static assets
└── README.md
```

## Quick Start

### Prerequisites

- Node.js >= 18
- PostgreSQL database
- SMTP server (e.g. Gmail with App Password)
- Cloudinary account (for image uploads)
- Cloudflare account (for Turnstile CAPTCHA — optional, skipped if no secret key is set)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in your environment variables
npm install
npm run start:dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies `/api` requests to the backend.

### 3. Seed Admin User

```bash
cd backend
npm run seed:admin
```

## Environment Variables

See [backend/.env.example](backend/.env.example) and [frontend/.env.example](frontend/.env.example) for all required variables.

## Security

### HTTP-Only Cookies

Refresh tokens are stored in an HTTP-only, `SameSite=Strict` cookie (`refresh_token`) set by the backend on login and cleared on logout. This prevents XSS-based token theft since JavaScript cannot access the cookie.

### Audit Logging

All security-relevant actions are logged to the `audit_logs` table with:

- User ID, action name, target resource, metadata (JSON)
- IP address (supports `X-Forwarded-For`) and user-agent
- Timestamped with indexes on `[userId, timestamp]` and `[action, timestamp]`

Logged actions include:

| Category | Actions |
| --- | --- |
| Auth | `auth.login`, `auth.login.failed`, `auth.logout`, `auth.register`, `auth.refresh` |
| Password | `auth.password.change`, `auth.password.reset` |
| MFA | `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.mfa.verified` |
| Email | `auth.email.verified` |
| Admin | `admin.user.locked`, `admin.user.unlocked`, `admin.user.deactivated`, `admin.user.role-changed`, `admin.user.updated` |

Admin endpoints for querying logs:

- `GET /admin/audit-logs?userId=&action=&from=&to=&page=&limit=` — paginated query
- `GET /admin/audit-logs/stats` — aggregate stats (logins per day, failure counts, action breakdown)

### CAPTCHA / Bot Detection

Cloudflare Turnstile is integrated on the registration and login forms. The frontend renders an invisible/managed widget, attaches the token to the form payload, and the backend verifies it server-side via Cloudflare's siteverify API.

- **Environment-conditional**: CAPTCHA is automatically skipped when `TURNSTILE_SECRET_KEY` is not set
- **Reset on failure**: The widget resets automatically after a failed submission
- **Configurable**: Set `CAPTCHA_ENABLED=false` to disable even with a secret key configured

## API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` when running in development mode.

## Available Scripts

### Backend

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run seed:admin` | Seed admin user |

### Frontend

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint with ESLint |

## License

MIT
