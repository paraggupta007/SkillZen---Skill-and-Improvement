# SkillZen — Skill and Improvement

SkillZen is a work-in-progress practice platform for AI mock interviews and multiple-choice tests. It combines interview feedback, reports, voice practice, resume and job-description context, and optional camera coaching in a responsive web application.

> **Status:** These features are implemented and covered by automated tests, but a complete public-launch verification is still needed. The user reported a successful Neon/Groq interview smoke test and that voice and camera work live. The deployed `/api/health` returned JSON in a prior check; that proves liveness only. The current deployed commit, database migrations and complete production workflows have not been independently verified. See [Progress](docs/PROGRESS.md).

## Features

- **AI interview practice:** choose an interview, receive streamed questions, submit answers and review evaluations and reports. Streaming previews are provisional until validated.
- **Mock tests:** practice with small JavaScript and web-fundamentals question banks, review answers and explanations, and revisit or delete attempts.
- **Your feedback:** optionally rate interview questions and individual mock-test options. This feedback is separate from AI evaluations and scores.
- **Voice practice:** listen to questions using your browser's available English voices, dictate answers where supported, or explicitly record and send audio for Groq transcription. Voice availability and quality depend on the device and browser.
- **Resume and reports:** upload a text-based PDF resume, optionally provide a job description, and download completed interview reports as PDFs.
- **Optional camera coaching:** with consent, local face and pose models offer approximate live framing and movement tips. Video and landmarks stay in the browser; only aggregate counts are sent if you explicitly choose to save them. Estimates can be wrong and do **not** establish attention, cheating, identity, health or performance.
- **Accounts:** manage your profile, sign out across devices, and delete your account with password confirmation.

## Technology

React, TypeScript, Vite, React Router, TanStack Query and Zustand power the frontend. The backend uses Node.js, Express, Drizzle ORM and PostgreSQL (including pooled Neon). AI provider adapters support Groq, Gemini and OpenRouter. The app is configured for the frontend and API to run on Vercel with a same-origin `/api`.

## Getting started

Use Node.js 22 and npm. Database-backed features require PostgreSQL; for real AI interviews configure at least one supported provider.

```bash
npm ci --include=dev
cp .env.example apps/api/.env
# Edit apps/api/.env: set DATABASE_URL, JWT_SECRET and at least one AI provider key.
npm run db:migrate
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example apps/api/.env` instead of `cp`. Open [localhost:5173](http://localhost:5173); API liveness is at [localhost:4000/api/health](http://localhost:4000/api/health). Health does not verify the database or AI provider. The API loads `apps/api/.env`; an existing shell variable takes precedence. Never commit or share credentials. For details and prerequisites, see [Local setup](docs/SETUP.md).

## Tests

```bash
npm run lint
npm run type-check
npm test
npm run build
```

Tests cover API flows, database migrations and repositories with PGlite, and frontend components with mocked browser and network APIs. They do not substitute for real-device, live Neon, provider or Vercel testing. See [Testing](docs/TESTING.md).

## Deploy on Vercel

The [deployment guide](docs/DEPLOYMENT.md) covers the same-origin Vercel Function, Neon, environment variables, migration and production verification. Back up and confirm the target database before applying migrations through `0009`; don't deploy newer API code against an unmigrated database. Local environment files must not be uploaded or shared; see the guide's `.vercelignore` notes.

A previously observed public URL is [skill-zen-skill-and-improvement-vnj.vercel.app](https://skill-zen-skill-and-improvement-vnj.vercel.app/). The URL alone does not confirm that the latest branch changes have been deployed.

## Privacy and limitations

Browser speech recognition and some speech-synthesis voices may use services provided by the browser or operating system. Explicit Groq recording sends audio to the API and Groq; resume/JD and interview text may be sent to the configured AI provider. Camera models are downloaded from Google after camera start. Camera signals are experimental and may be affected by lighting, glasses, position and individual differences; multiple-face detection may mistake photos or screens for people. Full gesture classification is not implemented. Account deletion removes app-owned database records, not provider data, backups, logs or downloads.

## Documentation

See the [documentation index](docs/INDEX.md), [architecture](docs/ARCHITECTURE.md), [API](docs/API.md), [database](docs/DATABASE.md), [testing](docs/TESTING.md), and [progress and roadmap](docs/PROGRESS.md). Phase 9 advanced features are not yet selected.

## Extending the project

- **AI provider:** implement `ILLMProvider`, register it in `apps/api/src/container.ts`, and add its name to `LLM_PROVIDER_ORDER`. Keep credentials server-side and check provider terms and costs.
- **Interview round:** extend `InterviewRound`, register it with the round factory in the container, and update accepted creation inputs.
- **Evaluator:** implement `IEvaluator` and add it to `CompositeEvaluator` with unique metric names.
- **Post-interview action:** subscribe to `interview.completed`. Event delivery is in-process and not durable; on Vercel, report generation is handled within a report request.

## Developer

**Parag Gupta** · B.Tech, batch 2027 · GL Bajaj Institute of Engineering and Technology

[Email](mailto:paragpggupta@gmail.com) · [LinkedIn](https://www.linkedin.com/in/parag-gupta-modinagar/)
