# Auth System - Frontend

React SPA for the Auth System authentication platform — login, registration, MFA, passkeys, OAuth, admin dashboard, and more.

## Tech Stack

| Category | Technology |
| --- | --- |
| UI Framework | React 19 |
| Language | TypeScript 5.9 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 4 (via @tailwindcss/vite) |
| Routing | React Router 7 |
| State Management | Zustand 5 |
| Data Fetching | TanStack React Query 5 |
| Forms | React Hook Form + Zod |
| HTTP Client | Axios |
| Passkeys | @simplewebauthn/browser |
| Icons | Lucide React |
| Testing | Vitest + Testing Library + jsdom |

## Architecture

```
src/
├── api/             # API client layer (axios instance + endpoint functions)
│                   # auth.api.ts, admin.api.ts, users.api.ts, webhook.api.ts
├── components/
│   ├── guards/      # AuthGuard, AdminGuard, GuestGuard — route protection
│   ├── layout/      # AuthLayout, UserLayout, AdminLayout — page shells
│   └── ui/          # 12+ reusable UI components + Turnstile CAPTCHA widget
├── hooks/           # React Query hooks (useAuth, useUser, useAdmin, useWebAuthn, useWebhook)
├── lib/             # Utilities (fingerprint.ts — client-side device fingerprinting,
│                   #            query-client.ts, utils.ts)
├── pages/
│   ├── auth/        # Login, Register, VerifyEmail, ForgotPassword, ResetPassword,
│   │                # ResendVerification, MfaVerify, StepUpVerify, GoogleCallback
│   ├── user/        # Dashboard, Profile, ChangePassword, Security, MfaSetup,
│   │                # Sessions, Passkeys, DeleteAccount
│   └── admin/       # AdminLogin, Overview, UsersList, UserDetail, UserEdit,
│                    # WebhooksList, WebhookDetail
├── routes/          # React Router config (lazy-loaded, guard-wrapped)
├── stores/          # Zustand auth store (tokens, user, persistence)
└── types/           # TypeScript type definitions (auth, user, admin, webhook)
```

### Route Guards

| Guard | Purpose | Routes |
| --- | --- | --- |
| `GuestGuard` | Redirects authenticated users away | `/login`, `/register`, `/forgot-password`, `/admin/login` |
| `AuthGuard` | Requires authentication | `/dashboard`, `/profile`, `/security/*` |
| `AdminGuard` | Requires admin role + refreshes tokens if needed | `/admin/*` |

All routes are lazy-loaded with `React.lazy()` and a `Suspense` spinner fallback.

### State & Data Flow

- **Auth state**: Zustand store persisted to localStorage (user, roles, MFA status). Access tokens are held in memory only (not persisted).
- **Server state**: TanStack React Query handles all API data (caching, refetching, mutations).
- **Token refresh**: `AdminGuard` uses bare `axios` (not the interceptor-equipped client) to avoid double-refresh loops when the access token expires.

## Setup

### Prerequisites

- Node.js >= 18
- Backend API server running on `http://localhost:3000`

### Install & Run

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:3000`.

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `VITE_API_BASE_URL` | Backend URL (leave empty for Vite proxy) | `` (uses proxy) |
| `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | — (skipped if empty) |

See [.env.example](.env.example) for the full template.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start dev server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Lint with ESLint |
| `npm run test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |

## Testing

Tests use Vitest with jsdom and Testing Library:

```bash
npm run test          # Run once
npm run test:watch    # Watch mode
```
