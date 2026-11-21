# Deployment (planned, not yet verified)

1. Create a Neon project at https://console.neon.tech/ and obtain a pooled connection URL. Back up data before running migrations. Configure `DATABASE_URL` privately on Render and run `npm run db:migrate` in a release/deploy step that can access the database.
2. Create a Render web service connected to this repository. Use Node 20, build `npm ci && npm run build -w api`, start `npm run start -w api`, and set health path `/api/health`. Add production environment variables including `NODE_ENV`, pooled `DATABASE_URL`, a unique 32+ character `JWT_SECRET`, and the exact Vercel frontend origin in `CLIENT_URL`. Add AI keys privately only when the providers exist.
3. Create a Vercel project for `apps/web`. Use the Vite build and `dist` output. A production API URL/proxy, CORS and cross-site cookie settings still need implementation and end-to-end testing before frontend deployment is usable.
4. Check migrations, login, interview flows and browser privacy manually before declaring the project deployed. Free tiers, cold-start behavior and availability can change. `/api/health` is a liveness check, not a database readiness check.

No deployment has been performed. Deployment configuration and frontend-to-API authentication are not complete.
