# Changelog

## Phase 0 — foundation

- Added npm workspaces, strict TypeScript, React/Vite/Tailwind scaffold, and Express API.
- Added security middleware, typed events, configuration, database schema, versioned SQL and CI.
- The sandbox could not connect to Neon; the user later indicated that the local migration was completed, without providing command output.

## Phase 1 — authentication and users

- Added bcrypt registration and login, JWT cookies, logout, profile APIs, origin checks and auth rate limits.
- Added repository-backed persistence and in-memory Supertest integration tests.
- Updated vulnerable production dependencies; four moderate development-only audit findings remain in Drizzle Kit’s esbuild loader chain.

## Phase 2 — AI layer

- Added free-model provider adapters, fallback router, circuit breakers, timeout and retry, structured JSON repair, scoped LRU cache and usage repository.
- Added fake-provider and mocked HTTP tests; real provider behavior is not yet verified.

## Phase 3 — interview domain (in progress)

- Added round strategies, registry factory and composable AI/speech evaluators with fake-model unit tests.
- Interview persistence, API flows and real-provider verification are still pending.
