# Phase 3: Interview domain and API (pending live verification)

## Goal

Build extensible interview rounds, answer evaluation and an authenticated interview API.

## What was built

Technical, HR and behavioral rounds; registry-based factory; validated LLM and optional rule-based speech evaluators; interview creation, history, detail, streamed questions and answer evaluations, follow-up links, and idempotent completion. Evaluation and best-effort next-question prefetch run concurrently. The frontend is not built yet.

## Files created/changed

- `apps/api/src/domain/rounds/*`: round contract, question/evaluation prompts, three strategies and factory.
- `apps/api/src/domain/evaluation/*`: evaluator contracts, validated answer scores, optional speech coaching and composite.
- `apps/api/src/modules/interviews/interview-repository.ts`: repository interface and interview types.
- `apps/api/src/modules/interviews/drizzle-interview-repository.ts`: PostgreSQL persistence, transactions and per-interview row locks.
- `apps/api/src/modules/interviews/interview-service.ts`: ownership, question and answer flows, parallel prefetch and completion events.
- `apps/api/src/modules/interviews/routes.ts`: authenticated, validated HTTP and SSE routes.
- `apps/api/src/ai/json-generator.ts`: provisional streaming plus validated final JSON and repair.
- `apps/api/src/app.ts`, `container.ts`: routes, cross-origin protection and dependency registrations.
- `apps/api/src/db/schema.ts`, `migrations/0002*`, migration metadata: role and uniqueness constraints.
- `apps/api/tests/interview.test.ts`, `domain.test.ts`, `ai.test.ts`: fake-provider interview and domain tests.
- `apps/api/tests/postgres.test.ts`: isolated PGlite migration and actual Drizzle repository test.
- `apps/api/scripts/smoke-groq.ts`, `scripts/diagnose-groq.ts`, `modules/users/drizzle-user-repository.ts`: optional live Neon/Groq check and safe provider diagnostics with restricted test-user cleanup.
- `apps/api/src/ai/providers/http-utils.ts`: handles SSE CRLF separators split between network chunks.
- `apps/api/package.json`, `tsconfig.json`, root lockfile: test dependency and smoke command.
- `README.md`, `docs/API.md`, `DATABASE.md`, `ARCHITECTURE.md`, `SETUP.md`, `TESTING.md`, `PROGRESS.md`, `CHANGELOG.md`: document current implementation and outstanding verification.

## Key concepts and OOP patterns used (and why)

Round strategies share a prompt-building template and specialize their rubric. The factory registers constructors without a switch statement. Evaluators implement one interface, and a composite combines independent results. Services depend on repository interfaces; the container injects implementations. The observer bus publishes completion events.

## Design decisions and trade-offs

Scores are checked before persistence. Row locks and unique indexes guard duplicate question/answer writes; the answer and its evaluation are saved atomically. The number of questions includes follow-ups. Prefetch starts after answer submission, not while the candidate is speaking, is process-local and may miss across instances. Raw SSE deltas are provisional untrusted model JSON; only the validated completion event is authoritative. Prompt boundaries reduce risk but cannot guarantee immunity to injection. The in-process event bus is not durable, and report generation is not yet implemented. Speech coaching is optional and heuristic.

## How to run and test it

Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Automated tests use fake AI and isolated PGlite; they do not require keys. After backing up the database, apply `npm run db:migrate` to Neon and follow [TESTING.md](../TESTING.md) for the optional real Groq/Neon smoke check. See [API.md](../API.md) for endpoint and SSE contracts.

## Problems faced and how they were fixed

The sandbox cannot reach Neon or live AI vendors. The user reported the Neon migration succeeded but the live Groq smoke check failed with a generic stream error; credential-safe diagnostics have been added. A later HTTP 404 is consistent with Groq retiring the original Llama model IDs on free/developer tiers; the provider now uses Groq’s GPT-OSS replacements. Live verification is still pending. A local PGlite engine tests actual SQL migrations and repository operations, while Supertest uses a fake AI provider and in-memory repository for the whole HTTP flow. Neither substitutes for live network verification. The optional smoke script creates a temporary user and interview and attempts cleanup, but usage logs remain and cleanup may require manual attention.

## What is next

Diagnose and verify a real Groq interview on the user's computer. Phase 3 is not complete until that manual check succeeds. Then implement reports and analytics, followed by the frontend.
