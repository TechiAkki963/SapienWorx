# Super Admin recruitment management — main release checkpoint

Date: 2026-09-28. Prepared from main `efad6df` in an isolated checkout.

## Release boundary

This source checkpoint contains the reviewed Master Admin recruitment lists and history, scoped dashboard reporting, account and organization summaries, governance controls, proposed permission catalog, gated MFA and offline recovery preparation. Authentication/session enforcement is included because moderation and revocation must be effective on protected HTTP requests and WebSockets. No real administrator assignments or MFA activation are performed by this commit.

Shared-file changes were separated from the combined development checkout. Candidate onboarding/CV-parser work, candidate/recruiter UI refactors, discovery features, messaging UI, Docker/Terraform changes and production settings are not part of this release. The only recruiter service change records actual stage transitions for the Admin audit view; no new recruiter-facing workspace is enabled.

Supporting paired migrations 000026–000033 are included because the reviewed Admin queries depend on their columns and audit/security tables. Migration 000025 adds discovery indexes and is not required by this slice. Migration numbers need not be contiguous: the existing runner applies ordered migration files. Installation remains a separate reviewed target-environment operation. Do not deploy these queries onto an older schema.

Browser CI now runs Admin-enforcement scenarios separately on their isolated ports. Existing Admin journeys were updated to assert the new snapshot dashboard and explicit approval confirmation, not removed. Standard browser helper ports are configurable to prevent collisions with running local containers. Three existing Go files receive formatting-only alignment required by the formatting check; no candidate/recruiter behavior changes are included in those files.

## Local validation of this isolated source tree

- Frontend production build and TypeScript check passed.
- All 26 isolated Chromium Admin journeys passed, including recruitment filters/history, restricted roles, lifecycle actions, unavailable states, MFA gating, desktop/tablet/mobile layouts and the login dog.
- Existing cross-portal Chromium suite: 28 passed, 3 previously declared skips. Skips cover unimplemented bulk pipeline selection, explicitly excluded Kanban and an unmounted spring-animation contract; they are not omitted Admin release requirements.
- Full Go regression suite, vet, formatting and module consistency checks passed.
- Disposable PostgreSQL suites passed for scoped recruitment/dashboard queries, account governance, all eight Admin roles, MFA/recovery audit rollback, forced resets, current-session checks and WebSocket revocation.
- Every included forward migration and reverse migration passed on a separate disposable database.

Browser API fixtures are synthetic; database-backed Go tests separately validate real authorization and persistence. Local evidence does not establish deployed production readiness or GitHub CI success.

## Operations boundary

This checkpoint authorizes source commit/push only. No production workflow dispatch, app/container redeploy, live database migration, AWS provisioning, DNS change, email-provider change or additional SES access request is included. Preserve existing SES-dependent registration restrictions. Live security activation, high-risk dual approval and remaining Master Admin workstreams are tracked in `admin-completion-roadmap.md` and require their own review.
