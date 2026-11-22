# Deployment: Vercel frontend + Node API (not yet deployed)

Vercel serves the **frontend**; this repository's Express API is a long-running Node server and is not currently a Vercel serverless function. A separate Node host such as Render and a PostgreSQL database such as Neon are required for login, interviews, mock tests and reports. Do not expect the static Vercel deployment alone to provide those features. This plan has not been verified end-to-end or deployed from this workspace.

## 1. Prepare the database

Use a Neon pooled PostgreSQL connection URL and back up existing data. Apply all migrations through `0006_peaceful_shinobi_shaw.sql` **once** from a trusted machine or deployment job using the intended production `DATABASE_URL`:

```bash
npm ci --include=dev
npm run db:migrate
```

`apps/api/.env` is loaded when running locally, or set the variables privately in the deployment environment. If `NODE_ENV=production`, the migration command also requires the production `JWT_SECRET` to satisfy configuration validation. Never commit secrets or put them in `VITE_` variables. Do not share credentials in chat. The user reported completing migration instructions through 0006; this sandbox has not independently verified the Neon state. A health response does not verify database access.

## 2. Host the API on Render

Create a Node **Web Service** from this repository and select the desired deployment branch. Leave **Root Directory** at the repository root: both the root lockfile and shared TypeScript config are needed. Suggested settings:

| Setting | Value |
| --- | --- |
| Node version | `22` (`NODE_VERSION=22` in the service environment) |
| Build command | `npm ci --include=dev && npm run build -w api` |
| Start command | `npm run start -w api` |
| Health check path | `/api/health` |

Configure these **private Render environment variables**: `NODE_ENV=production`, pooled `DATABASE_URL`, a new random `JWT_SECRET` of at least 32 characters, and `CLIENT_URL` set to the exact frontend HTTPS origin (no trailing slash, e.g. `https://your-frontend.example.com`). Configure at least one AI provider key such as `GROQ_API_KEY` privately for interviews/reports, and Groq for transcription; keys must never be placed in frontend variables. An initial deployment can be created before the final `CLIENT_URL` is known, then update the variable and redeploy after setting up Vercel.

Run migrations against the target database before serving the new version. A pre-deploy job may be used if supported by the chosen hosting plan; otherwise run from a trusted machine with that production URL. Do not print the URL or credentials. The deployment must retain `apps/api/scripts/extract-resume-pdf.mjs` and allow Node child processes for PDF extraction. `/api/health` checks liveness only. Report jobs and rate-limit counters are process-local; multiple instances or restarts can duplicate or interrupt work. Free-tier limits, sleeping, model availability and provider costs can change.

## 3. Deploy the frontend to Vercel

Import the repository in Vercel, set the production branch to the branch you intend to deploy, then use:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root Directory | `apps/web` |
| Include files outside Root Directory in Build Step | Enabled (for the workspace lockfile and `tsconfig.base.json`) |
| Node version | 22.x |
| Install command | `cd ../.. && npm ci --include=dev` |
| Build command | `npm run build` |
| Output directory | `dist` |

Set Vercel's **build-time** environment variable `VITE_API_URL` to the API's public HTTPS base URL **including `/api`**, for example `https://your-api.example.com/api`. This is public configuration, not a secret. Redeploy after changing it. Without it, requests default to `/api` and the existing SPA rewrite will return the frontend instead of the API: authentication and other features will fail. The `apps/web/vercel.json` rewrite supports direct visits to client-side pages such as `/contact`; it is **not** an API proxy.

The API's `CLIENT_URL` must exactly match the address users open, including scheme and port if any. Preview URLs are different origins and will not work with the production backend unless a separate preview backend is configured with the matching origin. Avoid pointing previews at production data.

## 4. Cookies, HTTPS and public launch checks

A Vercel `*.vercel.app` frontend and Render `*.onrender.com` API are cross-site. Even though production cookies use `SameSite=None; Secure`, browsers may block them as third-party cookies, especially on mobile. **Recommended:** use HTTPS custom domains under the same registrable domain, e.g. `app.example.com` on Vercel and `api.example.com` on Render, set `CLIENT_URL` to the frontend origin and `VITE_API_URL` to the API URL. This still requires exact CORS settings and real-device verification; it is not a guarantee. A same-origin reverse proxy is another option, but is not configured in this repository and needs careful testing of streaming, cookies, uploads and timeouts. Do not expose a public launch as working until authentication succeeds in target browsers with default privacy settings.

After deployment, verify from mobile, tablet and desktop: direct `/contact` navigation and refresh; registration, login, logout and a protected page; a complete streamed interview and report/PDF; mock-test creation, submission and deletion; resume and voice uploads; explicit camera permission, model downloads, saving/deleting observations. Use HTTPS for camera/microphone. Test a second account for ownership isolation and check that no secrets appear in frontend assets or browser requests. Verify service logs, rate limits and provider quotas; never use real sensitive resumes or answers during initial tests. Test account deletion with a disposable account and verify backup/provider retention. Review privacy notices, account recovery, abuse controls, data retention, backups and security before offering this publicly: this is a work-in-progress project, not a production security audit.

## Troubleshooting

- A 200 HTML page instead of JSON from `/api`: check `VITE_API_URL` and redeploy Vercel; the frontend rewrite is catching the path.
- Login appears successful but protected requests return 401: inspect browser cookie/privacy policy, HTTPS and same-site domain setup. Ensure `CLIENT_URL` exactly matches the actual frontend origin.
- CORS/403 origin failures: check `CLIENT_URL`, including `https` and no path or trailing slash, then redeploy/restart the API. Each preview origin requires appropriate separate configuration.
- 503 from data features or migration errors: check database configuration and applied migrations privately. A healthy `/api/health` does not prove database connectivity.
- Interrupted streams or missing reports: check API host logs and provider availability; process-local report work can be lost on restarts and must be retried.

Reference: [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build), [Render monorepo support](https://render.com/docs/monorepo-support), [Render Node version](https://render.com/docs/node-version), [Node.js release status](https://nodejs.org/en/about/previous-releases), [Vercel supported Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
