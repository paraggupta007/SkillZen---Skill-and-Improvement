# Phase 1: Auth and users

## Goal

Create a secure account and profile API that can be tested without a live database.

## What was built

Registration, login, logout, current-user and profile update routes; bcrypt password hashes; one-hour JWT cookies; request validation, rate limits and origin checks; repository-backed user storage; and Supertest flows with an in-memory repository. The frontend auth screens come in Phase 5.

## Files created/changed

- `apps/api/src/modules/auth/auth-service.ts`: authentication and profile business rules.
- `apps/api/src/modules/auth/routes.ts`: validated routes and session cookies.
- `apps/api/src/modules/users/user-repository.ts`: user storage interface and types.
- `apps/api/src/modules/users/drizzle-user-repository.ts`: database implementation.
- `apps/api/src/container.ts`, `app.ts`: inject the repository and register HTTP routes and origin checks.
- `apps/api/src/middleware/error-handler.ts`: avoid logging potentially sensitive SQL error details.
- `apps/api/tests/auth.test.ts`: Supertest coverage using an in-memory repository.
- `apps/web/vite.config.ts`: limit allowed preview hosts.
- `package.json`, workspace manifests and lockfile: auth dependencies and security updates.
- `README.md`, `docs/API.md`, `DATABASE.md`, `ARCHITECTURE.md`, `SETUP.md`, `TESTING.md`, `PROGRESS.md`, `CHANGELOG.md`, `INDEX.md`: update instructions and system descriptions.

## Key concepts and OOP patterns used (and why)

Repository separates SQL from business logic. Constructor injection lets tests use an in-memory implementation. One service owns account rules; route handlers only validate and translate HTTP. JWT signing keeps sessions stateless.

## Design decisions and trade-offs

Email is normalized; bcrypt passwords are limited to 72 bytes to prevent silent truncation. Cookies are httpOnly and expire after one hour; production uses Secure and SameSite=None for cross-site hosting. A matching Origin is required on browser writes. Logout clears the cookie but cannot revoke a copied JWT; a session store or token revocation is a future hardening task. Tests use a fake repository, not Neon. There is no email verification or password reset yet.

## How to run and test it

Set a pooled `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters in `apps/api/.env`. Run `npm install`, `npm run lint`, `npm run type-check`, `npm test`, `npm run build` and `npm run dev`. Use the examples in [API.md](../API.md). Avoid sharing secrets. Database-backed authentication needs manual testing on an accessible database.

## Problems faced and how they were fixed

The initial audit found vulnerable dependencies. Drizzle ORM, Zod, Vite and Vitest were upgraded and checks rerun on Node 20.20.2. At the time of checking, `npm audit --omit=dev` reported zero findings; four moderate findings remain in Drizzle Kit's development-only esbuild loader chain. An npm 10 dependency-resolution issue during upgrade was avoided by generating the lockfile with npm 11; a clean `npm ci` and all checks succeeded with Node 20/npm 10.

## What is next

Implement the AI abstraction, free provider chain, fake provider, prompt builder and fallback tests. Later, add frontend forms and real-database integration tests.
