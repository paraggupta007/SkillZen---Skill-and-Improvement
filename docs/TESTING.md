# Testing

From the repository root run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

The current Vitest/Supertest tests cover configuration validation, Neon pooled URL checks, event delivery/unsubscribe, the health response, unknown routes, CORS and malformed JSON. Supertest exercises registration, login, logout, profile updates, invalid input, duplicate users, forged cookies and cross-origin writes using an in-memory user repository. AI unit tests cover fallback order, timeout, circuit reopening, JSON repair, scoped caching, interruption handling, usage records and mocked Groq HTTP/SSE parsing. Supertest covers an authenticated two-question interview, streamed events, duplicate submissions, completion, validation and ownership with fake persistence and AI. An isolated PGlite PostgreSQL engine applies all migrations and tests the real Drizzle repositories; this is not a Neon network test. The user reported a successful manual Neon/Groq interview smoke check. The user indicated the Neon migration was run locally; this sandbox could not independently verify it. CI runs these commands on Node 20. The initial sandbox used Node 22; the checks were also run using Node 20.20.2. CI targets Node 20.

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
