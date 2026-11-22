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

### Phase 3 — interview API (pending live verification)

- Added authenticated interview creation, history, detail, SSE questions and evaluations, and idempotent completion.
- Added transactional persistence and migration 0002, tested against isolated PGlite; fake-AI HTTP integration and a manual Neon/Groq smoke command were added.
- Neon migration 0002 and real Groq testing remain outstanding.

### Phase 3 — Groq diagnostics

- Added a credential-safe Groq connectivity/streaming diagnostic and stage-specific smoke errors.
- Fixed provider SSE parsing when CRLF boundaries are split across network chunks, with a regression test.
- The user confirmed the Neon migration succeeded; real Groq smoke verification is still pending.

### Phase 3 — update deprecated Groq models

- Switched Groq reasoning and quick tasks to the provider's recommended GPT-OSS 120B and 20B model IDs; added request-body regression tests.
- The change is based on Groq's published deprecation notice; it has not yet been verified with the user's live account.

### Phase 3 — live smoke verification

- User reported that the Neon and Groq interview smoke check passed after the model update.

## Phase 4 — reports and analytics

- Completion events schedule validated report generation, with pending/failed/ready status and explicit retry.
- Added report and dashboard analytics repositories, authenticated APIs and isolated PostgreSQL/fake-AI integration tests.
- Background state is process-local; live report generation and a durable worker remain unverified/not implemented.

## Phase 5 — frontend MVP

- Added responsive landing, sign-in, registration, dashboard, setup, streaming interview and report screens.
- Added session guards, API/SSE clients, query cache, answer draft store, score trend and asynchronous report retry.
- Added frontend tests and a Vercel SPA rewrite; live browser flow and production deployment still need verification.

## Phase 6 — voice

- Added explicit browser speech recognition and read-aloud controls with approximate optional speech coaching metrics.
- Added opt-in, owner-checked, size-limited Groq Whisper transcription and microphone cleanup.
- Added mocked voice lifecycle and API security tests; real microphone and live Whisper calls remain unverified.

## Phase 7 — resume and PDF

- Added owner-checked PDF report downloads; default PDF fonts have limited Unicode support.
- Added text-based PDF resume upload, deletion, AI coaching and optional resume context for interviews. Extraction uses a resource-bounded subprocess; live provider analysis is unverified.

## Phase 8 — in progress

- Added explicitly consented local MediaPipe face-framing and iris-position observations, with opt-in aggregate sharing and deletion.
- Added migrations 0003–0004, coarse local pose/wrist observations and non-diagnostic suggestions in online and PDF reports. Full gesture classification and real-camera testing remain pending.
