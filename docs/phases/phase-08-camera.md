# Phase 8: Camera coaching (in progress)

## Goal

Offer optional, consent-based, browser-only visual coaching without recording or uploading video. Estimates must not be framed as medical retinal analysis, attention, identity or cheating detection.

## What was built

A user may explicitly start and stop local MediaPipe Face Landmarker analysis during an interview. It samples approximately five frames per second and shows coarse face-framing and iris-position counts. A separate explicit action can save aggregate counts for non-diagnostic suggestions on the online report; saved counts can be deleted. Camera use is optional and does not alter the interview score.

## Files created/changed

- `apps/web/src/vision/`: analyzer interface, cautious heuristics, counter aggregator and lazy-loaded MediaPipe adapter.
- `apps/web/src/components/camera-coaching.tsx`, interview and report pages: consent, start/stop, local observations, optional sharing and deletion.
- `apps/api/src/modules/camera/`, `domain/evaluation/camera-evaluator.ts`: scoped persistence, strict aggregate validation and framing suggestions.
- `apps/api/src/db/schema.ts`, migration `0003_tricky_lorna_dane.sql`: aggregate counts only.
- `apps/api/tests/camera.test.ts`, `apps/web/tests/camera.test.tsx`: isolated database and mocked camera tests.
- Project API, database, architecture, progress, setup, decisions, changelog, testing and index documentation.

## Key concepts and OOP patterns used (and why)

Interfaces isolate browser analyzers, landmark detection, storage and coaching evaluation. The aggregation step discards individual landmarks and never retains frames. Constructor injection allows repository and evaluator testing without a camera or live database.

## Design decisions and trade-offs

Video remains in the browser; only user-approved aggregate counters are uploaded. Model download from Google happens after the user opts in. The model and WASM can fail to load, and browser/lighting/glasses/position differences affect estimates. Counts are self-reported, not verified evidence. Framing and iris position do not establish attention, identity, emotion, retinal health or misconduct. No automated score or employment decision uses them. The online report includes optional observations; PDF reports currently do not.

## How to run and test it

Run `npm install`, then `npm run db:migrate` to apply migration 0003, and `npm run dev`. In an in-progress interview opt in, start the camera, then stop and optionally save counts. Delete saved counts from the interview or report. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Automated tests mock media and the model; real-device/browser accuracy and permissions have not been verified.

## Problems faced and how they were fixed

Camera and network permission are explicit; stopping, cancellation or navigation closes media tracks and model resources. The API rejects unexpected fields and inconsistent counts. Model assets are lazy-loaded and no images or landmarks are transmitted. Estimates are labeled as limited and optional.

## What is next

Implement the remaining gesture and body-posture analysis, consider adding optional observations to PDF, and manually test camera/model availability and behavior. Apply the migration on the user's local Neon database before testing saved metrics.
