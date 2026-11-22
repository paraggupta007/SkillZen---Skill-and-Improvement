# Phase 4: Reports and analytics

## Goal

Turn completed interviews into useful coaching reports and dashboard statistics.

## What was built

An `interview.completed` subscriber starts asynchronous report generation. Reports contain strengths, weaknesses, tips, a summary and a deterministic overall score. The API supports pending, ready, failed and explicit retry states. Analytics returns interview counts, average score and a recent score trend. Interview history was added in Phase 3.

## Files created/changed

- `apps/api/src/domain/prompts/report-prompt.ts`: builds the untrusted-data-safe report prompt.
- `apps/api/src/modules/reports/report-repository.ts`, `drizzle-report-repository.ts`: report persistence contract and idempotent database adapter.
- `apps/api/src/modules/reports/report-service.ts`, `routes.ts`: asynchronous report generation, status, retry and HTTP routes.
- `apps/api/src/modules/analytics/analytics-repository.ts`, `drizzle-analytics-repository.ts`: user-scoped aggregate data contract and SQL adapter.
- `apps/api/src/modules/analytics/analytics-service.ts`, `routes.ts`: dashboard use case and HTTP route.
- `apps/api/src/middleware/require-user.ts`: reusable cookie authentication for protected routes.
- `apps/api/src/modules/interviews/routes.ts`, `app.ts`, `container.ts`: authentication reuse, origin protection and event/route wiring.
- `apps/api/scripts/smoke-groq.ts`: avoids starting background reports during temporary-user cleanup.
- `apps/api/tests/reports.test.ts`: fake-AI/PGlite API tests for generation, failure, retry, idempotence and ownership.
- `README.md`, `docs/API.md`, `DATABASE.md`, `ARCHITECTURE.md`, `PROGRESS.md`, `CHANGELOG.md`, `SETUP.md`, `TESTING.md`, `INDEX.md`: describe the phase and its limitations.

## Key concepts and OOP patterns used (and why)

Observer decouples completion from report generation. Repository interfaces isolate storage and queries. Constructor injection makes the services testable with independent implementations. PromptBuilder centralizes untrusted-data boundaries. A unique database index makes report persistence idempotent.

## Design decisions and trade-offs

The overall score is the rounded mean of per-answer overall scores, not an independently invented AI number. To bound token usage, the report prompt includes at most the latest ten truncated turns; the score still uses all answers. Status is process-local and reports are stored in PostgreSQL. If a process restarts before saving, the next report read can schedule generation again. This is not a durable queue: multiple instances may duplicate AI work, and a report is not generated until a missing report is requested after a lost event. Live report quality and latency are not yet tested.

## How to run and test it

Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Tests use fake AI with an isolated PGlite PostgreSQL engine. Complete an interview, then poll `GET /api/reports/:interviewId`; use `POST /api/reports/:interviewId/retry` on failure. Query `GET /api/analytics/summary` for dashboard data. See [API.md](../API.md) for envelopes and errors.

## Problems faced and how they were fixed

A completion event can be lost on restart because the event bus is in process. Missing reports are scheduled when requested and failed jobs have an explicit retry route; a durable queue/outbox is still required for stronger guarantees. The existing manual smoke check cleans up its temporary account, so its report subscriber is disabled to prevent an asynchronous cleanup race.

## What is next

Build the responsive React frontend with authentication, dashboard, interview setup, streaming interview and report screens. Later, add durable job recovery and manually check report quality with a live provider.
