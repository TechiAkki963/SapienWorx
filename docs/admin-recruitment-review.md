# Master Admin recruitment, account summaries and recovery — local checkpoint

Date: 2026-09-28. Working checkout: `.codex/worktrees/main-local`, branch `codex/hybrid-inmail-foundation`. This is an uncommitted local review checkpoint, not completion of all eight workstreams, a production deployment or proof of live AWS readiness. Pre-existing candidate/recruiter/backend/infrastructure changes are preserved.

## Implemented

- Read-only applications, interviews and per-application recorded timelines. Backend permission `recruitment.read` is granted in the proposed catalog only to Super Admin and Platform Admin. Every route and SSR page uses the existing administrator guards before reading operational data.
- Filters: organization UUID, registered-organization country, job UUID/readable reference, keyword, stage, interview status and upcoming scheduled interviews. Applied timestamps are inclusive at the start and exclusive at the end. Date filters on interviews refer to associated application submission, explicitly labelled.
- Application/interview lists and history use bounded, read-only repeatable-read transactions; query deadlines are five seconds and pagination is bounded. Counts and rows use the same filter and snapshot.
- Timelines include retained application-stage and interview-change records, with actual recorded recruiter actors and UTC timestamps. Older submission/interview-created records do not invent an actor or original interview schedule. Meeting links, notes, private feedback, CVs and message contents are excluded.
- Organization/country filters scope dashboard recruitment totals/activity, account cohorts, jobs and verification queues. Scoped candidate accounts are applicants to the selected organizations, not residents of the country. Privacy/security totals remain explicitly platform-wide. Queue, status-tab and pagination links preserve their filters.
- Exact job/application/stage/interview drill-downs and exact-target administrative audit links. Current offer/hired stages are explicitly not treated as issued offers or confirmed employment. Job ownership is not presented as a complete historical edit ledger.
- Read-only account summaries: stored candidate onboarding/method/completion, visibility/contact preferences, upload-presence and application count; recruiter-owned job/application totals and retained workflow-event counts; current-session count and latest retained consent preference counts. Arbitrary profile JSON/consent metadata, session credentials and document contents are never returned.
- Missing/invalid records and invalid filters display unavailable/error states rather than fabricated data. Missing older onboarding states show `not_recorded`.
- Desktop applications table, smaller-screen application cards, responsive interview/job/account surfaces, compact scrollable mobile navigation, preserved desktop sidebar and explicit legacy-security warning. Admin login dog and candidate/recruiter routes remain intact.
- Offline recovery tool defaults to inspection. Explicit process enablement, exact target confirmation, existing separate authorized operator, case reference and justification are required to apply. Tests use synthetic accounts only; no real recovery/assignment/key/MFA activation was performed. See the [activation runbook](admin-security-activation-runbook.md).

## Validation evidence

- Real PostgreSQL: recruitment organization/country/job/stage/search/pagination/date-boundary tests; dashboard-to-account/job/verification count consistency; truthful actor/history output; private-content exclusions; invalid input and cancellation; account summary consent-latest-event logic, legacy states and recruiter activity counts.
- Real Go HTTP router/database: all eight admin roles checked against protected endpoints, including direct recruitment/history/account-summary routes. Existing account lifecycle, forced reset, HTTP session revocation, WebSocket revocation, refresh/logout and MFA rollback journeys rerun.
- Full backend regression suite and `go vet ./...` passed. Database-backed suites ran explicitly with the test-only database configured, before clearing that variable for the general suite. Migration rollback tests ran sequentially rather than concurrently with HTTP/operator tests.
- Recovery command: default inspection, unsafe/self input, all apply gates, no connection-secret echo, unauthorized operator denial, audit-failure rollback, successful synthetic audited recovery with session revocation, unchanged target role and repeated missing-credential refusal. Case-equivalent UUID self recovery is rejected before database access.
- Frontend TypeScript and production build passed. All 26 isolated Chromium journeys passed, including the six new recruitment/account journeys. Responsive assertions/screenshots cover 1440, 768 and 375px; no page-wide horizontal overflow. Browser journeys use a synthetic API; real authorization/data queries are covered separately by Go/PostgreSQL tests.
- Visual review uses a separate preview of the built UI on 3010/18090, not the running application. The expanded navigation was compacted after mobile inspection. Screenshots are synthetic evidence, not production data or test credentials for the ordinary app.
- Initial failures were investigated: the existing recruiter trigger had already inserted a pending verification, a reused synthetic database polluted a reporting fixture, and browser assertions incorrectly assumed an overview landing for restricted roles/unqualified alerts. Fixtures/assertions were corrected and the complete database suite rerun on a fresh disposable database. No application security checks were weakened to make tests pass.
- Existing app containers/databases and AWS remain untouched. No commit/push, application migration installation, deployment, new AWS resources, provider changes or SES access requests were performed.
- Final built-UI visual inspection covered desktop applications, mobile application history/account summary and tablet interviews. The temporary preview tab was closed and viewport restored before stopping its two helper processes. The disposable PostgreSQL database/anonymous volume and private network were removed; only synthetic test data was discarded. The eight existing app/test containers remained running and healthy.
- Desktop visual evidence: `C:/Users/Admin/.codex/visualizations/2026/09/08/01a07fd4-ff45-7882-bab0-e3b52b083273/admin-recruitment-review.png`. Responsive browser screenshots remain under the active checkout's `output/admin-*` paths. All shown figures are synthetic local fixtures.

## Files in this checkpoint

Paths below are relative to the active checkout. Some shared files also contain older uncommitted work; review hunks before staging. Do not stage every dirty file automatically.

| Area | Files |
| --- | --- |
| Go recruitment/scope | `backend/internal/admin/recruitment.go`, `dashboard.go`, `service.go`, `hardening.go`, `account_summary.go`, `permissions.go` |
| HTTP authorization/routes | `backend/internal/platform/httpserver/admin_recruitment_handlers.go`, `admin_dashboard_handler.go`, `admin_account_summary_handler.go`, `admin_handlers.go`, `server.go` |
| Recovery preparation | `backend/internal/admin/recovery_plan.go`, targeted validation in `mfa.go`, `backend/cmd/admin-recovery/main.go` |
| Database/HTTP regression tests | `backend/internal/admin/recruitment_integration_test.go`, `permissions_test.go`, `recovery_plan_test.go`, `backend/internal/platform/httpserver/admin_security_integration_test.go`, `backend/cmd/admin-recovery/main_test.go`, `integration_test.go` |
| Frontend routes | `frontend/app/swx-command-centre/(workspace)/applications/page.tsx`, `applications/[applicationID]/page.tsx`, `interviews/page.tsx`, `users/[userID]/page.tsx`, scoped changes in `overview/page.tsx`, `users/page.tsx`, `jobs/page.tsx`, `tenants/page.tsx`, `audit/page.tsx` |
| Shared admin UI/types | `frontend/components/admin/recruitment-workspace.tsx`, `account-lifecycle-actions.tsx`, `admin-nav.tsx`, `admin-shell.tsx`, `admin-access-preview.tsx`, `frontend/lib/admin-recruitment.ts`, `admin.ts`, `admin-access.ts`, `admin-permission-catalog.json` |
| Browser regression tests | `frontend/tests/e2e/admin-recruitment.spec.ts`, synthetic fixtures in `mock-api.mjs`, `frontend/playwright.admin-access.config.ts` |
| Review records | This file, `docs/admin-completion-roadmap.md`, `docs/admin-security-activation-runbook.md` |

No new migration or package is added in this checkpoint. It depends on earlier additive candidate/recruitment/security migrations in the combined worktree; these still require reviewed target-environment installation. It must not be deployed onto an older schema without release review.

## Still pending

1. Complete recruitment job-edit/offer/hire evidence where the underlying product has no ledger yet.
2. Organization restriction enforcement, invitation acceptance, reassignment and duplicate/merge review; do not equate company verification with an organization suspension system.
3. Approved exact admin assignments, runtime key installation, target recovery rehearsal/MFA activation, application-enforced dual approval and high-risk approval workflows.
4. Reviewer-owned moderation/privacy cases, investigation/consent history, governed data-rights fulfilment, retention and legal holds.
5. Persistent, metadata-only SES/InMail/parser delivery/failure/latency/retry/backlog/review monitoring. Stored message counts are not email-delivery evidence.
6. Connected live performance/alerts/ownership, release/migration evidence, backups and restore-test evidence. Unconnected sources remain unavailable, not healthy.
7. Actual AWS cost/budget reporting, content publishing/revisions and operational settings. No budget cap or actual spending is inferred from local data. Subscription management remains deferred.
8. Combined diff/CI/migration review, exact rollout approval, protected backups, deployed acceptance and rollback verification. No local test result alone establishes production readiness.

Recommended next local slice: organization restrictions and governed reassignment, with transaction/audit/enforcement tests across authentication, posting and messaging. Keep migration installation and production rollout separate from implementation approval.
