# Local setup

1. Install Node.js 22 LTS and npm, and open the repository folder in VS Code.
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

A ready report includes a PDF download. The PDF uses built-in fonts with limited Unicode support. In the Resumes section, upload a text-based PDF (5 MB, 10 pages maximum); extracted text is stored until deletion. You may analyze it with an optional job description or select it for a new interview. Both operations send text to the configured AI provider. Deleting the resume does not remove interview content derived from it. Scanned PDFs are not supported.

## Camera coaching (in progress)

After pulling the Phase 8 changes, run `npm install` and `npm run db:migrate` to apply migrations through 0004. During an in-progress interview, camera use is optional: check the consent box and click Start camera, grant browser permission, and use Stop when finished. The official face and pose models are downloaded from Google after starting; WebAssembly assets are served by the app. Video remains in the browser. A separate save action sends only aggregate counters for online and PDF reports; saved counters can be deleted. No retinal, attention or cheating conclusion is supported. Coarse pose and wrist observations are estimates, not gesture classification; a real-device check remains pending.

## Mock tests

After pulling, run `npm install` and `npm run db:migrate` to apply migration 0005. Under Mock tests, select JavaScript basics or Web fundamentals and 3 or 5 questions. Draft selections are not saved until submission. Review the score and explanations, revisit an attempt from history, or delete it. The small fixed bank may repeat questions and is not a secure examination.

## Feedback on interview questions

Apply migrations through 0006. Open “Rate this question” during an interview, or open a question in the report’s feedback section. A 1–5 rating is required; a comment is optional. You can edit or delete feedback. It is stored in your account, not sent to the AI or used in scoring. Avoid adding sensitive information.

## Account deletion

In Account settings, enter your current password, type `DELETE` and check the confirmation box to permanently delete your account and app-owned database records. There is no recovery. Provider data, backups, operational logs and files already downloaded are not removed. Test with a disposable account, not your main account.
