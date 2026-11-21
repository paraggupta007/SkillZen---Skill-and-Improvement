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

Resumes, interviews, reports, analytics, speech, mock tests and candidate feedback endpoints are planned and do not exist yet. Their actual requests, responses and errors will be added in the same phase as their implementation.

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
