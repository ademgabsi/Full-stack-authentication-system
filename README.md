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
- Redis-backed distributed rate limiting on all endpoints via @nestjs/throttler
- Swagger API documentation (dev only)
- Audit logging of all security-relevant actions (login, MFA, password changes, admin actions)
- Cloudflare Turnstile CAPTCHA on registration and login forms
- Session management with device tracking (view, revoke individual or all sessions)
- Have I Been Pwned (HIBP) breach password detection on registration, password change, and password reset
- Google OAuth social login with automatic account linking
- Passkeys / WebAuthn passwordless login and registration using biometrics or hardware keys
- Webhooks & event system — notify external services on 12 auth events (user.registered, user.locked, mfa.enabled, etc.) with HMAC-SHA256 signed payloads, delivery tracking, and admin management UI

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Backend | NestJS, TypeORM, PostgreSQL, Redis, Passport, JWT, Nodemailer, Cloudinary, Cloudflare Turnstile, Google OAuth, SimpleWebAuthn |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod |

## Project Structure

```
auth-system/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── common/   # Guards, decorators, filters, interceptors, validators, storage
│   │   ├── config/   # App configuration service
│   │   ├── entities/ # TypeORM entities
│   │   ├── modules/  # Feature modules (auth, users, admin, email, cloudinary, audit, captcha, webhook)
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
- Redis server (optional — app falls back to in-memory rate limiting if unavailable; run via `docker run -d --name redis -p 6379:6379 redis:alpine`)
- SMTP server (e.g. Gmail with App Password)
- Cloudinary account (for image uploads)
- Cloudflare account (for Turnstile CAPTCHA — optional, skipped if no secret key is set)
- Google Cloud project (for OAuth social login — optional, skipped if `GOOGLE_CLIENT_ID` is not set)

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

### Rate Limiting

All endpoints are rate-limited using `@nestjs/throttler` backed by Redis, ensuring limits persist across server restarts and are shared across multiple instances. If Redis is unavailable, the app automatically falls back to in-memory rate limiting and reconnects when Redis comes back up.

| Profile | Window | Max Requests | Scope |
| --- | --- | --- | --- |
| `short` | 1 second | 3 | Global default |
| `medium` | 10 seconds | 20 | Global default |
| `long` | 60 seconds | 100 | Global default |

Sensitive auth endpoints override these defaults with stricter limits:

| Endpoint | Window | Max Requests |
| --- | --- | --- |
| `POST /auth/register` | 60s | 5 |
| `POST /auth/login` | 60s | 10 |
| `POST /auth/forgot-password` | 60s | 3 |
| `POST /auth/reset-password` | 60s | 5 |
| `POST /auth/verify-email` | 60s | 5 |
| `POST /auth/resend-verification` | 60s | 3 |
| `POST /auth/mfa/verify` | 60s | 10 |
| `POST /auth/mfa/verify-backup` | 60s | 10 |
| `POST /auth/webauthn/login/*` | 60s | 10 |

- **Redis storage**: Uses an atomic Lua script for increment + TTL in a single round-trip (no race conditions)
- **Automatic fallback**: If Redis is down, falls back to in-memory storage seamlessly; reconnects when Redis recovers
- **Global guard**: `ThrottlerGuard` is registered globally — all endpoints are protected by default
- **Opt-out**: Use `@SkipThrottle()` to exempt specific endpoints (e.g., health checks)

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
| Auth | `auth.login`, `auth.login.failed`, `auth.login.google`, `auth.login.webauthn`, `auth.webauthn.register`, `auth.webauthn.credential_deleted`, `auth.logout`, `auth.register`, `auth.refresh`, `auth.session.revoked`, `auth.session.revoked_all` |
| Password | `auth.password.change`, `auth.password.reset` |
| MFA | `auth.mfa.enabled`, `auth.mfa.disabled`, `auth.mfa.verified` |
| Email | `auth.email.verified` |
| Admin | `admin.user.locked`, `admin.user.unlocked`, `admin.user.deactivated`, `admin.user.role-changed`, `admin.user.updated` |

Admin endpoints for querying logs:

- `GET /admin/audit-logs?userId=&action=&from=&to=&page=&limit=` — paginated query
- `GET /admin/audit-logs/stats` — aggregate stats (logins per day, failure counts, action breakdown)

### Anti-Enumeration

All login and email verification errors return generic responses to prevent account enumeration:

- Login failures always return `Invalid credentials` regardless of whether the account exists, is unverified, locked, deactivated, or the password is wrong
- Failed attempt counts and lock status are never exposed to the client
- Account lockout emails are the only channel that reveals lock status to the account owner
- Email verification returns `Invalid verification code` even when the email is already verified

### Session Management

Each refresh token tracks device info (browser/OS from user-agent), IP address, and last-used timestamp.

- `GET /api/auth/sessions` — list all active sessions (marks current session)
- `DELETE /api/auth/sessions/:id` — revoke a specific session
- `DELETE /api/auth/sessions` — revoke all sessions except the current one

The frontend provides a sessions page at `/security/sessions` with device icons, IP, location, last-active time, and revoke buttons.

### CAPTCHA / Bot Detection

Cloudflare Turnstile is integrated on the registration, login, and admin login forms. The frontend renders an invisible/managed widget, attaches the token to the form payload, and the backend verifies it server-side via Cloudflare's siteverify API.

- **Environment-conditional**: CAPTCHA is automatically skipped when `TURNSTILE_SECRET_KEY` is not set
- **Reset on failure**: The widget resets automatically after a failed submission
- **Configurable**: Set `CAPTCHA_ENABLED=false` to disable even with a secret key configured

### Breach Password Detection (HIBP)

All password-setting flows (registration, password change, password reset) check new passwords against the [Have I Been Pwned](https://haveibeenpwned.com/Passwords) database using the k-anonymity API:

- Only the first 5 characters of the SHA-1 hash are sent to the HIBP API — the full password never leaves the server
- If a password is found in known breaches, the request returns a `400` error with the breach count and a warning message
- Users can bypass the warning by passing `ignoreBreachWarning: true` in the request body (for non-blocking UX flows)
- API responses are cached in-memory with a 24-hour TTL to minimize external calls
- If the HIBP API is unavailable, the check is silently skipped (fail-open) to avoid blocking legitimate signups

### Google OAuth Social Login

Users can sign in or register using their Google account via server-side OAuth 2.0 redirect flow:

- **Initiate**: `GET /api/auth/google` redirects to Google's consent screen
- **Callback**: `GET /api/auth/google/callback` handles the redirect, creates or links the user, sets the refresh token cookie, and redirects to the frontend with access tokens
- **Auto-linking**: If a Google login email matches an existing credential-based account, the accounts are automatically linked (user can still sign in with either method)
- **Passwordless**: Google-only users don't need a password; their email is auto-verified
- **Setup**: Create OAuth 2.0 credentials in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in your `.env`

### Passkeys / WebAuthn

Users can register and authenticate with passkeys (biometrics, hardware security keys, or device PINs) for fully passwordless login:

- **Registration**: `POST /api/auth/webauthn/register/options` → `POST /api/auth/webauthn/register/verify` — generates a challenge, verifies the credential, stores it server-side
- **Authentication**: `POST /api/auth/webauthn/login/options` → `POST /api/auth/webauthn/login/verify` — supports both email-specific and discoverable (userless) credential flows
- **Management**: `GET/PATCH/DELETE /api/auth/webauthn/credentials` — list, rename, and delete registered passkeys
- **Discoverable credentials**: Passkeys work without typing an email first — the browser shows an account picker
- **Security**: Uses the [SimpleWebAuthn](https://simplewebauthn.dev/) library with k-anonymity; credentials are scoped to your Relying Party ID
- **Setup**: Set `WEBAUTHN_RP_NAME`, `WEBAUTHN_RP_ID`, and `WEBAUTHN_ORIGIN` in your `.env` (defaults work for `localhost`)

### Webhooks & Event System

Admins can configure webhooks to receive real-time HTTP notifications when authentication events occur. Each webhook subscribes to specific events and delivers signed JSON payloads to a configurable URL.

**Available Events:**

| Event | Description | Trigger |
| --- | --- | --- |
| `user.registered` | New account created | Registration |
| `user.email_verified` | Email address verified | Email verification |
| `user.login` | Successful login | Login (non-MFA) |
| `user.login_failed` | Failed login attempt | Login failure |
| `user.locked` | Account locked | Auto-lock or admin lock |
| `user.unlocked` | Account unlocked | Admin unlock |
| `user.deactivated` | Account deactivated | Admin deactivation |
| `user.password_changed` | Password changed | Password change |
| `user.password_reset` | Password reset completed | Password reset flow |
| `user.role_changed` | User role changed | Admin role update |
| `mfa.enabled` | MFA enabled by user | MFA setup |
| `mfa.disabled` | MFA disabled by user | MFA disable |

**Payload Format:**

```json
{
  "id": "unique-delivery-id",
  "event": "user.registered",
  "timestamp": "2026-05-13T00:00:00.000Z",
  "data": {
    "userId": "uuid",
    "email": "user@example.com"
  }
}
```

**Security:**
- Each webhook gets a unique 64-character hex signing secret
- Payloads are signed with HMAC-SHA256 and sent in the `X-Webhook-Signature` header
- The `X-Webhook-Event` and `X-Webhook-Delivery-Id` headers identify the event and delivery
- Verify signatures on the receiving end: `HMAC-SHA256(secret, JSON.stringify(payload))`

**Delivery Tracking:**
- Every delivery attempt is logged with HTTP response status, response body, attempt count, and final status (`success` or `failed`)
- 10-second timeout per delivery
- Delivery history is viewable per webhook in the admin panel

**Admin Endpoints:**

| Endpoint | Description |
| --- | --- |
| `GET /admin/webhooks` | List webhooks (paginated, searchable, filterable by event) |
| `GET /admin/webhooks/events` | Get available event types |
| `GET /admin/webhooks/stats` | Get delivery statistics |
| `GET /admin/webhooks/:id` | Get webhook details |
| `POST /admin/webhooks` | Create webhook |
| `PUT /admin/webhooks/:id` | Update webhook |
| `DELETE /admin/webhooks/:id` | Delete webhook |
| `GET /admin/webhooks/:id/deliveries` | Get delivery history for a webhook |

**Admin UI:**
- `/admin/webhooks` — List, create, toggle, and delete webhooks; select subscribed events with multi-select
- `/admin/webhooks/:id` — View webhook details, signing secret (with copy), subscribed events, and delivery history with status filtering

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
