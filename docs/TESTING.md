# Testing

From the repository root run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

The current Vitest/Supertest tests cover configuration validation, Neon pooled URL checks, event delivery/unsubscribe, the health response, unknown routes, CORS and malformed JSON. Supertest exercises registration, login, logout, profile updates, invalid input, duplicate users, forged cookies and cross-origin writes using an in-memory user repository. AI unit tests cover fallback order, timeout, circuit reopening, JSON repair, scoped caching, interruption handling, usage records and mocked Groq HTTP/SSE parsing. Supertest covers an authenticated two-question interview, streamed events, duplicate submissions, completion, validation and ownership with fake persistence and AI. An isolated PGlite PostgreSQL engine applies all migrations and tests the real Drizzle repositories; this is not a Neon network test. The user reported a successful manual Neon/Groq interview smoke check. The user indicated the Neon migration was run locally; this sandbox could not independently verify it. CI now targets Node 22; earlier checks also ran on Node 20.20.2 before it reached end of life.

The Phase 1 dependency update was checked with `npm audit`: zero production findings and four moderate development-only findings in Drizzle Kit’s esbuild loader chain at the time of testing. Do not expose developer tooling to the public internet; keep dependencies under review.

Round and evaluator tests cover factory registration, rubrics, schema-validated AI scoring, optional speech coaching and duplicate metric detection. The separate interview integration tests exercise the API with fake dependencies.

## Optional Neon + Groq smoke check

After applying the latest migration, configuring `DATABASE_URL`, `JWT_SECRET` and `GROQ_API_KEY` in `apps/api/.env`, run `npm run smoke:groq -w api`. It creates a randomly named temporary account and one interview, uses the real Groq API, and attempts to delete the temporary user and owned interview data afterward. AI usage metadata remains in `ai_usage_logs`; if cleanup fails, the command reports it and the temporary user must be removed manually. This test requires network access and free-tier availability and has not been run in this sandbox. Never paste credentials in chat.

## Groq diagnostic

If the smoke check reports an incomplete stream, run `npm run diagnose:groq -w api`. It makes two short real Groq requests (non-streaming and streaming) using the configured reasoning model and prints only success, safe HTTP status, timeout or a generic error. It never prints the key, prompt or model output. Requests count against the free-tier quota. The smoke check also identifies which interview stage failed without displaying provider output. The sandbox cannot run live Groq checks; the user must run this locally.

Groq's older Llama model IDs were shut down on its free/developer tiers. The diagnostic and provider now use `openai/gpt-oss-120b` for reasoning and `openai/gpt-oss-20b` for quick tasks. Mocked tests verify the selected model IDs; the user reported the live smoke test passed after this change. Check Groq account limits and pricing before running network requests.

Phase 4 uses an isolated PGlite database and fake AI to test completion-triggered reporting, failed generation and retry, cross-user isolation, report idempotence and dashboard statistics. These tests do not prove live provider report quality or multi-instance job durability.

Phase 5 frontend tests exercise registration, protected-route redirects, setup, streamed answer submission, partial JSON display, CRLF chunk boundaries, streaming errors and interrupted responses. Run `npm test -w web`. These are mocked browser-component tests, not a full live browser/Neon/Groq test. Manually check desktop and mobile layout, account creation, session resume, answer feedback, reports and logout with your local configuration.

Phase 6 tests mock browser recognition/recording lifecycle, explicit start, track cleanup and Groq upload, and exercise authenticated transcription, cross-user isolation, audio type/signature and size limits with PGlite. The Groq transport is mocked. Manual testing of device permissions, speech recognition, MediaRecorder formats and actual Whisper responses remains necessary.

Phase 7 tests check actual PDF text extraction, malformed/empty/large PDFs, page limits, user isolation, AI prompt boundaries, interview context and deletion, plus mocked browser consent and analysis. Report tests check PDF signature and ownership. Real AI analysis, real browser uploads, PDF layout and non-Latin rendering need manual verification; built-in report fonts have limited Unicode coverage.

Phase 8 in progress: mock camera tests cover explicit consent/start/stop, track cleanup, sampling, local face/pose aggregation, pose failure fallback and separately requested aggregate sharing; PGlite tests cover the migration, user isolation, strict counter validation, deletion and PDF inclusion/removal. The user reported completing the camera/report test instructions without detailed results; tracking accuracy and accessibility remain unverified.

Mock-test tests use PGlite and mocked browser requests to check ownership, answer secrecy before submission, validation, scoring, deletion, setup and feedback. Migration 0005 and the full real browser flow are not independently verified on Neon.

Contact page and mobile navigation have component tests for provided links, public access and menu behavior. Visual layout across actual devices and full deployed Vercel/API authentication remain unverified.

Question-feedback tests cover owner/question isolation, validation, save/update/delete, post-completion use, cascade deletion, and mocked UI editing and report access. Migration 0006 has been tested in PGlite, not yet on Neon; the real browser workflow remains unverified.

Account deletion tests use PGlite to verify password checks, origin and owner protection, cascading related records and rejection of copied cookies after deletion. A mocked component test verifies confirmation, errors and client-state cleanup. Live Neon, backups and provider retention have not been verified.

## Session revocation

PGlite/Supertest applies migration 0007 and checks copied-cookie and other-session revocation, account isolation, fresh login, concurrent/stale/expired/forged and anonymous logout, origin protection, legacy token rejection and a simulated repository failure. It does not test live Neon or browser behavior; check those separately. Revocation does not cancel requests already authenticated and in flight.

## Vercel API adaptation

The Vercel CLI 66.6.0 local production build was exercised with `NODEJS_HELPERS=0`: it produced a Node 22 function, API rewrites, and traced the PDF script, worker and fonts. Its built Express handler passed local health, nested-route and malformed-JSON checks; PDF extraction passed after materializing the build's traced file mappings. PGlite tests also exercise request-bound report generation and retry. These checks do not exercise Vercel's live edge routing, helper settings, streaming, database connection, function packaging or browser cookies; test those after deploying. `npm audit --omit=dev` reported no vulnerabilities; the full audit reported four moderate development-tool dependency advisories.
