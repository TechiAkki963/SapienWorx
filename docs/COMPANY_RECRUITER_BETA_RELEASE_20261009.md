# Combined company and recruiter beta release

This release combines `8cea41681824adc9fa79542963cba073408d0f79` (recruiter refinements and company governance, including the two job-sharing commits) with `a767607a1c2dabf3f01b4ef56b6664844e806634` (preserved older backend, deployment guidance and design assets), based on main `a676858425e9775aa2b11c64a113b48f9aa798c6`.

## Integration review

The older branch's direct authentication-email sender, activation logic and job-write changes have newer equivalents in the release. The integrated release retains the transactional email outbox, account eligibility and enumeration protection, SNS-only phone transport, typed job SQL, and transactional company-capacity enforcement. The standalone historical SES adapter remains unwired; the existing governed email runtime is authoritative. No production SES activation or infrastructure apply is part of this release.

Applied migrations 1–58 remain byte-for-byte unchanged apart from Git line-ending normalization. In particular, migration 23 retains the currently deployed activation and status protections. New migrations 59–64 add interview operations, recipient-scoped recruiter notifications, candidate referral settings, company entitlements, company administration and independent company reviews. New company access and pricing policies preserve legacy recruiters; commercial limits remain unenforced until explicitly approved.

The older design concepts, synthetic PDF, preparation scripts and deployment guidance are preserved as source/reference artifacts. They do not replace the application UI, live edge or runtime configuration. PDF files are marked binary to preserve their bytes.

## Validation and deployment boundaries

Before rollout, rehearse all 64 migrations in disposable localhost PostgreSQL 17, run backend vet/tests with the company and recruiter isolation suites, and run affected browser regressions and frontend production checks. Publish a reviewed PR and require applicable CI to pass before merging and dispatching Beta Stage A at the final immutable main SHA.

Immediately before migrations, verify `current_database() = sapienworx_beta` and take a protected beta-only backup with a readable restore manifest. The release reuses EC2 `i-0356b55e3d7eaf72a`, existing RDS, isolated beta roles and the beta documents bucket.

After rollout, freshly verify all three immutable container images and health, database TLS and production isolation, all 64 migration checksums, host capacity, the existing Caddy container identity/start time, and exact www/apex holding-page hashes. Inspect candidate, recruiter, Command Centre and public company/job-sharing routes in the deployed app. Local fixture coverage of owner/scoped workflows is distinguished from live testing of existing accounts; no owner or privileged account is silently created for visual testing.

Stage B, Caddy restart/reload, DNS/TLS changes, new EC2/RDS resources, production data changes, production SES activation and production cutover are excluded. Application rollback retains the forward schema; destructive reverse migrations are not a routine recovery step.

Local test logs and eventual live evidence are retained under ignored `tmp` paths. Credentials and private account data must not be included in Git or the release report.
