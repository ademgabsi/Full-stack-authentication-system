# Auth System - Backend

NestJS API for the Auth System authentication platform.

## Setup

```bash
cp .env.example ..env
# Fill in your environment variables
npm install
npm run start:dev
```

## API Documentation

Swagger UI available at `http://localhost:3000/api/docs` (development mode only).

## Scripts

| Command | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Run production build |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run seed:admin` | Seed an admin user |

## Environment Variables

See [.env.example](.env.example) for all required variables.
