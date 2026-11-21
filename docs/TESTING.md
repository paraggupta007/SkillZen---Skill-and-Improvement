# Testing

From the repository root run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

The current Vitest/Supertest tests cover configuration validation, Neon pooled URL checks, event delivery/unsubscribe, the health response, unknown routes, CORS and malformed JSON. Supertest exercises registration, login, logout, profile updates, invalid input, duplicate users, forged cookies and cross-origin writes using an in-memory user repository. There are no real-database, AI or interview integration tests yet. The user indicated the Neon migration was run locally; this sandbox could not independently verify it. CI runs these commands on Node 20. The initial sandbox used Node 22; the checks were also run using Node 20.20.2. CI targets Node 20.

The Phase 1 dependency update was checked with `npm audit`: zero production findings and four moderate development-only findings in Drizzle Kit’s esbuild loader chain at the time of testing. Do not expose developer tooling to the public internet; keep dependencies under review.
