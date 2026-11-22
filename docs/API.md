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

Resumes, speech transcription, PDF reports, mock tests and candidate feedback endpoints are planned and do not exist yet. Their actual requests, responses and errors will be added in the same phase as their implementation.

## Authentication and profile

All examples below use JSON and the standard envelope. Registration and login set a one-hour `skillzen_session` httpOnly cookie. A browser client must include credentials. The cookie is `SameSite=Lax` in development and `SameSite=None; Secure` in production. Mutating requests with an Origin header must match `CLIENT_URL`.

### POST /api/auth/register

Request: `{"name":"Ada","email":"ada@example.com","password":"strong-password"}`. Name: 1–120 characters; email must be valid; password: at least 8 characters and at most 72 UTF-8 bytes. Email is normalized to lowercase.

Response: HTTP 201, `{"success":true,"data":{"id":"<uuid>","email":"ada@example.com","name":"Ada","targetRole":null,"experienceLevel":null,"skills":[],"createdAt":"<ISO date>"},"error":null}`. Errors: 400 `VALIDATION_ERROR`, 409 `EMAIL_TAKEN`, 429 `RATE_LIMITED`, 503 `AUTH_UNAVAILABLE`.

### POST /api/auth/login

Request: `{"email":"ada@example.com","password":"strong-password"}`. Response: HTTP 200 with the same safe user object and cookie. Errors: 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`, 429 `RATE_LIMITED`, 503 `AUTH_UNAVAILABLE`.

### POST /api/auth/logout

No body. Response: HTTP 200, `{"success":true,"data":{"loggedOut":true},"error":null}` and a cleared cookie. This stateless logout does not revoke a copied JWT; it expires in one hour.

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

Request: `{"role":"Backend developer","roundType":"technical","difficulty":"medium","totalQuestions":2,"jdText":"Optional job description"}`. Round types: `technical`, `hr`, `behavioral`; difficulty: `easy`, `medium`, `hard`; question count: 1–20. The optional job description is at most 12,000 characters. Response 201 contains the newly created interview. Errors include 400 `VALIDATION_ERROR`/`INVALID_ROUND`, 401 `UNAUTHENTICATED`, and 503 `INTERVIEWS_UNAVAILABLE`.

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

A completed interview with a ready report returns 200: `{"success":true,"data":{"status":"ready","report":{"interviewId":"<uuid>","overallScore":8,"strengths":["Clear answer"],"weaknesses":["Limited depth"],"tips":["Give an example"],"summary":"Good start"}},"error":null}` (additional report fields may be present). Overall score is the rounded mean of per-answer overall scores on a 0–10 scale. If generation is running or restarted on demand, returns HTTP 202 with `{"success":true,"data":{"status":"pending"},"error":null}`. If the latest local attempt failed, returns HTTP 200 with `{"success":true,"data":{"status":"failed","error":"REPORT_GENERATION_FAILED"},"error":null}`; retry explicitly. Errors: 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `ORIGIN_FORBIDDEN`, 404 `NOT_FOUND`, 409 `INTERVIEW_INCOMPLETE`, 429 `RATE_LIMITED`, 503 `REPORTS_UNAVAILABLE`. The GET can start generation and is origin-checked.

### POST /api/reports/:interviewId/retry

No request body. Returns 202 and pending if a report must be generated, or 200 and ready if it already exists. The same validation, authentication, ownership, rate-limit and incomplete-interview errors apply.

### GET /api/analytics/summary

Returns `{"success":true,"data":{"totalInterviews":2,"completedInterviews":1,"averageScore":8,"scoreTrend":[{"interviewId":"<uuid>","startedAt":"<ISO date>","score":8}]},"error":null}`. The average and trend include only completed interviews with generated reports; `averageScore` is null if none exist. Trend contains at most 20 scores, ordered oldest to newest. Errors include 401 `UNAUTHENTICATED` and 503 `ANALYTICS_UNAVAILABLE`.
