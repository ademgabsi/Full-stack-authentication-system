# Auth System

A full-stack authentication system with multi-factor authentication, role-based access control, and an admin dashboard.

## Features

- JWT access + refresh token rotation
- TOTP-based MFA with backup codes
- Email verification via 6-digit codes
- Password reset flow
- Account lockout after failed login attempts
- Role-based access control (user / admin)
- Profile image upload via Cloudinary
- Rate limiting on sensitive endpoints
- Swagger API documentation (dev only)

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Backend | NestJS, TypeORM, PostgreSQL, Passport, JWT, Nodemailer, Cloudinary |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, React Query, React Hook Form + Zod |

## Project Structure

```
auth-system/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── common/   # Guards, decorators, filters, interceptors, validators
│   │   ├── config/   # App configuration service
│   │   ├── entities/ # TypeORM entities
│   │   ├── modules/  # Feature modules (auth, users, admin, email, cloudinary)
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
