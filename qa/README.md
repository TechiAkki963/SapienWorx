# SapienWorx Quality Engineering Suite

This directory is the executable quality gate for SapienWorx. It complements the existing frontend/backend CI and follows the repository constraints in `AGENTS.md`.

## Test pyramid

- **Static:** TypeScript typecheck/build, `go vet`, dependency/integration boundary scan.
- **Unit/race:** backend `go test ./... -race`.
- **Integration:** PostgreSQL FK/cascade/isolation, query/index, migration idempotency.
- **Contract/API:** malformed payloads, routing/methods, pagination, RBAC, injection resilience.
- **Browser:** Playwright smoke, responsive visual regression, accessibility and state-preserving journeys.
- **Performance:** k6 candidate search and concurrent recruiter stage-update scenarios.
- **Manual:** release, UX, security, upload and observability checks.

## Local prerequisites

- Node.js 22+
- Go 1.26+
- Docker
- PostgreSQL 17 for local application runs
- k6 for load testing

## Browser tests

```bash
cd qa
npm install
npx playwright install chromium
FRONTEND_URL=http://127.0.0.1:3000 API_URL=http://127.0.0.1:8080 npm run test:smoke
FRONTEND_URL=http://127.0.0.1:3000 API_URL=http://127.0.0.1:8080 npm run test:a11y
```

Run the opt-in authenticated suites after creating deterministic QA users/fixtures:

```bash
RECRUITER_EMAIL=recruiter@example.com \
RECRUITER_PASSWORD='...' \
E2E_JOB_ID='...' \
TEST_OTP='...' \
npm run test:regression
```

## Database integration

```bash
cd qa/tests/go
go mod tidy
go test ./... -v -count=1
```

The database suite uses disposable PostgreSQL containers and must never point at staging or production.

## API contracts

Set `API_URL` plus role-specific JWTs when routes require authorization:

```bash
API_URL=http://127.0.0.1:8080 \
RECRUITER_JWT='...' \
CANDIDATE_JWT='...' \
go test ./... -run 'TestMalformed|TestUnsupported|TestCandidate|TestStandard|TestRecruiter|TestInjection' -v
```

## Performance

Populate recruiter-owned application IDs, then run:

```bash
cd qa
API_URL=http://127.0.0.1:8080 \
RECRUITER_JWT='...' \
APPLICATION_IDS='id1,id2,id3' \
k6 run performance/load_test.js
```

The suite fails when candidate search p95 is >=300ms, global/scenario error rates are >=1%, or recruiter stage-update p95 is >=1000ms.

## Stable selector contract

Critical UI controls should expose semantic roles/names first. Use `data-testid` only for application-specific controls whose identity is otherwise unstable, including:

- `email`, `password`, `login-submit`
- `candidate-table`, `candidate-row`
- `filter-location`, `filter-tech-stack`, `filter-notice-period`
- `pipeline-board`, `pipeline-candidate`, `stage-select`
- `cv-upload`, `cv-upload-success`
- `apply-button`, `application-success`

Never select Tailwind utility classes in E2E tests.

## Release gate

A production release is blocked on failing build/typecheck, Go race tests, high-severity accessibility violations, RBAC/security regressions, migration/integrity failures, critical-path smoke failures, or performance thresholds.

Flaky tests are defects. Do not solve flakiness by adding arbitrary sleeps or globally increasing retries. Quarantine only with an owner, linked issue and expiry date.
