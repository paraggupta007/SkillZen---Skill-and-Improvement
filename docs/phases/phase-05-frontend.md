# Phase 5: Frontend MVP

## Goal

Provide a responsive browser experience for practicing interviews and viewing progress.

## What was built

A landing page, registration/login, protected workspace, dashboard, interview setup, streamed interview with per-answer feedback, a non-enforced two-minute timer, and a report with retry. Users can resume an unfinished interview and see real session counts, score trend and history. The dashboard chart loads separately to reduce initial bundle size.

## Files created/changed

- `apps/web/src/pages/`: landing, auth, dashboard, setup, interview and report screens.
- `apps/web/src/components/`: branding, layout, protected route and accessible UI states.
- `apps/web/src/services/`: typed API client, SSE parser, query hooks and data contracts.
- `apps/web/src/store/interview-store.ts`: current answer draft.
- `apps/web/src/main.tsx`, `style.css`, `vite-env.d.ts`: routes, styling and environment types.
- `apps/web/tests/`: mocked frontend interactions and streaming edge cases.
- `apps/web/.env.example`, `vercel.json`, package manifests and lockfile: deployment configuration and dependencies.
- `README.md`, `docs/ARCHITECTURE.md`, `PROGRESS.md`, `CHANGELOG.md`, `SETUP.md`, `TESTING.md`, `DECISIONS.md`, `DEPLOYMENT.md`, `INDEX.md`: frontend guidance and limitations.

## Key concepts and OOP patterns used (and why)

The frontend separates HTTP and stream transport from presentation, shares server state with TanStack Query, and uses a small Zustand store for a draft. Routes protect authenticated pages via the server-side session. The browser never receives AI credentials.

## Design decisions and trade-offs

SSE deltas are provisional JSON fragments and only the server's final validated event is authoritative. POST streaming uses fetch rather than EventSource. If a stream is interrupted after an answer is saved, refresh the session before retrying; a persisted answer is not submitted twice. Reports refresh every 20 seconds, leaving room below the report rate limit. Cross-site production cookies can be blocked by browser privacy settings; production setup is not yet validated. Voice, mock tests, webcam, PDF and profile editing remain planned.

## How to run and test it

Run the setup steps in `docs/SETUP.md`, then `npm run dev` and open `http://localhost:5173`. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Frontend component tests use mocked HTTP, not live Neon or AI; manually validate the complete browser flow with your own configured environment.

## Problems faced and how they were fixed

Native EventSource only supports GET, so a fetch stream parser handles GET and POST SSE, split CRLF and errors. Dashboard charts are dynamically loaded to keep the initial bundle smaller. Report polling was slowed to avoid exhausting the per-user rate limit.

## What is next

Add voice input and speech metrics, then resume/JD and PDF reports, followed by consent-based in-browser webcam feedback and the remaining core mock-test and candidate-feedback scope.
