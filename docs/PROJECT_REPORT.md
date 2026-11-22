# SkillZen project report (draft)

## Abstract

SkillZen is a web application for practicing interviews and multiple-choice tests. It combines AI-generated interview questions and answer evaluations with reports, mock-test explanations, optional voice tools, resume context and experimental local camera coaching. It is a practice aid, not a certification or a system for determining attention or cheating.

## Problem and objectives

Interview preparation often requires repeated practice and access to feedback. SkillZen aims to make practice more accessible by providing guided interview sessions, reviewable feedback and practice tests, while offering opt-in voice and visual tools. It is designed for phones, tablets and desktop browsers; visual verification on real devices is still needed.

## Implementation

- **Web client:** React, TypeScript and Vite, using React Router for navigation, TanStack Query for server state and Zustand for interview draft state.
- **API:** Node.js and Express, with authenticated REST endpoints and server-sent events for streamed interview content. Provisional stream text is not authoritative until the validated result arrives.
- **Data:** PostgreSQL with Drizzle ORM and migrations. Neon pooled connections are supported. Account-owned resources are protected by authorization checks.
- **AI:** provider adapters route requests through configured services. Providers receive interview and optionally resume/job-description text; availability, quality, quotas and pricing depend on those services.
- **Reports and mock tests:** completed interviews can produce a report and PDF. Curated multiple-choice practice tests are scored server-side and provide explanations after submission. Optional feedback on questions or test options is separate from scoring.
- **Voice and camera:** browser speech synthesis offers available English voices. Dictation and Groq transcription require explicit action and microphone access. Optional MediaPipe face/pose estimates run in the browser; video and landmarks are not uploaded. Saving aggregate camera counts requires a separate action.

See [architecture](ARCHITECTURE.md), [database](DATABASE.md), and [API](API.md) for implementation details.

## Testing and current results

Automated linting, type checking, API tests, mocked browser-component tests and builds have passed locally. PGlite exercises SQL migrations and real repositories without connecting to Neon. A local Vercel build and handler checks passed; a prior live health endpoint returned JSON. The user reported a Neon/Groq interview smoke test and working live voice and camera. These observations do not establish the current live commit or a complete production end-to-end test. See [testing](TESTING.md) and [progress](PROGRESS.md) for scope and pending checks.

## Limitations and future work

AI responses can be inaccurate; model service terms and quotas can change. Browser speech quality and privacy characteristics vary. Camera observations can be inaccurate due to lighting, camera positioning and individual differences, and cannot establish identity, emotion, attention, health, cheating or performance. Full gesture classification is not implemented. Report PDF fonts have limited Unicode coverage. Production verification, real-device accessibility and responsiveness, security review, backups and operational monitoring remain important before public launch. Phase 9 optional features have not been selected.

## Screenshots and evidence checklist

Capture your own current deployment's screenshots and test results after verification: landing page, signed-in dashboard, setup, interview and voice picker, optional camera consent/tips, report, mock-test review and account settings. Do not include credentials, private user data or invented results.

## Developer

Parag Gupta, B.Tech batch 2027, GL Bajaj Institute of Engineering and Technology. [LinkedIn](https://www.linkedin.com/in/parag-gupta-modinagar/) · [Email](mailto:paragpggupta@gmail.com).
