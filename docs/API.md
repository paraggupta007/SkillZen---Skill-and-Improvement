# API

All implemented JSON responses use `{ "success": boolean, "data": ..., "error": ... }`.

## GET /api/health

Process liveness only; it does not check database or AI availability. No input or authentication.

```json
{ "success": true, "data": { "status": "ok" }, "error": null }
```

Unknown endpoints return HTTP 404:

```json
{
  "success": false,
  "data": null,
  "error": { "code": "NOT_FOUND", "message": "Route not found" }
}
```

Malformed JSON returns 400 `INVALID_JSON`; oversized JSON returns 413 `PAYLOAD_TOO_LARGE`; rate-limited requests return 429 `RATE_LIMITED`; unhandled errors return 500 `INTERNAL_ERROR`.


## Authentication and profile

All examples below use JSON and the standard envelope. Registration and login set a one-hour `skillzen_session` httpOnly cookie. A browser client must include credentials. The cookie is `SameSite=Lax` in development and `SameSite=None; Secure` in production. Mutating requests with an Origin header must match `CLIENT_URL`.

### POST /api/auth/register

Request: `{"name":"Ada","email":"ada@example.com","password":"strong-password"}`. Name: 1–120 characters; email must be valid; password: at least 8 characters and at most 72 UTF-8 bytes. Email is normalized to lowercase.

Response: HTTP 201, `{"success":true,"data":{"id":"<uuid>","email":"ada@example.com","name":"Ada","targetRole":null,"experienceLevel":null,"skills":[],"createdAt":"<ISO date>"},"error":null}`. Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`, 429 `RATE_LIMITED`, 503 `AUTH_UNAVAILABLE`.

### POST /api/auth/login

Request: `{"email":"ada@example.com","password":"strong-password"}`. Response: HTTP 200 with the same safe user object and cookie. Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`, 429 `RATE_LIMITED`, 503 `AUTH_UNAVAILABLE`.

### POST /api/auth/logout

No body. Response: HTTP 200, `{"success":true,"data":{"loggedOut":true},"error":null}` and a cleared cookie. For a valid current session, this revokes all sessions for that account and clears the cookie. Invalid, expired, stale or missing cookies are cleared without affecting newer sessions. Database failures return an error rather than reporting a successful revocation. Requests already authenticated before logout may still finish.

### GET /api/users/me

Requires the session cookie. Response: HTTP 200 with the safe user object. Errors: 401 `UNAUTHENTICATED`, 503 `AUTH_UNAVAILABLE`.

### PATCH /api/users/me

Requires the session cookie. Example: `{"targetRole":"Backend developer","experienceLevel":"beginner","skills":["TypeScript"]}`. Any subset of name, targetRole, experienceLevel and skills may be changed; role and experience can be null. Unknown or empty fields fail validation. Response: HTTP 200 with the updated safe user. Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `ORIGIN_FORBIDDEN`, 503 `AUTH_UNAVAILABLE`.

For all endpoints, a rejected non-allowed origin on a write returns 403 `ORIGIN_FORBIDDEN`; unexpected server errors use the common 500 response. Auth is not available unless a database and JWT secret are configured.

## AI layer

The interview endpoints use the internal provider router; there is no general-purpose public AI endpoint.

## Interviews

All interview endpoints require the session cookie and use user ownership checks. JSON errors before an SSE stream starts use the standard HTTP envelope. The AI routes limit requests per user.

### POST /api/interviews

Request: `{"role":"Backend developer","roundType":"technical","difficulty":"medium","totalQuestions":2,"jdText":"Optional job description"}`. Round types: `technical`, `hr`, `behavioral`; difficulty: `easy`, `medium`, `hard`; question count: 1–20. The optional job description is at most 12,000 characters. Include `"resumeId":"<owned uuid>"` to use a saved resume as context. The first 12,000 characters of extracted text are sent to the AI provider for questions and evaluations; an unowned resume returns 404. Response 201 contains the newly created interview. Errors include 400 `VALIDATION_ERROR`/`INVALID_ROUND`, 401 `UNAUTHENTICATED`, and 503 `INTERVIEWS_UNAVAILABLE`.

### GET /api/interviews and GET /api/interviews/:id

History returns up to 100 owned interview records. Detail returns `{"interview":{...},"turns":[{"question":{...},"answer":{...},"evaluation":{...}}]}`; unanswered turns have null answer/evaluation. Errors include 401 `UNAUTHENTICATED` and 404 `NOT_FOUND` for an inaccessible interview.

### GET /api/interviews/:id/next-question

Returns `text/event-stream`. The first pending question is returned again instead of creating a duplicate. The endpoint generates a question only when there is no unanswered question. Although it is a GET for EventSource compatibility, it changes state and checks Origin / cross-site fetch metadata. Before the stream, errors can include 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `ORIGIN_FORBIDDEN`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`, or 503 `INTERVIEWS_UNAVAILABLE`.

### POST /api/interviews/:id/answers

Request: `{"questionId":"<uuid>","answerText":"My answer","speech":{"durationSeconds":30,"wordCount":50,"fillerCount":2,"pauseCount":1}}`. `speech` is optional; text is limited to 12,000 characters. Returns SSE as described below. A valid final event contains `metrics` (including 0–10 integer scores), a feedback array and `idealAnswer`. The answer and evaluation are saved together after validation. Errors before streaming are like those above; once streaming has started, an error event may contain `NOT_FOUND`, `ALREADY_ANSWERED`, `INTERVIEW_CLOSED` or `AI_ERROR`.

### POST /api/interviews/:id/complete

No body. Marks an interview completed only after all questions are answered; repeated completion is idempotent. The successful response contains the completed interview. Errors include 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`, and 409 `INTERVIEW_INCOMPLETE`/`INTERVIEW_CLOSED`. A best-effort in-process `interview.completed` event starts report generation. Event delivery is not durable across process failure; requesting a missing report can schedule it again.

### SSE format and safety

Each event has a standard response envelope:

```text
event: status
data: {"success":true,"data":{"state":"processing"},"error":null}

event: delta
data: {"success":true,"data":{"text":"...","provisional":true},"error":null}

event: complete
data: {"success":true,"data":{"id":"..."},"error":null}
```

`delta` is raw, **unvalidated model JSON**, not the final question or evaluation. Display it only as text and never treat it as trusted structured data; JSON repair or a concurrent request can make `complete` differ. Only `complete` has passed validation and persistence. An `error` event has the standard failure envelope and HTTP status stays 200 after streaming begins. Clients must handle disconnects and errors and should not assume a provisional answer was saved. SSE answer submission is POST, so use `fetch` streaming rather than browser EventSource.

## Reports and analytics

All routes require the session cookie and are scoped to the authenticated user. Report IDs below refer to **interview IDs**, not the internal report row ID.

### GET /api/reports/:interviewId

A completed interview with a ready report returns 200: `{"success":true,"data":{"status":"ready","report":{"interviewId":"<uuid>","overallScore":8,"strengths":["Clear answer"],"weaknesses":["Limited depth"],"tips":["Give an example"],"summary":"Good start"}},"error":null}` (additional report fields may be present). Overall score is the rounded mean of per-answer overall scores on a 0–10 scale. If generation is running or restarted on demand, returns HTTP 202 with `{"success":true,"data":{"status":"pending"},"error":null}`. If the latest local attempt failed, returns HTTP 200 with `{"success":true,"data":{"status":"failed","error":"REPORT_GENERATION_FAILED"},"error":null}`; retry explicitly. Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `ORIGIN_FORBIDDEN`, 404 `NOT_FOUND`, 409 `INTERVIEW_INCOMPLETE`, 429 `RATE_LIMITED`, 503 `REPORTS_UNAVAILABLE`. The GET can start generation and is origin-checked. On Vercel, generation is awaited within the request and returns ready or failed rather than pending; a timeout or interruption can be retried. Concurrent function instances can duplicate generation.

### POST /api/reports/:interviewId/retry

No request body. On the long-running server, returns 202 and pending if a report must be generated, or 200 and ready if it already exists. On Vercel, generation is awaited within the request and returns 200 with ready or failed; it can take time or time out. The same validation, authentication, ownership, rate-limit and incomplete-interview errors apply.

### GET /api/analytics/summary

Returns `{"success":true,"data":{"totalInterviews":2,"completedInterviews":1,"averageScore":8,"scoreTrend":[{"interviewId":"<uuid>","startedAt":"<ISO date>","score":8}]},"error":null}`. The average and trend include only completed interviews with generated reports; `averageScore` is null if none exist. Trend contains at most 20 scores, ordered oldest to newest. Errors include 401 `UNAUTHENTICATED` and 503 `ANALYTICS_UNAVAILABLE`.

## Speech transcription

### POST /api/interviews/:id/transcription

Requires the session cookie, an owned in-progress interview and a configured server-side `GROQ_API_KEY`. Send the raw recording body with `Content-Type: audio/webm`, `audio/ogg`, or `audio/mp4`. The server enforces a 4 MB maximum, checks the container signature and applies a limit of 10 requests per user per 15 minutes. It forwards the audio to Groq Whisper (`whisper-large-v3-turbo`) for transcription; it does not save the recording to the database or disk. The browser asks for explicit microphone action and discloses the upload. Groq's own retention and terms apply.

Success: `{"success":true,"data":{"text":"Recognized answer"},"error":null}`. Common errors: 400 `VALIDATION_ERROR` or `INVALID_AUDIO`, 401 `UNAUTHENTICATED`, 403 `ORIGIN_FORBIDDEN`, 404 `NOT_FOUND`, 409 `INTERVIEW_CLOSED`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_AUDIO`, 429 `RATE_LIMITED`, 502 `TRANSCRIPTION_FAILED`, 503 `INTERVIEWS_UNAVAILABLE` or `TRANSCRIPTION_UNAVAILABLE`. Transcription has not been verified against a real Groq account.

The existing answer endpoint accepts optional `speech` metrics (durationSeconds, wordCount, fillerCount and pauseCount). Browser dictation supplies rough metrics only for an unedited single dictation without existing text; edited or uploaded/transcribed answers omit them rather than fabricate measurements.

### GET /api/reports/:interviewId/pdf

Requires authentication and ownership. Downloads a ready completed interview report as `application/pdf` with a private, no-store response. The PDF route does not start report generation. Returns 409 `REPORT_NOT_READY` when no report is stored, 409 `INTERVIEW_INCOMPLETE` for an incomplete session, 404 for an unknown or unowned interview, and the usual validation/authentication errors. Current built-in PDF fonts have limited Unicode coverage; non-Latin text may not render correctly.

## Resumes and job descriptions

All resume routes require an authenticated session. The application stores extracted text in PostgreSQL until deletion; it does not store the original PDF file. Resume and job-description text are sent to the configured AI provider during analysis or when a resume is selected for an interview. Provider retention policies apply. Generated interview content may retain information derived from a deleted resume.

### POST /api/resumes

Send a raw text-based PDF body with `Content-Type: application/pdf` (not multipart). Up to 4 MB, 10 pages and 20,000 extracted characters; scanned/image-only and encrypted PDFs are not supported. Response 201: `{"success":true,"data":{"id":"<uuid>","fileName":"resume.pdf","parsedSkills":[],"matchScore":null,"createdAt":"<ISO date>"},"error":null}`. Extracted text is not returned. Errors include 400 `INVALID_PDF`, 401 `UNAUTHENTICATED`, 413 `PAYLOAD_TOO_LARGE`, 415 `UNSUPPORTED_FILE`, 429 `RATE_LIMITED`, 503 `EXTRACTOR_BUSY` or `RESUMES_UNAVAILABLE`. Upload and analysis share a 20 requests/user/15 minutes limit.

### GET /api/resumes

Returns an array of at most 100 owned resume metadata objects. Raw text is never returned by this route.

### POST /api/resumes/:id/analyze

Body: `{"jobDescription":"Optional role description"}` (up to 12,000 characters, default empty). Response contains `skills`, `strengths`, `gaps`, `suggestions` arrays, `summary`, and nullable integer `matchScore` from 0–100. The match is an AI estimate, not an ATS or hiring decision. It is null without a job description. Only skills and the latest score are persisted, not the full analysis. Errors include 400 `VALIDATION_ERROR`, 404 `NOT_FOUND`, 429 `RATE_LIMITED`, and provider errors.

### DELETE /api/resumes/:id

Deletes the owned resume row and extracted text, clearing its interview references; returns `{"success":true,"data":{"deleted":true},"error":null}`. Returns 404 for missing or unowned resumes. Derived questions, answers and reports are not deleted.

## Optional camera observations (Phase 8 in progress)

`GET /api/interviews/:id/camera-metrics` returns `{ "metrics": null, "suggestions": [] }` when no observations were shared, or bounded aggregate counters with non-diagnostic framing suggestions. All requests require authentication and ownership; responses are private/no-store. `PUT` accepts only numeric integer counters: `samples`, `faceVisible`, `centered`, `centeredKnown`, `gazeNearCamera`, `gazeKnown`, `headMovements`, and optional pose counters `poseSamples`, `postureKnown`, `postureAligned`, `wristKnown`, `wristMovements`, `handRaisedKnown`, `handRaised` (default 0 for older clients; 0–18,000; samples at least 1; numerators and denominators must be consistent). Images, video, landmarks and unexpected fields are rejected. Only in-progress interviews accept new counts. `DELETE` removes stored counts for an owned interview, including after completion. Common errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 404 `NOT_FOUND`, 409 `INTERVIEW_CLOSED`, 429 `RATE_LIMITED`, 503 `CAMERA_METRICS_UNAVAILABLE`. The route does not verify the user-supplied counters.

The frontend shares counts only after explicit user action. The online report displays optional observations separately from the score; new PDF downloads include currently saved observations and omit them after deletion. Estimates are not proof of attention, cheating, identity, or medical retinal assessment. Coarse body alignment and wrist/hand-height observations are not gesture classification. Apply migrations through 0004 before using persistence.

## Mock tests

All endpoints require authentication, use private/no-store responses and are limited to 100 requests per user per 15 minutes. Apply migration 0005 before use.

- `POST /api/mock-tests` accepts `{ "topic": "javascript" | "web", "count": 3 | 5 }`; returns 201 with an attempt and randomly ordered question snapshot.
- `GET /api/mock-tests` lists up to the 100 newest owned attempts. `GET /api/mock-tests/:id` returns an owned attempt. Before submission, questions include only prompt and options, not the answer or explanation.
- `POST /api/mock-tests/:id/submit` accepts `{ "answers": [0, null, 1] }`: exactly one zero-based option index or null per question, in question order. The server scores one point per correct answer, stores the result once and returns selections, correct indices and explanations. Unanswered questions count as incorrect. Repeat submissions return 409 `TEST_COMPLETED`.
- `DELETE /api/mock-tests/:id` removes the owned attempt and result. Unknown or unowned IDs return 404; invalid requests return 400, missing authentication 401, missing database configuration 503 and rate limiting 429.

Questions are a small fixed public bank for practice; answers are not sent in pre-submission API responses but must not be treated as secret or as secure examination material. Draft selections remain only in the page and are lost on reload or navigation.

## Candidate feedback on interview questions

`GET`, `PUT`, and `DELETE /api/interviews/:id/questions/:questionId/feedback` require authentication and both the interview and question must belong together and to the user. Responses are private/no-store; requests are limited to 100 per user per 15 minutes. Unknown, unowned or mismatched questions return 404 `NOT_FOUND`.

- `GET` returns `{ "feedback": null }` if no rating exists, otherwise `{ "feedback": { "questionId": "...", "rating": 4, "comment": "Useful", "updatedAt": "..." } }`.
- `PUT` accepts `{ "rating": 4, "comment": "Useful" }`; rating is a required integer 1–5, comment is optional, trimmed and at most 1,000 characters. One row per question is created or replaced. Unknown fields are rejected.
- `DELETE` removes the feedback (idempotent for an existing owned question). Ratings may be managed during or after the interview. Invalid input returns 400 `VALIDATION_ERROR`; missing authentication 401, rate limiting 429, missing configuration 503 `FEEDBACK_UNAVAILABLE`.

Candidate feedback is separate from AI answer evaluations and does not affect the score. It is not fed into AI prompts or included in the report PDF. It is stored in the application database until deleted or the question is removed; there is currently no owner-facing aggregation or moderation interface. Apply migrations through 0006 before use.

## Account deletion

`DELETE /api/users/me` requires the session cookie and body `{ "password": "current-password" }`; no user ID is accepted. The password is rechecked before the account and app-owned records are deleted. On success it clears the cookie and returns `{ "deleted": true }`. Invalid credentials or a missing/invalid session return 401, invalid input 400, concurrent account changes 409, and excessive authentication attempts 429. Normal origin protection applies. Because protected routes check that the account still exists, a copied old session cookie cannot access the deleted account; ordinary logout also revokes the current session generation.

Deletion does not erase provider-held data, backups, operational logs, downloaded documents or non-user-linked AI usage metadata; already-running requests may have transmitted data. It cannot be undone.
