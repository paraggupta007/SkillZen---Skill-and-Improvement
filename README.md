# SkillZen – Skill and Improvement

SkillZen is a work-in-progress college project for practicing AI mock interviews and mock tests, and learning from actionable feedback. Its planned interview features include adaptive questions, voice, reports and privacy-conscious webcam-based body-language feedback. Webcam iris-position and pose estimates are imperfect; they are not retina scans, proof of attention, or evidence of cheating.

**Current status: interviews, voice, resume/JD coaching, PDF exports, optional local camera observations, basic multiple-choice mock tests candidate question feedback and account deletion are implemented.** Full gesture classification is not implemented. The user reported a successful Neon/Groq interview smoke check; live report generation, resume analysis, voice transcription, the full browser workflow and model accuracy remain unverified; the user reported completing the camera/report test instructions. Follow [progress](docs/PROGRESS.md) for the actual status.

## Run locally

Requires Node.js 22, npm and (for database features/migrations) PostgreSQL or a pooled Neon URL.

```bash
npm install
cp .env.example apps/api/.env
# Set DATABASE_URL and a 32+ character JWT_SECRET in apps/api/.env before using auth.
npm run db:migrate
npm run dev
```

Open http://localhost:5173 and http://localhost:4000/api/health. The development scaffold can start without credentials; health checks the API process, not database connectivity. Never commit `.env` files or put keys in chat. On Windows, copy the example file using Explorer or `Copy-Item .env.example apps/api/.env` in PowerShell.

## Contact developer

Parag Gupta · B.Tech, batch 2027 · GL Bajaj Institute of Engineering and Technology

[Email](mailto:paragpggupta@gmail.com) · [LinkedIn](https://www.linkedin.com/in/parag-gupta-modinagar/)

## Deployment

The frontend and Express API have a same-origin Vercel configuration and require PostgreSQL such as Neon. See [deployment instructions](docs/DEPLOYMENT.md). The Vercel API configuration has not yet been verified live.

## Documentation

Start with [documentation index](docs/INDEX.md), [local setup](docs/SETUP.md), [architecture](docs/ARCHITECTURE.md), and [phase 0](docs/phases/phase-00-foundation.md). The full implementation and extension examples will be documented as the relevant features are built.

## How to extend (implemented so far)

- **AI provider:** implement `ILLMProvider` (including `generate`, `stream`, and `isHealthy`), import it in `apps/api/src/container.ts`, and add one instance to the `registered` list. Add its name to `LLM_PROVIDER_ORDER`. It must use a free model and keep its credentials server-side.
- **New round:** add a class extending `InterviewRound`, import it in `apps/api/src/container.ts`, and register it with `rounds.register("type", YourRound)`. The type must be accepted by the interview creation input.
- **New evaluator:** implement `IEvaluator`, import it in the container, and add one instance to the `CompositeEvaluator` list. Use unique metric names. The composite runs it for each answer.
- **Post-interview action:** subscribe a handler to `interview.completed` through the event bus; the interview flow publishes this event after completion; delivery is currently in-process and not durable.
