# Local setup

1. Install Node.js 20 LTS and npm, and open the repository folder in VS Code.
2. Run `npm install` in the root.
3. Copy `.env.example` to `apps/api/.env`. This file is ignored by Git; never share it or paste keys into chat.
4. For the database, create a free account and project at https://console.neon.tech/ . In the project connection details, enable **pooled connection** and copy the PostgreSQL URI into `DATABASE_URL` in `apps/api/.env`. The Neon hostname must contain `-pooler`. For local development a local PostgreSQL URI is also accepted.
5. Run `npm run db:migrate` from the repository root. The migration needs database access and cannot be verified without a configured database.
6. Run `npm run dev` from the root. Visit http://localhost:5173 and http://localhost:4000/api/health. Development can start without credentials, but database functionality cannot work without a database.
7. Run `npm run lint`, `npm run type-check`, `npm test` and `npm run build`.

## Keys for later phases

These are not yet used by the scaffold. Put them only in `apps/api/.env`, never browser variables or chat:

- `GROQ_API_KEY`: https://console.groq.com/keys
- `GEMINI_API_KEY`: https://aistudio.google.com/app/apikey
- `OPENROUTER_API_KEY`: https://openrouter.ai/settings/keys — select only free models.
- `JWT_SECRET`: generate using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and put the output into `JWT_SECRET` in the file.

A configured provider is not proof that a model is currently free, available, or within quota; check provider terms and limits. Use test fakes for automated tests when the AI phase is implemented.
