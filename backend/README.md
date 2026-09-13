# SapienWorx Go Backend

Phase 2 establishes the production backend foundation without implementing candidate/recruiter signup or login workflows yet.

## Runtime

- Go 1.26+
- PostgreSQL through `pgxpool`
- JSON REST over `net/http`
- HMAC-SHA256 JWT access tokens
- bcrypt password hashing
- structured JSON logging through `log/slog`

## Package layout

```text
cmd/api/                         process lifecycle / dependency wiring
internal/auth/                   JWT and password security primitives
internal/platform/config/        typed environment configuration
internal/platform/database/      PostgreSQL pool creation and validation
internal/platform/httpserver/    HTTP server, health handlers and middleware
```

Business-domain packages from Phase 1 remain reserved for their feature phases.

## Local run

From the repository root:

```bash
docker compose up -d postgres
cp .env.example .env
```

Export the environment variables from `.env`, then:

```bash
cd backend
go mod tidy
go test ./...
go run ./cmd/api
```

Health endpoints:

```text
GET /health/live
GET /health/ready
```

Authentication middleware can be exercised by future auth flows through:

```text
GET /api/v1/auth/me
Authorization: Bearer <access-token>
```

## Security behavior

- API refuses to boot without `DATABASE_URL` and a JWT secret of at least 32 bytes.
- Access tokens verify signature, algorithm, issuer, audience, role, expiry, not-before and issued-at timestamps.
- Password verification exposes a single invalid-credentials error.
- Default access-token lifetime is 15 minutes.
- Request bodies are capped globally (2 MiB by default).
- CORS uses an explicit origin allowlist; wildcard credentials are not used.
- Panic recovery does not disclose stack traces to clients.
- Request IDs are returned on every request and attached to API errors/logs.
- Readiness checks verify PostgreSQL; liveness does not depend on external services.
- Graceful shutdown drains the HTTP server on SIGINT/SIGTERM.

## Deferred to Phase 4

Signup/login handlers, refresh-token/session persistence, mobile OTP issuance/verification, recruiter-company verification workflows and AWS SNS calls are intentionally not implemented in Phase 2.
