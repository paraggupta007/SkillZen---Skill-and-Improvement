# Deployment: Vercel frontend and API + Neon

The Vercel project serves the Vite frontend and one Node function wrapping the Express API at the **same origin**. PostgreSQL (for example Neon) is still required. No separate Render service is required. This setup has been built locally with the Vercel CLI, but has not been verified on a live Vercel deployment.

## 1. Database

Back up the target database. Apply migrations through `0007_romantic_echo.sql` from a trusted machine, using the same pooled Neon `DATABASE_URL` that will be configured in Vercel. Do not share the connection string. From the repository root:

```bash
npm ci --include=dev
npm run db:migrate
```

The migration command loads `apps/api/.env`. If the shell has an empty `DATABASE_URL` it overrides the file; use `env -u DATABASE_URL npm run db:migrate` to use the file. If `NODE_ENV=production` locally, a valid `JWT_SECRET` is also required. Migration 0007 invalidates old sessions; users must sign in again. The user reported migration steps completed, but Neon state has not been independently verified.

## 2. Project settings

Connect this repository and the desired deployment branch. For the existing Vercel project set:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Root Directory | `apps/web` |
| Include files outside Root Directory | Enabled |
| Node.js version | 22.x |
| Install Command | `cd ../.. && npm ci --include=dev` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

The Vercel CLI should be linked to this project from the repository root. For Git deployments, ensure the production branch is the intended branch; a different branch may deploy a different app. For CLI deployments, the source comes from the current local folder, including uncommitted changes.

## 3. Production environment variables

In Vercel project settings → Environment Variables, configure these for **Production**, then rebuild/redeploy. Do not commit or share secrets.

| Variable | Value |
| --- | --- |
| `NODEJS_HELPERS` | `0` — **required at build time**; Express parses JSON and raw PDF/audio itself. |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | The same pooled Neon PostgreSQL URL that was migrated; secret. |
| `JWT_SECRET` | A random secret of at least 32 characters; secret. Changing it invalidates existing sessions. |
| `CLIENT_URL` | The exact stable frontend origin, e.g. `https://skill-zen-skill-and-improvement-vnj.vercel.app`, without a trailing slash. |
| `GROQ_API_KEY` | Private Groq key for AI interviews/reports and transcription. |
| `VITE_API_URL` | `/api` (or remove the variable entirely). It is public build configuration, not a secret. Remove any old external API URL. |

Generate a new JWT secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and paste it only into Vercel. Preview URLs have different origins and need separate `CLIENT_URL` and test database/secrets; don't point them at production data. Never put database credentials, JWT secrets or provider keys into `VITE_` variables.

After configuring variables and linking the right project:

```bash
cd ~/Desktop/SkillZen-full
git pull
vercel --prod
```

Ensure local changes are understood before pulling. `vercel --prod` publishes the selected project's production deployment. If old API instances are also serving the database, replace them: older versions may not enforce session revocation.

## 4. Verify and limitations

- Open `https://YOUR-FRONTEND/api/health`: expect JSON with `data.status` equal to `ok`, **not HTML**. Health checks liveness, not database/provider connectivity.
- Register/login with a disposable account; reload and open a protected page; sign out and check the session is gone. Sessions use same-origin cookies on this configuration. Test on phone, tablet, and desktop.
- Test a complete AI interview (including streaming), report, report PDF, mock test, resume upload and voice transcription. Test origin protection and isolation with a second account, and direct frontend route refresh. Use HTTPS for microphone/camera.
- Uploads are limited to 4 MiB to stay below Vercel's default 4.5 MB function request limit. Vercel may reject oversized requests before Express; actual plan and platform limits apply.
- The function has a 120-second configured maximum. Streamed AI responses and report generation can time out. On Vercel, report generation is awaited during the report request, not continued as a fire-and-forget task. Interrupted or failed requests can be retried; concurrent function instances can still duplicate AI calls. Reports are saved in PostgreSQL.
- Rate limits, caches and concurrency guards are **per instance**, not distributed. This is not a production-grade abuse-control mechanism; use a shared rate limiter and review security, costs, quotas, data retention and backups before public launch.
- Function packaging includes the PDF extraction script, PDF.js worker and fonts. Extraction, model loading and uploads must be checked live; the child process is resource-bounded, not an OS security sandbox. Vercel Function limits, region, pricing and Fluid compute settings may change.
- `/api/health` returns HTML: ensure the new code and `apps/web/vercel.json` were deployed and `VITE_API_URL` is `/api`. If the function crashes, inspect Vercel runtime logs without sharing secrets. Confirm `NODEJS_HELPERS=0` was present at build time and redeploy after changing it.

References: [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), [Node.js helpers configuration](https://vercel.com/docs/functions/runtimes/node-js/advanced-node-configuration), [Vercel function limits](https://vercel.com/docs/functions/limitations).
