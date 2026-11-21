# SkillZen – Skill and Improvement

SkillZen is a work-in-progress college project for practicing AI mock interviews and mock tests, and learning from actionable feedback. Its planned interview features include adaptive questions, voice, reports and privacy-conscious webcam-based body-language feedback. Webcam gaze and facial-expression estimates are imperfect; they are not retina scans, proof of attention, or evidence of cheating.

**Current status: Phase 1 API authentication and profile foundation.** The interview, frontend authentication screens, mock test, AI and webcam features are not implemented yet. The user indicated that the initial database migration was run locally; the sandbox could not independently verify it. Follow [progress](docs/PROGRESS.md) for the actual status.

## Run locally

Requires Node.js 20, npm and (for database features/migrations) PostgreSQL or a pooled Neon URL.

```bash
npm install
cp .env.example apps/api/.env
# Set DATABASE_URL and a 32+ character JWT_SECRET in apps/api/.env before using auth.
npm run db:migrate
npm run dev
```

Open http://localhost:5173 and http://localhost:4000/api/health. The development scaffold can start without credentials; health checks the API process, not database connectivity. Never commit `.env` files or put keys in chat. On Windows, copy the example file using Explorer or `Copy-Item .env.example apps/api/.env` in PowerShell.

## Documentation

Start with [documentation index](docs/INDEX.md), [local setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), and [phase 0](docs/phases/phase-00-foundation.md). The full implementation and extension examples will be documented as the relevant features are built.
