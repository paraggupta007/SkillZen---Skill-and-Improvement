# SkillZen viva questions and answers

1. **What is SkillZen?** A practice application for AI mock interviews and multiple-choice tests, with feedback and optional voice and camera tools.
2. **What is a monorepo?** A repository containing multiple related applications; here the React web client and Express API share one repository.
3. **Why TypeScript?** Static types help detect many errors during development and make interfaces easier to maintain.
4. **What is Drizzle?** A TypeScript ORM and migration toolkit used here with PostgreSQL.
5. **Why a pooled Neon connection?** Pooling helps manage database connections, especially when serverless instances scale.
6. **What is a repository?** A data-access abstraction that separates services from persistence details. SkillZen uses repository interfaces and Drizzle-backed implementations.
7. **What is the event bus?** A publisher/subscriber mechanism that decouples parts of the app. Its delivery is in-process, not durable.
8. **What does `/api/health` test?** Whether the API can respond; it does not prove database or AI provider connectivity.
9. **What is SSE?** Server-sent events stream data from the server to the browser. SkillZen treats streamed previews as provisional until a validated completion arrives.
10. **How is the voice selected?** The browser supplies English speech-synthesis voices. SkillZen prefers an available voice labelled natural or enhanced and allows the user to choose; quality and voice options vary by device.
11. **Does voice always stay on the device?** No. Browser speech services may use a network. Explicit Groq transcription sends recorded audio to the API and Groq.
12. **Why process camera video locally?** It reduces exposure of video and landmarks. Models download after starting; users can separately choose to save aggregate counts.
13. **Can camera estimates prove cheating or attention?** No. Face, iris and wrist estimates are imperfect and can be affected by lighting, camera position and individual differences.
14. **Is a second face always another person?** No. Detection may miss a person or mistake a photograph or screen for a face-like shape.
15. **Does optional question feedback affect scores?** No. Question and mock-option ratings/comments are stored separately from AI answer evaluations and scoring.
16. **Why use a same-origin API on Vercel?** It keeps the web client and API under the same origin and supports the configured cookie-based sessions without a separate API host.
17. **Are automated tests enough for public launch?** No. Mocked browser/provider tests and PGlite do not establish real-device, Neon, provider or complete live Vercel behavior; manual verification and security review are also needed.
18. **What happens on account deletion?** A password-confirmed action deletes app-owned database records. It does not erase backups, provider-held data, operational logs or downloaded files.
