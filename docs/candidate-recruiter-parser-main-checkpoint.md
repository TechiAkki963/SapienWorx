# Candidate, recruiter and CV parser — main release checkpoint

Date: 2026-09-28. Prepared on top of the published Admin checkpoint `0be6af280545d63ee7ccb41d7c8289c10ba0143b` in an isolated checkout. The original combined development checkout and index are preserved.

## Included source

- Candidate onboarding, reviewed CV-to-profile suggestions, profile sections, contact-sharing controls, contained salary filters and candidate navigation.
- Recruiter discovery and filters, responsive application cards, job detail/edit/applicant routes, candidate comments and contact authorization, dashboard action queues and interview workflows.
- Recruiter Messages and candidate Inbox reuse the shared two-way messaging workspace. The obsolete, unreferenced candidate-only inbox component is removed; messaging is retained.
- Local Go PDF/DOCX parser, conservative field extraction, fail-closed private ClamD adapter and bounded optional OCR adapter. Supporting local test flags, Docker build arguments and migration 000025 are included. Migration files are normalized to LF; the runner tolerates equivalent historical LF/CRLF checksums, not SQL-content changes.
- Existing Admin and session-security changes remain intact. No infrastructure or production deployment configuration is changed.

## Local validation

- Frontend production build and TypeScript check passed.
- Cross-portal Chromium suite: 44 passed, 2 skipped. Skips remain the explicitly excluded Kanban drag interaction and an unmounted spring-animation contract. Bulk application selection is now exercised.
- Isolated Admin Chromium suite: 26 passed, including the login dog, restricted roles, recruitment history, governance, MFA gating and responsive layouts.
- Full Go tests, vet, formatting and module checks passed. Uncached parser, candidate, recruiter and storage tests passed, including synthetic CV layouts and mocked scanner failures.
- Disposable PostgreSQL Admin/security/recovery suites passed. All forward and reverse migrations passed on a separate disposable database.

Browser responses are synthetic fixtures, not evidence of deployed integration. Scanner protocol tests and the OCR callback test use mocks; actual ClamD/Tesseract end-to-end validation and representative, authorized CV accuracy testing are still required before production parser enablement.

## Release boundary

The CV parse-preview endpoint is registered only outside production with explicit opt-in. Production build defaults leave the preview and optional OCR disabled. Non-fixture documents require a working private scanner and fail closed otherwise. CV contents, real credentials and generated screenshots are not committed.

This is an approved source commit/push only. No production workflow dispatch, container redeploy, live migration installation, AWS provisioning, DNS change, real administrator assignment, MFA activation, email-provider change or SES access request is performed. Keep existing SES-dependent public registration restrictions. Target-environment rollout and acceptance require separate approval.
