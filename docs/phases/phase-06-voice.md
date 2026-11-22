# Phase 6: Voice

## Goal

Allow users to practice speaking, hear questions aloud and optionally receive speech-coaching hints.

## What was built

Explicit Web Speech dictation, speech synthesis, and an opt-in MediaRecorder/Groq Whisper transcription path. The API authenticates and checks interview ownership, restricts audio containers and size, rate-limits requests and keeps the Groq key on the server. Browser recognition can provide approximate duration, word, filler and pause counts to the existing speech evaluator.

## Files created/changed

- `apps/web/src/hooks/use-speech.ts`, `use-recording.ts`: recognition, synthesis, recording and cleanup.
- `apps/web/src/pages/interview.tsx`, `style.css`: voice controls and privacy notices.
- `apps/api/src/modules/speech/`: transcription provider interface, Groq adapter and owner-checked route.
- `apps/api/src/app.ts`, `container.ts`: route and dependency wiring.
- `apps/api/tests/speech.test.ts`, `apps/web/tests/speech.test.tsx`, `recording.test.tsx`: mocked provider, browser lifecycle and security tests.
- README and API, database, architecture, progress, changelog, decisions, setup, testing and index docs.

## Key concepts and OOP patterns used (and why)

An `ITranscriber` interface allows the Groq adapter to be replaced and tested independently. Constructor injection protects the service boundary. UI hooks encapsulate browser resource lifecycles; the existing composite evaluator adds optional coaching without changing answer scoring.

## Design decisions and trade-offs

Microphone capture only starts after user action. Browser speech recognition may send audio to a browser-vendor service. The distinct Groq recording control discloses that audio will be uploaded on stop, including its automatic two-minute stop. Application audio is memory-only and is not persisted, but Groq's terms and retention apply. Server uploads are capped at 5 MB; signature checks are not full media validation. Word count, filler count and pauses are approximate English heuristics, not diagnoses; speech metrics are omitted when text is edited or combined with existing text. No metrics are fabricated for Groq transcription. Actual browser support and transcription quality vary.

## How to run and test it

Configure the existing server-side Groq key for the optional recording path. Start the app, open an interview and use the voice controls; typing remains available. Run `npm run lint`, `npm run type-check`, `npm test` and `npm run build`. Tests use browser and provider fakes and PGlite. Check microphone permission, recording formats and real Groq transcription manually in a supported browser.

## Problems faced and how they were fixed

Web Speech is not universally supported, so a separately consented upload path and typed answers remain available. Audio and microphone tracks are cleaned up on navigation; interrupted recordings are discarded. The request is bounded, ownership checked, and provider failure messages are sanitized.

## What is next

Resume and job-description analysis and PDF reports, followed by consent-based browser-only webcam feedback, mock tests and candidate feedback. Live voice and full browser verification are still outstanding.
