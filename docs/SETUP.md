# Local setup

1. Install Node.js 20 LTS and npm, and open the repository folder in VS Code.
2. Run `npm install` in the root.
3. Copy `.env.example` to `apps/api/.env`. This file is ignored by Git; never share it or paste keys into chat.
4. For the database, create a free account and project at https://console.neon.tech/ . In the project connection details, enable **pooled connection** and copy the PostgreSQL URI into `DATABASE_URL` in `apps/api/.env`. The Neon hostname must contain `-pooler`. For local development a local PostgreSQL URI is also accepted.
5. Run `npm run db:migrate` from the repository root. The migration needs database access and cannot be verified without a configured database.
6. Run `npm run dev` from the root. Visit http://localhost:5173 and http://localhost:4000/api/health. Development can start without credentials, but database functionality cannot work without a database.
7. Run `npm run lint`, `npm run type-check`, `npm test` and `npm run build`.

## AI keys

Put these only in `apps/api/.env`, never browser variables or chat:

- `GROQ_API_KEY`: https://console.groq.com/keys
- `GEMINI_API_KEY`: https://aistudio.google.com/app/apikey
- `OPENROUTER_API_KEY`: https://openrouter.ai/settings/keys — select only free models.
- `JWT_SECRET` (required for auth): generate using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the output into `JWT_SECRET` in the file.

A configured provider is not proof that a model is currently free, available, or within quota; check provider terms and limits. Automated AI tests use fakes and do not require these keys. Real AI calls are not yet verified and no public interview endpoint exists.

## Interview API verification

Run `npm run db:migrate` after updating the project, because Phase 3 adds migration 0002. Set `JWT_SECRET` and `GROQ_API_KEY` in `apps/api/.env`, then optionally run `npm run smoke:groq -w api` on a network that can reach Neon and Groq. The check creates a temporary user and interview and attempts to delete them afterward; AI usage metadata remains. See [TESTING.md](TESTING.md). This has not yet been verified against live services.

If the Groq smoke check fails, `npm run diagnose:groq -w api` prints a credential-safe status for direct and streamed Groq requests; see [TESTING.md](TESTING.md). Never paste keys or `.env` contents into chat.

Completed interviews now schedule report generation. `GET /api/reports/:interviewId` returns pending, failed or ready; see [API.md](API.md). The smoke script intentionally disables its report subscriber so temporary-account cleanup cannot race a report job; it checks interviews, not report quality.

## Frontend MVP

Visit `http://localhost:5173`, create an account, choose an interview from the dashboard and answer the streamed questions. A completed interview opens its report; pending reports refresh every 20 seconds and failures can be retried. Return to the dashboard to see session history and available scores. Authentication requires a working database, a JWT secret and an AI provider for real questions. The API is proxied by Vite during local development; no browser-side AI credentials are needed. The browser workflow has automated mocked tests but has not yet been verified end to end against a live provider.

## Voice practice

Use **Dictate answer** in a browser supporting Web Speech, or **Record with Groq** in a browser supporting MediaRecorder. Both require a user click and microphone permission. Browser recognition may use a browser-vendor network service. Groq recording sends audio to the API and Groq; it needs the existing `GROQ_API_KEY` in `apps/api/.env`. Recording stops after two minutes and uploads on stop; the API limits audio to 5 MB. For unsupported browsers or permission errors, type instead. Neither real microphone capture nor live Groq Whisper has been verified yet.

A ready report includes a PDF download. The PDF uses built-in fonts with limited Unicode support. Resume upload and analysis are still under development.
