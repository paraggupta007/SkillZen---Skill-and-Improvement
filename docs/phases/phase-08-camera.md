# Phase 8: Camera coaching (in progress)

## Goal

Offer optional, consent-based, browser-only visual coaching without recording or uploading video. Estimates are not evidence of attention, identity, emotion, cheating, medical conditions, communication skill or performance.

## What was built

During an in-progress interview, the user can explicitly start and stop local MediaPipe Face and Pose Landmarker analysis. Face samples run approximately five times per second and pose samples approximately once per second. Coarse measurements cover face framing, iris position, shoulder/hip center alignment, wrist movement and hands above shoulder height. Visibility and framing can make observations unavailable; unknown is not a negative result. Wrist movement is not gesture classification. A pose-model failure falls back to face-only observations.

A separate explicit action saves bounded aggregate counters for non-diagnostic suggestions on the online report and PDF; they do not affect the interview score. Saved counts can be deleted independently. PDF downloads retrieve the current saved counts, so a new PDF omits them after deletion; previously downloaded files cannot be recalled.

## Files created/changed

- `apps/web/src/vision/`: landmark adapters, conservative heuristics and aggregate counters.
- `apps/web/src/components/camera-coaching.tsx`, interview and report pages: consent, lifecycle, local observations and optional sharing/deletion.
- `apps/api/src/modules/camera/`, `domain/evaluation/camera-evaluator.ts`: owner-scoped persistence, strict aggregate validation and suggestions.
- `apps/api/src/modules/reports/`: separately saved observations in dynamically rendered PDF reports.
- `apps/api/src/db/schema.ts`, migrations `0003_tricky_lorna_dane.sql` and `0004_violet_the_leader.sql`: aggregate counts only.
- `apps/api/tests/camera.test.ts`, `reports.test.ts`, `apps/web/tests/camera.test.tsx`: database and mocked browser coverage.

## Design decisions and limitations

Video and landmarks remain in the browser; only explicitly approved aggregate counters are uploaded. The face and pose model downloads contact Google after start; WASM assets are served by the app. Model/network failures, lighting, clothing, glasses, positioning, occlusion and individual differences affect results. Counts are self-reported, not verified evidence. Framing, iris position, alignment and movement cannot establish attention, identity, emotion, retinal health, gesture quality, performance or misconduct. No automated score or employment decision uses them. Built-in PDF fonts have limited Unicode support.

## How to run and test it

Pull the latest branch, run `npm install`, then `npm run db:migrate` to apply migrations through 0004, and `npm run dev`. In an in-progress interview opt in, start the camera, then stop and optionally save counts. Delete saved counts from the interview or report. Run `npm run lint`, `npm run type-check`, `npm test`, and `npm run build`. Automated tests use mock camera/model APIs and isolated PGlite; live device permissions, browser/WASM and model downloads, tracking accuracy, PDF layout and the full real workflow still need manual verification. The user reported completing migration 0004 locally; its Neon state has not been independently verified.

## What is next

Manually validate the camera/model behavior and PDF, and address issues found. Phase 8 remains in progress until real-device validation.
