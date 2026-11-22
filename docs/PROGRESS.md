# Progress and roadmap

A checked box means the feature is implemented and has automated coverage. It does not mean live deployment or every real-device workflow has been independently verified.

- [x] Phase 0: Foundation — scaffold, tests and migrations; user indicated the local Neon migration was completed (output not provided).
- [x] Phase 1: Authentication and users — integration tests use an in-memory repository; real database flow still needs manual verification.
- [x] Phase 2: AI layer and fake-provider tests — real provider calls remain unverified.
- [x] Phase 3: Interview API, persistence, streaming and fake-provider tests; the user reported a successful Neon/Groq smoke check.
- [x] Phase 4: Reports, analytics and history — fake-provider/isolated PostgreSQL tests pass; live report generation not yet verified.
- [x] Phase 5: Frontend MVP — responsive authentication, setup, streamed interview, dashboard and reports; automated browser-component tests pass, live browser flow still needs verification.
- [x] Phase 6: Voice and speech metrics — browser dictation, English voice selection for read-aloud and opt-in Groq recording, tested with mocks; the user reports live voice works, while real Groq transcription and voice quality have not been independently verified.
- [x] Phase 7: Resume, job description and PDF — fake-AI and PDF extraction tests pass; real provider/browser workflow unverified and report PDF fonts have limited Unicode coverage.
- [ ] Phase 8: Consent-based browser-only body-language estimates and reports — local face/iris and coarse pose/wrist observations, live tips, optional aggregate sharing and online/PDF reporting implemented; user reported completing migration and camera/report test instructions; detailed results and tracking accuracy not independently verified.
- [x] Mock tests: small fixed JavaScript/web multiple-choice banks, saved attempts, scoring and explanations; automated tests pass; the user reported completing migration instructions through 0006; mock-test browser flow remains unverified.
- [x] Interview/question feedback: optional per-question ratings/comments with owner access, editing and deletion, separate from AI answer evaluations; PGlite and browser-component tests pass; the user reported completing migration and feedback test instructions; detailed results and Neon state were not independently verified.
- [ ] Phase 9: Optional advanced features (ask which features before starting).
- [ ] Phase 10: Hardening, deployment and final report — public contact page, favicon, responsive navigation and password-confirmed account deletion added; The full frontend and a JSON same-origin `/api/health` response were observed on Vercel. The current deployed commit, Neon migrations and complete workflows still need verification.

Real AI and deployment need user-supplied setup. The earlier Neon migration was reported complete by the user; the user confirmed migration 0002 was applied locally. This sandbox cannot independently verify Neon. Do not interpret webcam estimates as verified attention, retinal tracking, or cheating detection.

## Session revocation hardening

Implemented database-backed, all-device logout and user-facing sign-out disclosure. Migration 0007 is required before starting the updated API; existing cookies will be rejected. PGlite and automated tests cover revocation and stale-token behavior, but Neon and real-browser deployment remain unverified. Already-authenticated in-flight requests may finish.

## Mock option feedback and shared limits

Implemented owner-only feedback on individual options after a mock test is submitted, plus PostgreSQL-backed production rate limits. Migrations 0008–0009 are tested in PGlite but have not been run on the user's Neon database by this workspace. Live Vercel/browser/provider workflows and public-launch security remain unverified.
