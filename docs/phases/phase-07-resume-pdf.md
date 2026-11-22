# Phase 7: Resume, job description and PDF

## Goal

Help candidates prepare using their experience and a job description, and export interview reports.

## What was built

Authenticated PDF resume upload, owner-scoped metadata and deletion, AI resume/JD coaching, optional resume context for interviews, and PDF report download. Resume text and JDs are treated as untrusted data in prompts. Analysis returns an approximate text-match estimate, never an actual ATS result or hiring decision.

## Files created/changed

- `apps/api/scripts/extract-resume-pdf.mjs`, `src/modules/resumes/`: bounded text extraction, repositories, service and routes.
- `apps/api/src/domain/prompts/resume-prompt.ts`: central prompt and untrusted-data boundary.
- `apps/api/src/modules/interviews/`, `container.ts`, `app.ts`: optional owned resume context and dependency wiring.
- `apps/api/src/modules/reports/pdf-renderer.ts`, report service/routes: owner-checked PDF export.
- `apps/web/src/pages/resumes.tsx`, `setup.tsx`, `report.tsx`, layout and API types: consent, upload, analysis, deletion, selection and PDF download.
- `apps/api/tests/resumes.test.ts`, `reports.test.ts`, `apps/web/tests/resumes.test.tsx`: PDF, security and browser interaction tests.
- README, API, database, architecture, progress, changelog, decisions, setup, deployment, testing and index docs.

## Key concepts and OOP patterns used (and why)

Repository interfaces scope persistence to the owner. An extractor interface isolates PDF parsing from business logic; a separate child limits resource usage. A renderer interface separates PDF generation. Constructor injection supports fakes. PromptBuilder centralizes safety boundaries, and Zod validates AI output.

## Design decisions and trade-offs

Only text-based PDFs up to 5 MB, ten pages and 20,000 extracted characters are accepted. Extraction runs in a Node child with a 128 MB V8 heap limit, a 15-second deadline and two concurrent jobs per process; this is not a full OS sandbox. Only extracted text is stored, until the user deletes it. Analysis or selecting a resume for interview sends its text to the configured AI provider; provider terms apply. Deletion clears the resume record and references, not previously generated questions or reports. Match scores are rough AI estimates. Report PDF built-in fonts have limited Unicode coverage and may not render non-Latin text correctly.

## How to run and test it

Start the app and open Resumes. Upload a text-based PDF after reading the privacy notice, optionally add a job description and analyze, or select the resume when starting an interview. Complete an interview and download its ready report. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Tests use PGlite, real local extraction and fake AI; live AI, browser uploads and PDF layouts still need manual verification.

## Problems faced and how they were fixed

PDF parsing processes untrusted files. Size, page, output, runtime, heap and concurrency limits reduce resource abuse; stronger process/container isolation is still appropriate for deployment. PDFs without selectable text are rejected rather than producing fabricated analysis.

## What is next

Add explicitly consented browser-only webcam coaching, then implement core mock tests and candidate feedback. Improve international PDF font support and verify the real-provider workflow before production.
