# Phase 0: Foundation (in progress)

## Goal

Create a safe, testable starting point for the SkillZen monorepo and an initial database schema.

## What was built

- npm workspaces, Node 20 target, strict TypeScript, ESLint, Prettier, Vitest and GitHub Actions.
- Express health endpoint, security middleware, consistent responses, validated configuration, logger and event bus.
- Hand-written dependency container, PostgreSQL connection pool, Drizzle schema and generated migrations.
- Minimal React/Vite/Tailwind page; it explicitly identifies itself as a scaffold.
- Documentation skeleton and roadmap, including mock tests and candidate feedback.

## Files created/changed

- Root `package.json`, `package-lock.json`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierignore`, `.gitignore`, `.env.example`: shared tooling and secret-safe configuration template.
- `apps/api/package.json`, `tsconfig*.json`, `drizzle.config.ts`: backend tools and build settings.
- `apps/api/src/config/env.ts`: validated environment variables.
- `apps/api/src/core/*`: error, response, event and logging utilities.
- `apps/api/src/container.ts`, `app.ts`, `server.ts`: dependency composition, HTTP app and process startup.
- `apps/api/src/middleware/error-handler.ts`: centralized HTTP errors.
- `apps/api/src/db/schema.ts`, `client.ts`, `migrate.ts`, `migrations/`: database tables, pooled client and versioned SQL.
- `apps/api/tests/foundation.test.ts`: configuration, event and HTTP tests.
- `apps/web/`: minimal React/Vite/Tailwind application and build configuration.
- `.github/workflows/ci.yml`: automated lint, types, tests and build.
- `README.md`, `docs/*.md`, `docs/phases/phase-00-foundation.md`: status, setup, design and phase documentation.

## Key concepts and OOP patterns used (and why)

The event bus uses Observer to decouple future completion handlers. The composition root uses dependency injection so the app receives its dependencies. Shared pool and logger instances avoid unnecessary resources.

## Design decisions and trade-offs

Health checks liveness only and does not claim database readiness. Development can run without credentials; production requires a database and a 32-character secret. Neon URLs must use a pooled hostname. The schema is the requested initial version; webcam and mock-test tables will be added with their features.

## How to run and test it

Follow [setup](../SETUP.md), then run `npm run lint`, `npm run type-check`, `npm test`, `npm run build`, and `npm run db:migrate` after setting a database URL. Verify `/api/health`.

## Problems faced and how they were fixed

The checkout contained only a placeholder README, so the specification in the request was used. The sandbox defaults to Node 22; the checks were also run with Node 20.20.2 and CI targets Node 20. Neon credentials are not present, so the migration is generated but not yet verified on Neon.

## What is next

Verify the migration on the user's Neon database; then implement authentication and integration tests. Phase 0 is not complete until the Neon migration is verified.
