# Phase 2: AI layer

## Goal

Build an exchangeable free-tier AI layer that can be tested without credentials.

## What was built

Provider interface and adapters for Groq, Gemini and OpenRouter; ordered router with timeouts, one retry per provider and per-provider circuit breakers; streamed provider text; a prompt builder; Zod-validated JSON and one repair attempt; a scoped in-memory LRU decorator; metadata-only usage writes; and a deterministic fake provider. No public AI endpoint or interview UI is implemented in this phase.

## Files created/changed

- `apps/api/src/ai/types.ts`: provider, request, response and usage contracts.
- `apps/api/src/ai/providers/`: Groq, Gemini, OpenRouter, shared HTTP/SSE parsing and fake strategies.
- `apps/api/src/ai/llm-router.ts`: ordered retry, timeout, fallback and circuit breaker.
- `apps/api/src/ai/json-generator.ts`: schema validation and a single repair attempt.
- `apps/api/src/ai/cache/cached-provider.ts`: opt-in, user-scoped bounded LRU decorator.
- `apps/api/src/ai/usage-repository.ts`: Drizzle usage metadata writes.
- `apps/api/src/domain/prompts/prompt-builder.ts`: structured prompts and repair prompts.
- `apps/api/src/container.ts`: provider registration, configured order, usage sink and composition.
- `apps/api/tests/ai.test.ts`: routing, timeout, circuit, repair, cache, streaming, usage and HTTP adapter tests.
- `README.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/SETUP.md`, `docs/PROGRESS.md`, `docs/CHANGELOG.md`, `docs/INDEX.md`: document actual behavior and limitations.

## Key concepts and OOP patterns used (and why)

Strategy isolates vendor implementations. The router uses a chain of responsibility. The cache wraps a provider with Decorator. PromptBuilder centralizes instructions, and the repository interface isolates usage persistence. The composition root handles dependency injection.

## Design decisions and trade-offs

Gemini uses `gemini-2.5-flash`; Groq uses 70B for reasoning and 8B for quick tasks; OpenRouter uses an explicit `:free` model. Provider availability and quotas may change. A failed stream is retried or falls back only before any content is emitted; switching providers mid-answer would corrupt the output. Circuit state and cache are process-local. Cache is off unless a caller provides a safe per-user cache scope; callers should not cache sensitive inputs without a deliberate retention decision. Metadata logging is best effort and does not block generation. Prompt boundaries reduce risk but do not guarantee immunity to prompt injection.

## How to run and test it

Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Tests use fake providers and mocked HTTP and do not require keys. To configure later real-provider use, put keys in `apps/api/.env` as described in [SETUP.md](../SETUP.md); never commit them or paste them in chat. There is no public AI endpoint yet.

## Problems faced and how they were fixed

The sandbox cannot reach the AI vendors; unit tests use deterministic fakes and mock HTTP responses instead. Live provider compatibility, model availability, quotas, streaming and latency therefore remain unverified. Stream retry after output was prohibited to prevent duplicate or conflicting text.

## What is next

Implement interview rounds, authenticated interview persistence, SSE endpoints and evaluation on top of these abstractions. Add real-provider checks when keys and network access are available.
