# Phase 2 — Robust Go Backend Foundation

## Purpose

Phase 2 turns the architectural skeleton into a runnable Go service while keeping authentication business flows in Phase 4.

## Decisions

### Standard-library HTTP stack

SapienWorx uses `net/http` and Go 1.26 route patterns. This avoids framework coupling while preserving middleware composition and makes the service inexpensive to run on a small EC2 instance.

### PostgreSQL

`pgxpool` provides the production database connection pool. Pool bounds, connection lifetime and health timeouts are environment-configurable. New connections force the PostgreSQL session timezone to UTC.

### JWT

Access tokens use HS256 and include `sub`, `role`, `iss`, `aud`, `iat`, `nbf`, `exp`, and optional `jti`. Parsing rejects algorithm substitution, bad signatures, wrong issuer/audience, unknown roles and invalid timing claims. The master-admin role is enforced by the same server-side authorization primitives as all other roles.

Phase 4 will decide refresh-token/session persistence and revocation mechanics before exposing real login endpoints.

### Password hashing

Passwords use bcrypt cost 12. Plaintext passwords are never stored. Phase 4 will layer user-facing password rules and login rate controls on this primitive.

### HTTP hardening

The middleware chain provides request IDs, structured access logs, panic recovery, restrictive response headers, explicit CORS, body-size limits, bearer authentication and role authorization helpers.

### Health model

`/health/live` proves the process can serve HTTP. `/health/ready` additionally pings PostgreSQL so deployment tooling can distinguish a live process from one unable to serve application traffic.

## Dependency policy

Phase 2 has two direct dependencies only:

- `github.com/jackc/pgx/v5` for PostgreSQL.
- `golang.org/x/crypto` for bcrypt.

JWT signing and validation, HTTP routing, logging and middleware use the Go standard library.

## Runtime configuration

Required:

- `DATABASE_URL`
- `JWT_SECRET` (32+ bytes)

Key optional settings include HTTP timeouts/body limits, DB pool bounds, CORS allowlist, JWT issuer/audience/TTL and clock skew. See `.env.example`.

## Testing

Unit coverage exists for configuration validation, password hashing, JWT expiry/signature flows, readiness failure and protected-route behavior. GitHub Actions runs formatting checks, `go vet`, and `go test ./...` on changes under `backend/`.
