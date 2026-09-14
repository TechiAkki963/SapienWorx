# Phase C — Security Hardening

## Scope

Phase C hardens the existing SapienWorx Go/PostgreSQL/Next.js stack without changing product roles or introducing external identity providers. The focus is abuse resistance, JWT/RBAC validation, strict API parsing, SNS cost controls, SQL-injection review, and private CV storage.

## Authentication abuse controls

Public authentication endpoints use an in-process fixed-window limiter keyed by the direct socket peer IP.

Defaults:

- OTP-related endpoints: 8 requests per 10 minutes per peer IP.
- Login: 12 requests per 5 minutes per peer IP.
- Existing database-backed OTP resend interval and maximum-attempt rules remain in force.
- OTP resend and password-recovery requests return a generic accepted response when the account is absent or a resend is too soon, reducing account-enumeration signals.

The limiter deliberately does not trust `X-Forwarded-For`. If production traffic is terminated by a reverse proxy, that proxy must normalize the client address in a trusted deployment configuration rather than allowing arbitrary forwarded headers to become an authentication control input.

The in-memory limiter is suitable for the current single-instance low-cost deployment target. A future horizontally scaled deployment must move shared rate-limit state to a trusted distributed store or edge/WAF control.

## JWT and RBAC

Access tokens remain short-lived HS256 JWTs with issuer, audience, expiry, not-before, issued-at, role and subject checks. Tests cover:

- altered signatures and role escalation attempts;
- `alg=none` rejection;
- wrong issuer/audience rejection;
- expiry enforcement;
- candidate access to recruiter-only routes;
- missing authentication claims.

Refresh tokens remain opaque, hashed in PostgreSQL, rotated at refresh, and revocable. Access tokens are stateless and can remain usable until their short expiry after logout; SapienWorx intentionally does not add a database lookup to every authenticated request in this phase.

## JSON/API validation

The shared JSON decoder:

- disallows unknown fields;
- rejects malformed JSON;
- rejects a second/trailing JSON document;
- rejects a supplied non-`application/json` content type.

The server-wide body-size limit remains in place.

## SQL-injection review

Reviewed authentication, candidate, recruiter, admin and new CV access paths use pgx positional parameters (`$1`, `$2`, etc.) for request-derived values.

The candidate job-search query composes a compile-time SQL `WHERE` fragment with fixed query text; user-controlled search, location, company, work mode, experience, education and salary values remain positional parameters. The reviewed recruiter filtering and CV authorization queries also use positional parameters.

No reviewed path interpolates a user-provided identifier, filter or free-text field directly into SQL syntax. This is an implementation review, not a substitute for future SAST/DAST coverage.

## SNS cost and abuse control

`MeteredSender` now reserves daily SMS quota in `platform_metrics_daily` before invoking SNS. The reservation uses an atomic PostgreSQL upsert/update and refuses new sends after `SNS_SMS_DAILY_LIMIT` is reached. A failed SNS send releases its reservation best-effort.

Default development/example limit: 100 SMS/day. Production should set the value from the actual operational budget and expected OTP cost.

## Private candidate CV storage

Candidate CVs use direct-to-S3 signed requests. Raw CV bytes do not pass through the Go API.

Flow:

1. Candidate requests a short-lived signed PUT for a PDF.
2. Backend generates a randomized key under `candidate-cv/{candidateUserID}/...` and stores the pending key/filename in PostgreSQL.
3. Browser uploads directly to the private S3 bucket using the signed `Content-Type: application/pdf` and `x-amz-server-side-encryption: AES256` headers.
4. Candidate calls the completion endpoint, which marks the CV available.
5. Candidate downloads use a short-lived signed GET.
6. Recruiter downloads are allowed only when the recruiter belongs to a verified company and that candidate has applied to a job owned by that company.

Presigned URLs default to 5 minutes and configuration rejects TTLs above 15 minutes.

### Required S3 deployment policy

The production CV bucket must have:

- S3 Block Public Access enabled for all four settings;
- no public bucket policy and no public ACLs;
- default server-side encryption enabled;
- the application instance/task role restricted to the configured bucket and preferably the `candidate-cv/*` prefix;
- browser CORS limited to the SapienWorx origin and required PUT/GET headers/methods;
- lifecycle/versioning rules selected according to privacy and retention requirements.

The signed PUT currently constrains content type and encryption headers but does not cryptographically enforce object size. The candidate UI rejects files above 5 MB; a future presigned-POST policy or S3 validation pipeline should be used if server-enforced object-size limits are required.

The completion endpoint does not issue an S3 `HeadObject` call. Calling complete without uploading creates metadata that points to a missing object, which results in an S3 404 on use but does not grant broader access.

## CV API

Candidate:

- `POST /api/v1/candidate/cv/presign`
- `POST /api/v1/candidate/cv/complete`
- `GET /api/v1/candidate/cv`

Recruiter:

- `GET /api/v1/recruiter/candidates/{candidateID}/cv`

All routes require the appropriate authenticated role.

## Configuration

New Phase C settings:

```env
AUTH_OTP_IP_LIMIT=8
AUTH_OTP_IP_WINDOW=10m
AUTH_LOGIN_IP_LIMIT=12
AUTH_LOGIN_IP_WINDOW=5m
SNS_SMS_DAILY_LIMIT=100
S3_BUCKET=
S3_PRESIGN_TTL=5m
```

Do not commit AWS credentials. Production should use an instance/task IAM role.
