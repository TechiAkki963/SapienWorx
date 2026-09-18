# Step 4 Production Readiness Invariants

This file records the automated release checks introduced during the full production readiness and regression audit.

## Frontend release gate

- Dependencies are reproducible through `package-lock.json` and installed with `npm ci`.
- Production dependencies are audited at high severity or above before typecheck/build.
- TypeScript typecheck, production build, bundle reporting and Playwright E2E remain required CI signals.
- Playwright is pinned to a patched release rather than the vulnerable 1.55.0 line.

## Backend release gate

- Go module files must remain tidy and committed.
- All Go code must pass gofmt, vet, race-enabled tests and the existing concurrency guards.
- `govulncheck` scans the backend dependency graph.
- Production configuration rejects insecure cookies, HTTP CORS origins, shared JWT/OTP secrets and a database URL that explicitly disables TLS.
- Messaging WebSocket upgrades use the same explicit trusted-origin allow-list as HTTP CORS.

## Database release gate

- Every forward migration must have a matching rollback.
- The migration CI applies the complete migration chain to a clean PostgreSQL 17 database and then rolls it back in reverse order.

## Operational release checks

Before a real production launch, repository branch protection/status-check enforcement and a credentialed staging load test should be confirmed separately from code-level CI.
