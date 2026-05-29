# Auth System - Backend

NestJS API server for the Auth System authentication platform — JWT rotation, TOTP MFA, WebAuthn passkeys, Google OAuth, device fingerprinting & anomaly detection, webhooks, and more.

## Tech Stack

| Category | Technology |
| --- | --- |
| Framework | NestJS 11 |
| Language | TypeScript 5.7 |
| ORM | TypeORM 0.3 → PostgreSQL |
| Caching / Rate Limiting | ioredis → Redis (with in-memory fallback) |
| Authentication | Passport + JWT, Google OAuth 2.0 |
| MFA | otplib (TOTP), @simplewebauthn/server (passkeys) |
| Email | Nodemailer + Handlebars templates |
| Image Storage | Cloudinary |
| CAPTCHA | Cloudflare Turnstile |
| Security | Helmet, cookie-parser, bcrypt |
| Validation | class-validator, class-transformer |
| API Docs | @nestjs/swagger (dev only) |
| Testing | Jest + ts-jest + Supertest |

## Architecture

```
src/
├── common/          # Guards (JwtAuthGuard, RolesGuard), decorators (@Public, @CurrentUser, @Roles),
│                   # filters (AllExceptionsFilter), interceptors (TransformInterceptor),
│                   # validators (IsStrongPassword), storage (RedisThrottlerStorage)
├── config/          # AppConfigService, ConfigModule
├── entities/        # 12 TypeORM entities (User, RefreshToken, AuditLog, Webhook, etc.)
├── modules/
│   ├── auth/        # Login, register, MFA, OAuth, step-up verification, breach password check,
│   │                # WebAuthn passkeys (sub-module)
│   ├── users/       # Profile, password change, session management
│   ├── admin/       # User CRUD, audit log queries, anomaly management
│   ├── audit/       # Security event logging service
│   ├── captcha/     # Cloudflare Turnstile verification
│   ├── cloudinary/  # Image upload service
│   ├── device-fingerprint/  # Fingerprint storage, anomaly detection, risk scoring
│   ├── email/       # Transactional emails (verification, reset, notifications)
│   └── webhook/     # Event delivery with HMAC-SHA256 signing and retry tracking
└── seed/            # Admin user seeder
```

All API routes are prefixed with `/api`. Global guards: `ThrottlerGuard` (rate limiting), `JwtAuthGuard` (auth), `RolesGuard` (RBAC). Use `@Public()` to skip auth on specific endpoints.

## Setup

### Prerequisites

- Node.js >= 18
- PostgreSQL database
- Redis server (optional — falls back to in-memory rate limiting if unavailable)
- SMTP server (e.g. Gmail with App Password)
- Cloudinary account (for image uploads)
- Cloudflare account (for Turnstile CAPTCHA — optional)
- Google Cloud project (for OAuth — optional)

### Install & Run

```bash
cp .env.example .env
# Fill in your environment variables
npm install
npm run start:dev
```

The server starts on `http://localhost:3000` by default.

### Seed Admin User

```bash
npm run seed:admin
```

Uses `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_NAME` from your `.env`.

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `JWT_SECRET` | Access token signing secret | — |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | — |
| `JWT_EXPIRATION` | Access token TTL | `15m` |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL | `7d` |
| `JWT_MFA_EXPIRATION` | MFA temp token TTL | `5m` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | PostgreSQL connection | `localhost:5432` |
| `DB_SSL` | Enable SSL for DB connection | `false` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection | `127.0.0.1:6379` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP for transactional email | — |
| `EMAIL_FROM` / `MAIL_FROM_NAME` | Sender address and name | — |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary config | — |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret | — (skipped if empty) |
| `CAPTCHA_ENABLED` | Enable/disable CAPTCHA | `true` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_CALLBACK_URL` | Google OAuth 2.0 | — (skipped if empty) |
| `WEBAUTHN_RP_NAME` / `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | WebAuthn / passkeys config | `localhost` defaults |
| `APP_URL` / `PORT` | Application URL and port | `http://localhost:3000` / `3000` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:3000` |
| `MAX_FAILED_ATTEMPTS` | Login lockout threshold | `5` |
| `LOCK_TIME_MINUTES` | Lockout duration | `30` |
| `ENABLE_SWAGGER` | Enable Swagger UI | — (`true` to enable) |

See [.env.example](.env.example) for the full template.

## API Documentation

Swagger UI is available at `http://localhost:3000/api/docs` when `ENABLE_SWAGGER=true` is set.

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run e2e tests |
| `npm run seed:admin` | Seed an admin user |

## Testing

Unit tests use Jest with SQLite in-memory databases. E2E tests use `better-sqlite3` and are configured in `test/jest-e2e.json`.

```bash
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run test:cov      # Coverage report

ROONEY_DEV
```
