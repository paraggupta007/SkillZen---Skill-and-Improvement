# Mock tests: initial implementation

## Goal and scope

Provide short multiple-choice practice independently of AI interviews. Two small curated banks cover JavaScript basics and web fundamentals. Users choose three or five questions, submit once, see a correctness count and explanations, revisit or delete attempts. The fixed bank repeats and is not a comprehensive skill assessment, secure exam, or hiring decision.

## Design and files

- `apps/api/src/modules/mock-tests/`: question bank, service, repository contract and authenticated routes. Correct options are omitted from API responses before submission, but the public code contains the bank, so answers are not exam secrets.
- `apps/api/src/db/schema.ts` and migration `0005_green_chimera.sql`: owner-scoped snapshot and submitted result. A conditional update guards against multiple or concurrent submissions.
- `apps/web/src/pages/mock-tests.tsx`, `main.tsx`, `components/layout.tsx`: setup, history, questions, results and deletion. Draft answers are kept only on the page and are lost on reload or navigation.
- `apps/api/tests/mock-tests.test.ts`, `apps/web/tests/mock-tests.test.tsx`: PGlite ownership, scoring and lifecycle tests and browser-component interaction with mocked requests.

## Run and verify

Pull the branch and run `npm install`, `npm run db:migrate`, and `npm run dev`. Open Mock tests, create an attempt, submit it, review explanations, reopen it from history and delete it. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Migration 0005 is tested with PGlite but has not been applied or verified on the user's Neon database; the real browser flow remains unverified.

## Next

Expand and review the question bank if needed. Separate candidate ratings/comments on interview questions are still planned; they are not part of mock-test answer explanations.
