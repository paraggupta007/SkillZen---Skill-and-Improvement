# Progress and roadmap

A checked box means the work is implemented and verified, not just planned.

- [x] Phase 0: Foundation — scaffold, tests and migrations; user indicated the local Neon migration was completed (output not provided).
- [x] Phase 1: Authentication and users — integration tests use an in-memory repository; real database flow still needs manual verification.
- [x] Phase 2: AI layer and fake-provider tests — real provider calls remain unverified.
- [x] Phase 3: Interview API, persistence, streaming and fake-provider tests; the user reported a successful Neon/Groq smoke check.
- [x] Phase 4: Reports, analytics and history — fake-provider/isolated PostgreSQL tests pass; live report generation not yet verified.
- [x] Phase 5: Frontend MVP — responsive authentication, setup, streamed interview, dashboard and reports; automated browser-component tests pass, live browser flow still needs verification.
- [x] Phase 6: Voice and speech metrics — browser dictation, read-aloud and opt-in Groq recording, tested with mocks; live microphones and Groq transcription remain unverified.
- [x] Phase 7: Resume, job description and PDF — fake-AI and PDF extraction tests pass; real provider/browser workflow unverified and report PDF fonts have limited Unicode coverage.
- [ ] Phase 8: Consent-based browser-only body-language estimates and reports — local face/iris and coarse pose/wrist observations, optional aggregate sharing and online/PDF reporting implemented; user reported completing migration and camera/report test instructions; detailed results and tracking accuracy not independently verified.
- [x] Mock tests: small fixed JavaScript/web multiple-choice banks, saved attempts, scoring and explanations; automated tests pass; migration 0005 and real browser flow remain to be verified on Neon.
- [x] Interview/question feedback: optional per-question ratings/comments with owner access, editing and deletion, separate from AI answer evaluations; PGlite and browser-component tests pass; Neon migration 0006 and real browser flow remain unverified.
- [ ] Phase 9: Optional advanced features (ask which features before starting).
- [ ] Phase 10: Hardening, deployment and final report — public contact page, favicon and responsive navigation added; Vercel frontend / separate Node API deployment documented but not deployed or end-to-end verified.

Real AI and deployment need user-supplied setup. The earlier Neon migration was reported complete by the user; the user confirmed migration 0002 was applied locally. This sandbox cannot independently verify Neon. Do not interpret webcam estimates as verified attention, retinal tracking, or cheating detection.
