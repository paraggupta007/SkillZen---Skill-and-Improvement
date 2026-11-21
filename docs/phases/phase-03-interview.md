# Phase 3: Interview domain (in progress)

## Goal

Build extensible interview rounds and evaluations, then expose a complete authenticated interview flow.

## What was built

The first part adds an abstract interview round and technical, HR and behavioral strategies; a registry-based factory; a validated LLM answer evaluator; an optional rule-based speech evaluator; and a composite evaluator. Fake-model unit tests cover the strategies and composition. These classes are not yet connected to interview endpoints.

## Files created/changed

- `apps/api/src/domain/rounds/interview-round.ts`: round contract, context and common prompt flow.
- `apps/api/src/domain/rounds/technical-round.ts`, `hr-round.ts`, `behavioral-round.ts`: round-specific rubrics.
- `apps/api/src/domain/rounds/round-factory.ts`: registered round creation.
- `apps/api/src/domain/evaluation/evaluator.ts`: evaluator contracts and metric types.
- `apps/api/src/domain/evaluation/llm-answer-evaluator.ts`: validated AI answer scoring.
- `apps/api/src/domain/evaluation/speech-metrics-evaluator.ts`: optional rule-based speech coaching.
- `apps/api/src/domain/evaluation/composite-evaluator.ts`: combines independent evaluators.
- `apps/api/src/container.ts`: registers rounds and evaluator strategies.
- `apps/api/tests/domain.test.ts`: strategy, extension and evaluator tests.
- `README.md`, `docs/INDEX.md`, `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DATABASE.md`, `docs/PROGRESS.md`, `docs/TESTING.md`, `docs/CHANGELOG.md`: document implemented scope and remaining work.

## Key concepts and OOP patterns used (and why)

Round strategies share a template for prompt construction and specialize their rubric. The factory registers new round constructors without a switch statement. Evaluators implement one interface, and a composite combines their independent results. The service container injects dependencies.

## Design decisions and trade-offs

Scores are checked against a Zod schema before being returned by the LLM evaluator. Speech coaching is heuristic and optional; it makes no claims about personality or ability. Duplicate metric names are rejected to avoid silent overwrites. No speech recognition or persistence is implemented yet. Prompt-injection boundaries reduce risk but are not a security guarantee.

## How to run and test it

Run `npm run lint`, `npm run type-check`, `npm test` and `npm run build`. Tests use a fake LLM and do not need API keys. The round classes are internal only; there is no complete interview API to try yet.

## Problems faced and how they were fixed

The sandbox cannot reach live AI vendors, so this portion is tested with deterministic fake output. Real Groq and Neon-backed interview tests remain outstanding. No claims are made about end-to-end latency or a completed interview until the remaining work exists and is tested.

## What is next

Implement interview repositories, authenticated create/next-question/answer/complete endpoints, adaptive follow-ups, streaming, concurrency-safe persistence and end-to-end tests. Then manually verify a real Groq interview on a machine with vendor access.
