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

Auth, users, resumes, interviews, reports, analytics, speech, mock tests and candidate feedback endpoints are planned and do not exist yet. Their actual requests, responses and errors will be added in the same phase as their implementation.
