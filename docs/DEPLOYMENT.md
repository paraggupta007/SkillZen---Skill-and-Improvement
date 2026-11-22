# Deployment (planned, not yet verified)

1. Create a Neon project at https://console.neon.tech/ and obtain a pooled connection URL. Back up data before running migrations. Configure `DATABASE_URL` privately on Render and run `npm run db:migrate` in a release/deploy step that can access the database.
2. Create a Render web service connected to this repository. Use Node 20, build `npm ci && npm run build -w api`, start `npm run start -w api`, and set health path `/api/health`. Add production environment variables including `NODE_ENV`, pooled `DATABASE_URL`, a unique 32+ character `JWT_SECRET`, and the exact Vercel frontend origin in `CLIENT_URL`. Add AI keys privately only when the providers exist.
3. Create a Vercel project for `apps/web`. Use the Vite build and `dist` output. Set `VITE_API_URL` to the HTTPS backend base URL including `/api` (or configure a same-origin proxy). The SPA rewrite is in `apps/web/vercel.json`. CORS and cross-site cookie behavior need end-to-end verification; browsers may block third-party cookies, so a same-site proxy/custom domains may be necessary.
4. Check migrations, login, interview flows and browser privacy manually before declaring the project deployed. Free tiers, cold-start behavior and availability can change. `/api/health` is a liveness check, not a database readiness check.

No deployment has been performed. Production frontend-to-API authentication and hosting configuration have not been verified.

The API deployment must include `apps/api/scripts/extract-resume-pdf.mjs` alongside the compiled `dist` directory and allow Node child processes for resume extraction. Concurrency limits are per process; this is not a security sandbox. Verify process/memory limits on the chosen host.
