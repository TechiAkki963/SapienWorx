# SapienWorx QA Execution Runbook

## 1. Pre-commit

From repository root:

```bash
cd frontend && npm run typecheck && npm run build
cd ../backend && go vet ./... && go test ./... -race -count=1
```

Do not commit generated reports, credentials, `.env` files, browser traces or production data fixtures.

## 2. Disposable QA infrastructure

```bash
cd qa
docker compose -f docker-compose.qa.yml up -d
```

QA PostgreSQL: `postgres://postgres:postgres@127.0.0.1:55432/sapienworx_test?sslmode=disable`

QA MinIO: `http://127.0.0.1:59000`

Never reuse production buckets/databases for automated tests.

## 3. Start application locally

Use the normal root development PostgreSQL or a dedicated test database. Start backend and frontend separately:

```bash
cd backend
go run ./cmd/api
```

```bash
cd frontend
npm run dev
```

Verify:

```bash
curl -f http://127.0.0.1:8080/health/live
curl -f http://127.0.0.1:8080/health/ready
curl -f http://127.0.0.1:3000/
```

## 4. Browser smoke and accessibility

```bash
cd qa
npm install
npx playwright install chromium
npm run test:smoke
npm run test:a11y
```

Failures in WCAG A/AA, readiness, console errors or landing-page availability are release blockers until triaged.

## 5. Database integration

```bash
cd qa/tests/go
go mod download
go test ./... -v -count=1
```

The suite validates relational isolation/cascades, a 100k-row indexed search fixture and migration idempotency patterns.

## 6. Authenticated API contracts

Create dedicated non-production candidate/recruiter fixtures, then export short-lived test JWTs:

```bash
export API_URL=http://127.0.0.1:8080
export CANDIDATE_JWT='...'
export RECRUITER_JWT='...'
cd qa/tests/go
go test ./... -run 'TestMalformed|TestUnsupported|TestCandidate|TestStandard|TestRecruiter|TestInjection' -v
```

Do not store JWTs in repository files or CI logs.

## 7. Critical E2E journeys

Create deterministic candidate/recruiter accounts and a test job, then:

```bash
cd qa
export E2E_JOB_ID='...'
export TEST_OTP='...'
export RECRUITER_EMAIL='...'
export RECRUITER_PASSWORD='...'
npm run test:regression
```

A test may only be skipped because a documented external fixture is unavailable. Never hide a failing implemented journey with `skip`.

## 8. Visual regression

```bash
cd qa
npm run test:ui
```

Review every changed screenshot. Baselines are updated only after intentional design approval.

## 9. Load test

Populate recruiter-owned application IDs first:

```bash
cd qa
API_URL=http://127.0.0.1:8080 \
RECRUITER_JWT='...' \
APPLICATION_IDS='id1,id2,id3' \
k6 run performance/load_test.js
```

Hard gates:

- candidate job search p95 < 300 ms
- global request failures < 1%
- candidate scenario errors < 1%
- recruiter stage-update errors < 1%
- recruiter stage-update p95 < 1000 ms
- no deadlock / serialization-failure signatures

Run sustained memory checks against a containerized backend with:

```bash
BACKEND_CONTAINER='<container>' qa/scripts/memory-guard.sh
```

## 10. Security scan

```bash
bash qa/scripts/third-party-isolation.sh .
```

Also complete `SECURITY_CHECKLIST.md` before a production release.

## 11. Release decision

Block release for any of the following:

- build/typecheck failure
- Go race detector failure
- database integrity/migration regression
- critical smoke failure
- RBAC/IDOR/authentication bypass
- SQLi or executable XSS
- public CV/object exposure
- committed secret or forbidden SaaS integration
- unresolved WCAG A/AA regression on a critical journey
- k6 threshold failure without an approved capacity exception

Record any temporary exception with owner, rationale, expiry date and remediation issue.
