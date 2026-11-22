# Decision log

## Product name and scope

- Context: the original specification uses PrepPilot; the owner chose SkillZen and requested mock tests and feedback on interview questions/options.
- Options: preserve old name or use the owner's name.
- Choice: SkillZen. Add mock tests and candidate feedback to the roadmap; do not pretend they exist yet.
- Why: it matches the current project goal.

## Database

- Context: free Neon with limited connections.
- Options: direct connection per request, or a shared pool and pooled Neon endpoint.
- Choice: shared `pg` pool and Drizzle migrations; allow local PostgreSQL for development.
- Why: controlled connection usage and repeatable schema changes. Neon migration has not yet been verified.

## Webcam privacy and limitations

- Context: user requested gesture and eye/retina proctoring.
- Options: upload video or compute approximate metrics in-browser.
- Choice: consent-based in-browser analysis is planned; only aggregate metrics may be sent, never video.
- Why: privacy and the project specification. Camera-based gaze is approximate and cannot establish cheating, attention, identity, or medical retinal state. Feedback must be presented as coaching, not a disciplinary verdict.

## Health and configuration

- Context: local frontend work should not require credentials.
- Choice: health reports process availability without probing the DB; production requires a database URL and a strong JWT secret.
- Why: liveness stays fast, while production cannot silently run without essential configuration.

## Groq model replacements (November 2026)

- Context: the original specification named `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`. The user's live diagnostic received HTTP 404. Groq's [deprecation notice](https://console.groq.com/docs/deprecations) says those models were shut down for free/developer tiers on August 16, 2026.
- Options: keep unavailable model IDs, or use Groq's documented replacements.
- Choice: `openai/gpt-oss-120b` for reasoning and `openai/gpt-oss-20b` for quick tasks.
- Why: the replacements are listed by Groq for those older models and appear on its [rate-limits page](https://console.groq.com/docs/rate-limits). Free quotas and availability can change; the user must verify their organization is on the free plan and check its limits. Live verification is still pending.

## Frontend streaming and state

- Choice: fetch-based SSE for both GET and POST; TanStack Query for server state and Zustand for the current answer draft.
- Why: native EventSource cannot submit the answer as POST. Streamed model text is labeled provisional until a validated complete event arrives. Interrupted answer streams can be reconciled by refreshing the saved interview before retrying.
- Reports poll every 20 seconds to leave headroom below the per-user request limit; the underlying process-local job state is not durable.

## Voice and privacy

Browser speech APIs vary in availability and may use a network service. We offer an explicit recording alternative that uploads to Groq only after the user chooses it; no audio is persisted by the application. Groq documents `whisper-large-v3-turbo` and free-tier audio limits at https://console.groq.com/docs/speech-to-text and https://console.groq.com/docs/rate-limits; availability and quotas may change. Word rate, fillers and pauses are rough English recognition heuristics, not diagnostic measurements; edited or mixed input has no speech metrics.

## Resume extraction and privacy

PDF input is limited to 5 MB, 10 pages and 20,000 extracted characters. PDF.js runs in a subprocess with a 128 MB V8 heap limit, 15-second deadline and two-process concurrency limit; this is resource isolation, not an OS security sandbox. Only extracted text is stored. Users can delete it, but generated interview material may retain derived information. AI match scores are estimates, never ATS or hiring decisions. Scanned PDFs and full Unicode report-font coverage are deferred.

## Camera observations

Video and landmarks stay in the browser. The user separately chooses whether to save coarse counts; they can delete those counts. The face and pose models are downloaded from Google after opt-in, and WebAssembly files are served locally. Estimates are uncertain and are not biometric identification, medical retinal analysis, evidence of attention, or cheating detection. The observations do not change interview scores. Rough shoulder/hip alignment, wrist movement and hand-height counts are not gesture classification and require real-device validation.
