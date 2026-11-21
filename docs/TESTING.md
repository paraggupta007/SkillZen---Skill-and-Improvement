# Testing

From the repository root run:

```bash
npm run lint
npm run type-check
npm test
npm run build
```

The current Vitest/Supertest tests cover configuration validation, Neon pooled URL checks, event delivery/unsubscribe, the health response, unknown routes, CORS and malformed JSON. There are no real database, authentication, AI or interview integration tests yet. The user indicated the Neon migration was run locally; this sandbox could not independently verify it. CI runs these commands on Node 20. The initial sandbox used Node 22; the checks were also run using Node 20.20.2. CI targets Node 20.
