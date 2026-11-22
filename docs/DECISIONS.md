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
